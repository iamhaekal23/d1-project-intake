// src/mockService.js - Layanan Mock Hulu Terisolasi (F-1, F-2, F-6)
const express = require('express');
const router = express.Router();
const { readDB } = require('./database');

// ============================================================================
// MOCK F-1: IDENTITAS, AKUN, DAN HAK AKSES (Otorisasi JWT & Sesi AM)
// ============================================================================
router.post('/auth/login', (req, res) => {
  res.json({
    token: "mock-jwt-token-f1-account-manager-2026",
    user: {
      akunId: "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
      namaLengkap: "Andi Maulana",
      email: "andi@anaheim.local",
      peran: "AM"
    }
  });
});

// ============================================================================
// MOCK F-2: MASTER SDM & TENAGA AHLI (API-K02-16 / Referensi PM)
// Catatan: Diselaraskan dengan revisi kandidat final F-2 v1.1
// ============================================================================
const mockSDMHandler = (req, res) => {
  // Payload referensi publik non-sensitif (tanpa data gaji, rekening, atau kontak personal)
  res.json({
    items: [
      {
        employeeId: "SDM-0004",
        namaLengkap: "Budi Santoso, M.T.",
        jabatanId: "JBT-06",
        namaJabatan: "Project Manager Senior",
        statusKerja: "Karyawan"
      },
      {
        employeeId: "SDM-0005",
        namaLengkap: "Rina Prasetyo, S.T.",
        jabatanId: "JBT-06",
        namaJabatan: "Project Manager",
        statusKerja: "Karyawan"
      },
      {
        employeeId: "SDM-0006",
        namaLengkap: "Siti Aminah, S.Kom",
        jabatanId: "JBT-06",
        namaJabatan: "Project Manager",
        statusKerja: "Karyawan"
      }
    ],
    total: 3
  });
};

// Mendukung endpoint kontrak v0.1 maupun rute alternatif v1.1 F-2
router.get('/referensi/sdm', mockSDMHandler);
router.get('/employees', mockSDMHandler);

// ============================================================================
// MOCK F-6: MASTER CRM KLIEN DAN KONTAK (API-KF6-01)
// ============================================================================
router.get('/clients', (req, res) => {
  const db = readDB();
  const standardClients = [
    { clientId: "PTANTRI", code: "PTANTRI", name: "PT Anaheim Nimbus Universal", status: "Aktif" },
    { clientId: "PTINSA", code: "PTINSA", name: "PT Industri Nusantara Sejahtera", status: "Aktif" },
    { clientId: "TELKOM", code: "TELKOM", name: "PT Telkom Indonesia Tbk", status: "Aktif" },
    { clientId: "NUSA", code: "NUSA", name: "PT Nusa Digital Solusi", status: "Aktif" }
  ];

  // Menggabungkan draf klien sementara lokal jika CRM F-6 belum mencatatnya (ENT-K01-04)
  const tempClients = (db.temporary_clients || []).map(tc => ({
    clientId: tc.tempClientId,
    code: tc.tempClientId,
    name: `${tc.companyName} (Draf Sementara)`,
    status: "Aktif"
  }));

  res.json({
    data: [...standardClients, ...tempClients],
    meta: { page: 1, limit: 20, total: standardClients.length + tempClients.length }
  });
});

module.exports = router;