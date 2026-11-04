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
// DATA FALLBACK LOKAL D1 (DIGUNAKAN HANYA SAAT F1/F2/F6 MATI)
// ============================================================================

// 1. Fallback Akun F1 (Account Manager lokal D1)
const FALLBACK_AM_USER = {
  akunId: "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
  namaLengkap: "Fikri Lazuardi Fadilla",
  email: "fikri.lazuardi@anaheim.local",
  peran: "AM"
};

// 2. Fallback Daftar SDM / PM F2 (Nama Anggota Kelompok D1)
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

// 3. Fallback Klien F6 (Penanda Instansi / PIC Kelompok D1)
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
  const usernameOrEmail = emailOrUsername || email;

  if (F1_BASE) {
    try {
      // 1. Tembak ke endpoint langsung F-1 (/auth/login)
      const extRes = await fetchWithTimeout(`${F1_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emailOrUsername: usernameOrEmail,
          password: password
        })
      }, 3000);

      // 2. Baca isi respons JSON dari peladen F1
      const data = await extRes.json();

      if (extRes.ok) {
        console.log(`[D1 Integrasi] Berhasil login via peladen F1 (${usernameOrEmail})`);
        
        // 3. Tentukan nama lengkap tampilan
        let displayName = data.username || usernameOrEmail;
        if (usernameOrEmail === 'account.manager' || usernameOrEmail === 'account.manager@anaheimnimbus.co.id') {
          displayName = 'Fikri Lazuardi Fadilla (AM)';
        } else if (usernameOrEmail === 'yuril.salsabila') {
          displayName = 'Yuril Salsabila (COO)';
        }

        return res.json({
          accessToken: data.accessToken,
          token: data.accessToken,
          tokenType: data.tokenType || 'Bearer',
          expiresIn: data.expiresIn,
          user: {
            akunId: data.accountId,
            namaLengkap: displayName,
            email: data.email || usernameOrEmail,
            peran: data.roleCode === 'COO' ? 'AM' : data.roleCode,
            roleCode: data.roleCode
          },
          source: 'F1_LIVE_API'
        });
      } else {
        console.warn(`[D1 Integrasi] Peladen F1 menolak kredensial: ${data.message || data.code}`);
        return res.status(extRes.status).json(data);
      }
    } catch (err) {
      console.warn(`[D1 Integrasi] Server F1 offline ${err.message}. Mengaktifkan fallback lokal.`);
    }
  }

  // Fallback F1 lokal jika peladen F1 mati/gagal
  return res.json({
    token: "mock-jwt-token-f1-account-manager-2026",
    accessToken: "mock-jwt-token-f1-account-manager-2026",
    user: FALLBACK_AM_USER,
    source: "LOCAL_FALLBACK_D1"
  });
}));

// ============================================================================
// ROUTE ADAPTER F2: REFERENSI SDM / PM
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
        if (Array.isArray(rawItems) && rawItems.length > 0) {
          console.log(`[D1 Integrasi] Berhasil menarik ${rawItems.length} SDM live dari F2.`);
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
      console.warn('[D1 Integrasi] Server F2 offline, beralih ke daftar PM Kelompok D1.');
    }
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

  if (F6_BASE) {
    try {
      // 1. Panggil F-6 menggunakan status=active sesuai data riil F-6
      const extRes = await fetchWithTimeout(`${F6_BASE}/api/v1/clients?status=active`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }, 2500);

      if (extRes.ok) {
        const result = await extRes.json();
        const rawClients = result.data || result.items || [];
        
        if (Array.isArray(rawClients) && rawClients.length > 0) {
          // 2. Normalisasi properti: pastikan clientId terisi dari code/id F-6
          standardClients = rawClients.map(c => ({
            clientId: c.code || c.id || c.clientId,
            code: c.code || c.id || c.clientId,
            name: c.name || c.companyName,
            status: 'Aktif',
            source: 'F6_CRM'
          }));
          source = 'F6_LIVE_API';
          console.log(`[D1 Integrasi] Berhasil menarik ${standardClients.length} klien dari F6.`);
        }
      }
    } catch (err) {
      console.warn('[D1 Integrasi] Server F6 offline, menggunakan referensi klien lokal Kelompok D1.');
    }
  }

  // 3. Gabungkan dengan Temporary Client lokal jika ada (Mitigasi Q-09)
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
    source: source,
    integrationSource: source
  });
}));

module.exports = router;