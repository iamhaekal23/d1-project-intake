// src/mockService.js - Smart Integration Adapter (F-1, F-2, F-6)
const express = require('express');
const router = express.Router();
const prisma = require('./prisma');
const asyncHandler = require('./asyncHandler');

// Konfigurasi URL Server Mitra dari Environment Variable
const F1_BASE = process.env.F1_API_URL || 'http://localhost:3001';
const F2_BASE = process.env.F2_API_URL || 'http://localhost:8080';
const F6_BASE = process.env.F6_API_URL || 'http://localhost:3006';

// Data Cadangan Lokal Klien (Fallback F-6)
const FALLBACK_CLIENTS = [
  { clientId: 'PTANTRI', code: 'PTANTRI', name: 'PT Anaheim Nimbus Universal', status: 'Aktif' },
  { clientId: 'PTINSA', code: 'PTINSA', name: 'PT Industri Nusantara Sejahtera', status: 'Aktif' },
  { clientId: 'PTSINAR', code: 'PTSINAR', name: 'PT Sinar Logistik', status: 'Aktif' },
  { clientId: 'PTCAKRA', code: 'PTCAKRA', name: 'PT Cakra Infrastruktur', status: 'Aktif' },
  { clientId: 'TELKOM', code: 'TELKOM', name: 'PT Telkom Indonesia Tbk', status: 'Aktif' }
];

// Data Cadangan Lokal SDM (Fallback F-2)
const FALLBACK_EMPLOYEES = [
  {
    employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a90',
    nomorPegawai: 'SDM-2026-001',
    namaLengkap: 'Sandy Walsh',
    namaJabatan: 'Project Manager',
    statusKerja: 'karyawan'
  },
  {
    employeeId: 'SDM-0004',
    nomorPegawai: 'SDM-2026-002',
    namaLengkap: 'Budi Santoso, M.T.',
    namaJabatan: 'Project Manager Senior',
    statusKerja: 'karyawan'
  }
];

// Helper Fetch dengan batas waktu (timeout) agar sistem tidak macet saat server mitra offline
async function fetchWithTimeout(url, options = {}, timeoutMs = 2500) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ============================================================================
// 1. INTEGRASI F-1: IDENTITAS, AKUN & AUTENTIKASI (POST /api/v1/auth/login)
// ============================================================================
router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Coba teruskan ke server F-1 nyata jika tersedia
  if (F1_BASE) {
    try {
      const extRes = await fetchWithTimeout(`${F1_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (extRes.ok) {
        const data = await extRes.json();
        console.log('[D-1 Integrasi] Berhasil autentikasi via peladen F-1 nyata');
        return res.json(data);
      }
    } catch (err) {
      console.warn('[D-1 Integrasi] Peladen F-1 tidak merespons. Mengaktifkan sesi mock lokal.');
    }
  }

  // Fallback sesi lokal akun Account Manager (AM)
  return res.json({
    token: 'mock-jwt-token-f1-account-manager-2026',
    user: {
      akunId: '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
      namaLengkap: 'Andi Maulana',
      email: email || 'andi@anaheim.local',
      peran: 'AM'
    }
  });
}));

// ============================================================================
// 2. INTEGRASI F-2: MASTER SDM & TENAGA AHLI (GET /api/v1/referensi/sdm)
// ============================================================================
const handleF2Employees = asyncHandler(async (req, res) => {
  if (F2_BASE) {
    try {
      const extRes = await fetchWithTimeout(`${F2_BASE}/api/v1/sdm`, {
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token-coo',
          'Accept': 'application/json'
        }
      }, 2500);

      if (extRes.ok) {
        const result = await extRes.json();
        const rawItems = result.items || result.data || [];
        console.log(`[D-1 Integrasi] Berhasil menarik ${rawItems.length} data SDM dari peladen F-2 nyata.`);

        const items = rawItems.map(emp => ({
          employeeId: emp.employeeId,
          nomorPegawai: emp.nomorPegawai || '',
          namaLengkap: emp.namaLengkap,
          jabatanId: emp.jabatanId || '',
          namaJabatan: emp.namaJabatan || 'Project Manager',
          statusKerja: emp.statusKerja || 'karyawan'
        }));

        // Format ganda (items & data) untuk menjaga kompatibilitas frontend
        return res.json({
          items,
          data: items,
          total: items.length,
          source: 'F2_LIVE_API'
        });
      }
      console.warn(`[D-1 Integrasi] Peladen F-2 merespons dengan HTTP ${extRes.status}. Mengaktifkan fallback.`);
    } catch (err) {
      console.warn(`[D-1 Integrasi] Gagal menghubungi peladen F-2 di ${F2_BASE}:`, err.message);
    }
  }

  // Fallback lokal jika peladen F-2 belum aktif / timeout
  return res.json({
    items: FALLBACK_EMPLOYEES,
    data: FALLBACK_EMPLOYEES,
    total: FALLBACK_EMPLOYEES.length,
    source: 'LOCAL_FALLBACK'
  });
});

// Pendaftaran rute referensi SDM (mendukung alias rute integrasi)
router.get('/referensi/sdm', handleF2Employees);
router.get('/sdm', handleF2Employees);
router.get('/employees', handleF2Employees);

// ============================================================================
// 3. INTEGRASI F-6: MASTER CRM KLIEN & KLIEN SEMENTARA (GET /api/v1/clients)
// ============================================================================
router.get('/clients', asyncHandler(async (req, res) => {
  let standardClients = FALLBACK_CLIENTS;

  // Coba ambil data klien nyata dari F-6
  if (F6_BASE) {
    try {
      const extRes = await fetchWithTimeout(`${F6_BASE}/api/v1/clients?status=Aktif`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 2500);

      if (extRes.ok) {
        const result = await extRes.json();
        const rawClients = result.data || result.items || [];
        if (Array.isArray(rawClients) && rawClients.length > 0) {
          console.log(`[D-1 Integrasi] Berhasil menarik ${rawClients.length} data klien dari peladen F-6.`);
          standardClients = rawClients;
        }
      }
    } catch (err) {
      console.warn('[D-1 Integrasi] Gagal menghubungi peladen F-6. Menggunakan data cadangan lokal.');
    }
  }

  // Ambil draf klien sementara yang disimpan di database lokal D-1 (Mitigasi Q-09)
  const tempClients = await prisma.temporaryClient.findMany({
    orderBy: { createdAt: 'desc' }
  });

  const mappedTemp = tempClients.map(tc => ({
    clientId: tc.tempClientId,
    code: tc.tempClientId,
    name: `${tc.companyName} (Draf Sementara)`,
    status: 'Aktif'
  }));

  const combined = [...standardClients, ...mappedTemp];
  return res.json({
    data: combined,
    items: combined,
    meta: { page: 1, limit: 50, total: combined.length }
  });
}));

// Endpoint Mandiri: Simpan Draf Klien Sementara (ENT-K01-04)
router.post('/temporary-clients', asyncHandler(async (req, res) => {
  const { companyName } = req.body;
  if (!companyName || typeof companyName !== 'string' || companyName.trim().length < 3) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Nama instansi wajib diisi minimal 3 karakter',
      details: { field: 'companyName' }
    });
  }

  const tempClientId = `TEMP-${Date.now().toString().slice(-4)}`;
  const created = await prisma.temporaryClient.create({
    data: {
      tempClientId,
      companyName: companyName.trim(),
      syncStatus: 'PENDING'
    }
  });

  return res.status(201).json({
    clientId: created.tempClientId,
    code: created.tempClientId,
    name: `${created.companyName} (Draf Sementara)`,
    status: 'Aktif'
  });
}));

module.exports = router;