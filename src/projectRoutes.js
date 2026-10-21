// src/projectRoutes.js - REST API Kanonis Modul D-1 (Freeze UTS v0.2.0)
const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { 
  readDB, 
  writeDB, 
  getWIBTimestamp, 
  generateNextCanonicalCode, 
  toCanonicalProject 
} = require('./database');

// ============================================================================
// 1. API-K01-08: KOLEKSI PROYEK KANONIS (PAGINASI 3 DATA & FILTER)
// Digunakan oleh: Modul E-2 (Arus Kas), Modul E-1 (Dasbor), Antarmuka Web D-1
// ============================================================================
router.get('/projects', (req, res) => {
  const db = readDB();
  let list = db.projects || [];

  const { status, q } = req.query;
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 3); // Default 3 data per page

  // Filter berdasarkan status resmi proyek
  if (status && status !== 'ALL') {
    list = list.filter(p => p.status === status);
  }

  // Filter pencarian teks bebas (nama proyek, kode kanonis, nama klien)
  if (q) {
    const keyword = q.toLowerCase();
    list = list.filter(p => 
      (p.projectName && p.projectName.toLowerCase().includes(keyword)) ||
      (p.canonicalCode && p.canonicalCode.includes(keyword)) ||
      (p.clientName && p.clientName.toLowerCase().includes(keyword))
    );
  }

  const total = list.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  
  // Format seluruh item sesuai kontrak kanonis
  const paginatedProjects = list
    .slice(startIndex, startIndex + limit)
    .map(toCanonicalProject);

  // Mengembalikan struktur resmi ProjectListResponse
  res.status(200).json({
    data: paginatedProjects,
    meta: {
      page,
      limit,
      total,
      totalPages
    }
  });
});

// ============================================================================
// 2. API-K01-07: DETAIL TUNGGAL PROYEK KANONIS (SINGLE SOURCE OF TRUTH)
// Digunakan oleh: Modul E-2, E-3, E-5, D-3
// ============================================================================
router.get('/projects/:projectId', (req, res) => {
  const { projectId } = req.params;
  const db = readDB();
  const list = db.projects || [];

  // Mendukung pencarian via UUID v7 maupun nomor kanonis 6 digit (contoh: 202601)
  const project = list.find(p => p.projectId === projectId || p.canonicalCode === projectId);

  if (!project) {
    return res.status(404).json({
      code: "PROJECT_NOT_FOUND",
      message: `Data proyek dengan ID ${projectId} tidak ditemukan di sistem intake`,
      details: {
        requestedProjectId: projectId
      }
    });
  }

  // Kembalikan format ProjectCanonicalResponse (tanpa indicativeValue)
  res.status(200).json(toCanonicalProject(project));
});

// ============================================================================
// 3. API-K01-01: PENDAFTARAN DRAF PROYEK BARU
// ============================================================================
router.post('/projects', (req, res) => {
  const {
    projectName,
    clientId,
    clientName,
    pmEmployeeId,
    pmName,
    startDate,
    targetEndDate,
    indicativeValue
  } = req.body;

  // Validasi Aturan Bisnis D-1
  if (!projectName || projectName.trim().length < 5) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Nama proyek wajib diisi minimal 5 karakter",
      details: { field: "projectName" }
    });
  }

  if (!startDate || !targetEndDate) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Estimasi tanggal mulai dan selesai wajib ditentukan",
      details: { field: "dates" }
    });
  }

  if (new Date(targetEndDate) < new Date(startDate)) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Target selesai tidak boleh mendahului tanggal mulai proyek",
      details: { field: "targetEndDate" }
    });
  }

  const db = readDB();
  db.projects = db.projects || [];

  const nowWIB = getWIBTimestamp();
  const canonicalCode = generateNextCanonicalCode(db.projects);
  const projectId = crypto.randomUUID(); // Identitas UUID unik

  const newProject = {
    projectId,
    canonicalCode,
    projectName: projectName.trim(),
    clientId: clientId || 'PTANTRI',
    clientName: clientName || 'PT Anaheim Nimbus Universal',
    amEmployeeId: '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1', // Sesi AM Andi Maulana
    pmEmployeeId: pmEmployeeId || 'SDM-0004',
    pmName: pmName || 'Budi Santoso, M.T.',
    startDate,
    targetEndDate,
    indicativeValue: Number(indicativeValue) || 0,
    documentsComplete: true,
    poReceived: false, // Wajib bernilai false saat pendaftaran awal (Q-01 & Q-07)
    status: 'DRAFT',
    createdAt: nowWIB,
    updatedAt: nowWIB
  };

  db.projects.unshift(newProject);
  writeDB(db);

  res.status(201).json({
    message: "Draf proyek berhasil didaftarkan",
    data: newProject
  });
});

// ============================================================================
// 4. API-K01-04: PENGAJUAN SERAH TERIMA / HANDOVER KE PM
// ============================================================================
router.post('/projects/:projectId/handover', (req, res) => {
  const { projectId } = req.params;
  const db = readDB();
  const project = (db.projects || []).find(p => p.projectId === projectId || p.canonicalCode === projectId);

  if (!project) {
    return res.status(404).json({
      code: "PROJECT_NOT_FOUND",
      message: `Proyek ${projectId} tidak ditemukan`
    });
  }

  project.status = 'UNDER_REVIEW';
  project.updatedAt = getWIBTimestamp();
  writeDB(db);

  res.status(200).json({
    message: "Proyek berhasil diajukan untuk review PM",
    data: toCanonicalProject(project)
  });
});

// ============================================================================
// 5. API-K01-06: VERIFIKASI PERSETUJUAN PM (APPROVE -> REGISTERED)
// ============================================================================
router.post('/projects/:projectId/approve', (req, res) => {
  const { projectId } = req.params;
  const db = readDB();
  const project = (db.projects || []).find(p => p.projectId === projectId || p.canonicalCode === projectId);

  if (!project) {
    return res.status(404).json({
      code: "PROJECT_NOT_FOUND",
      message: `Proyek ${projectId} tidak ditemukan`
    });
  }

  project.status = 'REGISTERED';
  project.updatedAt = getWIBTimestamp();
  writeDB(db);

  res.status(200).json({
    message: "Proyek disetujui dan berstatus REGISTERED",
    data: toCanonicalProject(project)
  });
});

// ============================================================================
// 6. API-K01-05: PENOLAKAN SERAH TERIMA PM (REJECT -> REVISI_HANDOVER)
// ============================================================================
router.post('/projects/:projectId/reject', (req, res) => {
  const { projectId } = req.params;
  const { rejectionNotes } = req.body;

  // Validasi Keputusan Mitra Q-04: Catatan penolakan PM wajib minimal 20 karakter
  if (!rejectionNotes || rejectionNotes.trim().length < 20) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Catatan revisi PM wajib diisi minimal 20 karakter",
      details: { field: "rejectionNotes" }
    });
  }

  const db = readDB();
  const project = (db.projects || []).find(p => p.projectId === projectId || p.canonicalCode === projectId);

  if (!project) {
    return res.status(404).json({
      code: "PROJECT_NOT_FOUND",
      message: `Proyek ${projectId} tidak ditemukan`
    });
  }

  project.status = 'REVISI_HANDOVER';
  project.rejectionNotes = rejectionNotes.trim();
  project.updatedAt = getWIBTimestamp();
  writeDB(db);

  res.status(200).json({
    message: "Serah terima proyek ditolak untuk revisi",
    data: toCanonicalProject(project)
  });
});

module.exports = router;