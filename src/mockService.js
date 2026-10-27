// src/mockService.js - Smart Integration Adapter (F-1, F-2, F-6)
const express = require('express');
const router = express.Router();
const prisma = require('./prisma');
const asyncHandler = require('./asyncHandler');

// Baca konfigurasi URL peladen mitra dari environment variable
const F1_BASE = process.env.F1_API_URL || '';
const F2_BASE = process.env.F2_API_URL || '';
const F6_BASE = process.env.F6_API_URL || '';

// Helper fetch dengan timeout 2.5 detik agar antarmuka tidak macet saat server mitra offline
async function fetchWithTimeout(url, options = {}, timeout = 2500) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { credentials: 'omit', ...options, signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

// ============================================================================
// 1. INTEGRASI F-1: IDENTITAS, AKUN & AUTENTIKASI (API-F1-02 & API-F1-01)
// ============================================================================
router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  // Coba panggil API asli F-1 jika URL tersedia
  if (F1_BASE) {
    try {
      const externalRes = await fetchWithTimeout(`${F1_BASE}/api/v1/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      if (externalRes.ok) {
        const data = await externalRes.json();
        console.log('[D-1 Integrasi] Berhasil autentikasi via server F-1 nyata');
        return res.json(data);
      }
    } catch (err) {
      console.warn('[D-1 Integrasi] Gagal menghubungi peladen F-1. Mengaktifkan fallback lokal.');
    }
  }

  // Fallback lokal jika F-1 belum aktif (Sesi AM Andi Maulana)
  res.json({
    token: 'mock-jwt-token-f1-account-manager-2026',
    user: {
      akunId: '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
      namaLengkap: 'Andi Maulana',
      email: email || 'andi@anaheim.local',
      peran: 'AM'
    }
  });
});

// ============================================================================
// 2. INTEGRASI F-2: REFERENSI MASTER SDM PM (API-K02-16 / API-K02-17)
// ============================================================================
const handleF2Employees = async (req, res) => {
  // Coba panggil API asli F-2 jika URL tersedia
  if (F2_BASE) {
    try {
      // Coba rute standar F-2 v1.1
      let externalRes = await fetchWithTimeout(`${F2_BASE}/api/v1/referensi/sdm`);
      if (!externalRes.ok) {
        externalRes = await fetchWithTimeout(`${F2_BASE}/api/v1/employees?role=PM`);
      }

      if (externalRes.ok) {
        const result = await externalRes.json();
        const items = result.items || result.data || result;
        if (Array.isArray(items) && items.length > 0) {
          console.log('[D-1 Integrasi] Berhasil menarik data master SDM dari peladen F-2');
          return res.json({ items });
        }
      }
    } catch (err) {
      console.warn('[D-1 Integrasi] Gagal menghubungi peladen F-2. Mengaktifkan fallback lokal.');
    }
  }

  // Fallback data lokal D-1 sesuai dokumen kesepakatan
  res.json({
    items: [
      {
        employeeId: 'SDM-0004',
        namaLengkap: 'Budi Santoso, M.T.',
        namaJabatan: 'Project Manager Senior',
        statusKerja: 'Karyawan'
      },
      {
        employeeId: 'SDM-0006',
        namaLengkap: 'Siti Aminah, S.Kom',
        namaJabatan: 'Project Manager',
        statusKerja: 'Karyawan'
      },
      {
        employeeId: 'SDM-0012',
        namaLengkap: 'Andi Maulana, S.T.',
        namaJabatan: 'Account Manager',
        statusKerja: 'Karyawan'
      }
    ]
  });
};

router.get('/referensi/sdm', handleF2Employees);
router.get('/employees', handleF2Employees);

// ============================================================================
// 3. INTEGRASI F-6: MASTER CRM KLIEN (API-KF6-01 & API-KF6-02)
// ============================================================================
router.get('/clients', asyncHandler(async (req, res) => {
  const temporaryClients = await prisma.temporaryClient.findMany();
  const tempClients = temporaryClients.map(tc => ({
    clientId: tc.tempClientId,
    code: tc.tempClientId,
    name: `${tc.companyName} (Sementara)`,
    status: 'Aktif'
  }));

  // Coba panggil API asli F-6 jika URL tersedia
  if (F6_BASE) {
    try {
      const externalRes = await fetchWithTimeout(`${F6_BASE}/api/v1/clients?status=Aktif`);
      if (externalRes.ok) {
        const result = await externalRes.json();
        const clientsFromF6 = result.data || result;
        if (Array.isArray(clientsFromF6)) {
          console.log('[D-1 Integrasi] Berhasil menarik master klien dari peladen F-6');
          return res.json({
            data: [...clientsFromF6, ...tempClients]
          });
        }
      }
    } catch (err) {
      console.warn('[D-1 Integrasi] Gagal menghubungi peladen F-6. Mengaktifkan fallback lokal.');
    }
  }

  // Fallback data master klien fiktif F-6 + draf klien sementara lokal
  const fallbackClients = [
    { clientId: 'PTANTRI', code: 'PTANTRI', name: 'PT Anaheim Nimbus Universal', status: 'Aktif' },
    { clientId: 'PTINSA', code: 'PTINSA', name: 'PT Industri Nusantara Sejahtera', status: 'Aktif' },
    { clientId: 'TELKOM', code: 'TELKOM', name: 'PT Telkom Indonesia Tbk', status: 'Aktif' }
  ];

  res.json({
    data: [...fallbackClients, ...tempClients]
  });
}));

// Penampung Draf Klien Sementara (Mitigasi Q-09)
router.post('/temporary-clients', asyncHandler(async (req, res) => {
  const { companyName } = req.body;
  if (typeof companyName !== 'string' || companyName.trim().length < 3) {
    return res.status(400).json({
      error: 'Nama instansi klien sementara minimal 3 karakter'
    });
  }

  let newClient;
  for (let attempt = 0; attempt < 10; attempt++) {
    const tempClientId = `TEMP-${(Date.now() + attempt).toString().slice(-4)}`;
    try {
      newClient = await prisma.temporaryClient.create({
        data: {
          tempClientId,
          companyName: companyName.trim(),
          syncStatus: 'PENDING'
        }
      });
      break;
    } catch (error) {
      if (error.code !== 'P2002' || attempt === 9) throw error;
    }
  }

  res.status(201).json({
    clientId: newClient.tempClientId,
    name: `${companyName.trim()} (Sementara)`
  });
}));

module.exports = router;