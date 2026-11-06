const express = require('express');
const router = express.Router();
const prisma = require('./prisma');
const asyncHandler = require('./asyncHandler');

// Basis URL Layanan Hulu dari variabel lingkungan
const F1_BASE = process.env.F1_API_URL || 'http://localhost:4100';
const F2_BASE = process.env.F2_API_URL || 'http://localhost:8080';
const F6_BASE = process.env.F6_API_URL || 'http://localhost:8000';

// Helper Fetch dengan Timeout
async function fetchWithTimeout(resource, options = {}, timeout = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// ============================================================================
// DATA FALLBACK LOKAL D1 (DIGUNAKAN SAAT F1/F2/F6 LURING)
// ============================================================================

// 1. Fallback Akun AM F1
const FALLBACK_AM_USER = {
  akunId: "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
  employeeId: null,
  namaLengkap: "Fikri Lazuardi Fadilla (AM)",
  email: "fikri.lazuardi@anaheimnimbus.co.id",
  peran: "AM",
  roleCode: "AM"
};

// 2. Fallback Daftar SDM / PM F2
const FALLBACK_EMPLOYEES = [
  {
    employeeId: "01929b4a-5f10-7a22-9d44-3c8f1b2e7a01",
    nomorPegawai: "SDM-D1-001",
    namaLengkap: "Haekal Khadafy",
    namaJabatan: "Project Manager",
    statusKerja: "karyawan"
  },
  {
    employeeId: "01929b4a-5f10-7a22-9d44-3c8f1b2e7a02",
    nomorPegawai: "SDM-D1-002",
    namaLengkap: "Rama Sadea Putra",
    namaJabatan: "Project Manager",
    statusKerja: "karyawan"
  },
  {
    employeeId: "01929b4a-5f10-7a22-9d44-3c8f1b2e7a03",
    nomorPegawai: "SDM-D1-003",
    namaLengkap: "Muhammad Yafi Nasrulloh",
    namaJabatan: "Project Manager",
    statusKerja: "karyawan"
  },
  {
    employeeId: "01929b4a-5f10-7a22-9d44-3c8f1b2e7a04",
    nomorPegawai: "SDM-D1-004",
    namaLengkap: "Fadhilah Aditya Ahmad",
    namaJabatan: "Project Manager",
    statusKerja: "karyawan"
  },
  {
    employeeId: "01929b4a-5f10-7a22-9d44-3c8f1b2e7a05",
    nomorPegawai: "SDM-D1-005",
    namaLengkap: "Nayara Christony Paul Barriga",
    namaJabatan: "Project Manager",
    statusKerja: "karyawan"
  }
];

// 3. Fallback Klien F6
const FALLBACK_CLIENTS = [
  { clientId: "PTFIKRI", code: "PTFIKRI", name: "PT Fikri Solusi Mandiri", status: "Aktif" },
  { clientId: "PTHAEKAL", code: "PTHAEKAL", name: "PT Haekal Kreasi Nusantara", status: "Aktif" },
  { clientId: "PTYAFI", code: "PTYAFI", name: "PT Yafi Digital Dinamika", status: "Aktif" },
  { clientId: "PTRAMA", code: "PTRAMA", name: "PT Rama Teknologi Terpadu", status: "Aktif" }
];

// ============================================================================
// ROUTE ADAPTER F1: AUTHENTICATION
// ============================================================================
router.post('/auth/login', asyncHandler(async (req, res) => {
  const { email, password, emailOrUsername } = req.body;
  const usernameOrEmail = emailOrUsername || email || 'account.manager';

  // 1. Teruskan autentikasi ke peladen F1 jika aktif
  try {
    const extRes = await fetchWithTimeout(`${F1_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        emailOrUsername: usernameOrEmail,
        password: password || 'Password123!'
      })
    }, 2500);

    if (extRes.ok) {
      const data = await extRes.json();
      console.log(`[D1 Integrasi] Berhasil terhubung via peladen F1 (${usernameOrEmail})`);

      // Tentukan nama resmi AM saat F1 online
      let displayName = data.username || usernameOrEmail;
      if (usernameOrEmail.includes('account.manager') || usernameOrEmail.includes('accountmanager')) {
        displayName = 'Account Manager';
      }

      return res.json({
        token: data.accessToken,
        accessToken: data.accessToken,
        tokenType: data.tokenType || 'Bearer',
        expiresIn: data.expiresIn || 3600,
        user: {
          akunId: data.accountId,
          employeeId: data.employeeId || null,
          namaLengkap: displayName,
          email: usernameOrEmail,
          peran: 'AM',
          roleCode: data.roleCode || 'AM'
        },
        source: 'F1_LIVE_API'
      });
    }
  } catch (err) {
    console.warn(`[D1 Integrasi] Server F1 offline (${err.message}). Mengaktifkan fallback lokal.`);
  }

  // 2. Fallback lokal saat server F1 mati (Mode Mandiri Kelompok D1)
  return res.json({
    token: 'mock-jwt-token-f1-account-manager-2026',
    accessToken: 'mock-jwt-token-f1-account-manager-2026',
    tokenType: 'Bearer',
    expiresIn: 3600,
    user: FALLBACK_AM_USER,
    source: 'LOCAL_FALLBACK_D1'
  });
}));

// ============================================================================
// ROUTE ADAPTER F2: REFERENSI SDM / PM
// ============================================================================
const handleF2Employees = asyncHandler(async (req, res) => {
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
      if (Array.isArray(rawItems) && rawItems.length > 0) {
        console.log(`[D1 Integrasi] Berhasil terhubung via peladen F2 ${rawItems.length}`);
        const items = rawItems.map(emp => ({
          employeeId: emp.employeeId,
          nomorPegawai: emp.nomorPegawai || '',
          namaLengkap: emp.namaLengkap,
          namaJabatan: emp.namaJabatan || 'Project Manager',
          statusKerja: emp.statusKerja || 'karyawan'
        }));
        return res.json({ items, data: items, source: 'F2_LIVE_API' });
      }
    }
  } catch (err) {
    console.warn(`[D1 Integrasi] Server F2 offline (${err.message}). Mengaktifkan fallback lokal.`);
  }

  // Fallback F2 lokal
  return res.json({
    items: FALLBACK_EMPLOYEES,
    data: FALLBACK_EMPLOYEES,
    source: 'LOCAL_FALLBACK_D1'
  });
});

router.get('/referensi/sdm', handleF2Employees);
router.get('/sdm', handleF2Employees);
router.get('/employees', handleF2Employees);

// ============================================================================
// ROUTE ADAPTER F6: MASTER KLIEN
// ============================================================================
router.get('/clients', asyncHandler(async (req, res) => {
  let standardClients = FALLBACK_CLIENTS;
  let source = 'LOCAL_FALLBACK_D1';

  try {
    const extRes = await fetchWithTimeout(`${F6_BASE}/api/v1/clients?status=active`, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    }, 2500);

    if (extRes.ok) {
      const result = await extRes.json();
      const rawClients = result.data || result.items || [];
      
      if (Array.isArray(rawClients) && rawClients.length > 0) {
        standardClients = rawClients.map(c => ({
          clientId: c.code || c.id || c.clientId,
          code: c.code || c.id || c.clientId,
          name: c.name || c.companyName,
          status: 'Aktif',
          source: 'F6_CRM'
        }));
        source = 'F6_LIVE_API';
        console.log(`[D1 Integrasi] Berhasil terhubung via peladen F6 ${standardClients.length}`);
      }
    }
  } catch (err) {
    console.warn(`[D1 Integrasi] Server F6 offline (${err.message}). Mengaktifkan fallback lokal.`);
  }

  // Gabungkan dengan Temporary Client lokal jika ada (ENT-K01-04)
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
  res.json({
    data: combined,
    items: combined,
    meta: { page: 1, limit: 50, total: combined.length },
    source: source
  });
}));

module.exports = router;