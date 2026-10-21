// src/projectRoutes.js - Kontrak API Resmi Modul D-1
const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { readDB, writeDB, generateNextCanonicalCode } = require('./database');

// 1. API-K01-08: GET /api/v1/projects (Koleksi Proyek Berkemampuan Paging untuk E-2 & UI)
router.get('/projects', (req, res) => {
  const db = readDB();
  let list = db.projects || [];

  const { status, q } = req.query;
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 3; // <-- UBAH KE 3 DATA PER PAGE

  // Filter status operasional
  if (status) {
    list = list.filter(p => p.status === status);
  }

  // Filter pencarian teks
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
  const paginatedData = list.slice(startIndex, startIndex + limit);

  // Jika dipanggil oleh antarmuka lokal tanpa query paging, kembalikan array murni
  if (!req.query.page && !req.query.limit && !req.query.status && !req.query.q) {
    return res.json(list);
  }

  // Format respons resmi dengan paging
  res.json({
    data: paginatedData,
    meta: { page, limit, total, totalPages }
  });
});

// 2. API-K01-07: GET /api/v1/projects/:projectId (Detail Tunggal Kanonis Terpusat)
router.get('/projects/:projectId', (req, res) => {
  const db = readDB();
  const proj = db.projects.find(p => p.projectId === req.params.projectId || p.canonicalCode === req.params.projectId);

  if (!proj) {
    return res.status(404).json({
      code: "PROJECT_NOT_FOUND",
      message: `Data proyek dengan ID ${req.params.projectId} tidak ditemukan di sistem intake`,
      details: { requestedProjectId: req.params.projectId }
    });
  }

  // Payload kanonis resmi
  res.json({
    projectId: proj.projectId,
    canonicalCode: proj.canonicalCode,
    projectName: proj.projectName,
    clientId: proj.clientId,
    clientName: proj.clientName,
    amEmployeeId: proj.amEmployeeId,
    pmEmployeeId: proj.pmEmployeeId,
    startDate: proj.startDate,
    targetEndDate: proj.targetEndDate,
    documentsComplete: proj.documentsComplete,
    poReceived: proj.poReceived,
    status: proj.status,
    createdAt: proj.createdAt,
    updatedAt: proj.updatedAt
  });
});

// 3. API-K01-01: POST /api/v1/projects (Registrasi Draf Proyek Baru)
router.post('/projects', (req, res) => {
  const { projectName, clientId, clientName, pmEmployeeId, pmName, startDate, targetEndDate, indicativeValue } = req.body;

  // Validasi Aturan Bisnis Server-Side
  const errors = {};
  if (!projectName || projectName.trim().length < 5) {
    errors.projectName = "Nama proyek wajib diisi (minimal 5 karakter)";
  }
  if (!startDate) {
    errors.startDate = "Estimasi tanggal mulai wajib ditentukan";
  }
  if (!targetEndDate) {
    errors.targetEndDate = "Estimasi target selesai wajib ditentukan";
  }
  if (startDate && targetEndDate && new Date(targetEndDate) < new Date(startDate)) {
    errors.targetEndDate = "Target tanggal selesai tidak boleh mendahului tanggal mulai proyek";
  }
  if (!pmEmployeeId) {
    errors.pmEmployeeId = "Penunjukan PM pelaksana wajib dipilih";
  }

  if (Object.keys(errors).length > 0) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Data input registrasi proyek tidak valid",
      details: errors
    });
  }

  const db = readDB();
  const canonicalCode = generateNextCanonicalCode(db.projects);
  const now = new Date().toISOString();

  const newProject = {
    projectId: `01924b1e-${Date.now().toString(16)}-7a81-9b12-${crypto.randomBytes(6).toString('hex')}`,
    canonicalCode: canonicalCode,
    projectName: projectName.trim(),
    clientId: clientId || "PTANTRI",
    clientName: clientName || "PT Anaheim Nimbus Universal",
    amEmployeeId: "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
    amName: "Andi Maulana",
    pmEmployeeId: pmEmployeeId,
    pmName: pmName || "Budi Santoso, M.T.",
    startDate: startDate,
    targetEndDate: targetEndDate,
    indicativeValue: Number(indicativeValue) || 0,
    status: "DRAFT",
    poReceived: false,
    documentsComplete: false,
    createdAt: now,
    updatedAt: now
  };

  db.projects.unshift(newProject);
  db.project_audit_logs.push({
    logId: `LOG-${Date.now()}`,
    projectId: newProject.projectId,
    actorId: "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
    action: "CREATE_DRAFT",
    details: `Draf proyek terdaftar dengan kode kanonis ${canonicalCode}`,
    timestamp: now
  });

  writeDB(db);

  res.status(201).json({
    message: `Draf proyek berhasil didaftarkan dengan Kode Kanonis ${canonicalCode}`,
    data: newProject
  });
});

// 4. ENT-K01-04: POST /api/v1/temporary-clients (Draf Klien Sementara)
router.post('/temporary-clients', (req, res) => {
  const { companyName } = req.body;
  if (!companyName || companyName.trim().length < 3) {
    return res.status(400).json({ code: "VALIDATION_ERROR", message: "Nama instansi minimal 3 karakter" });
  }

  const db = readDB();
  const tempClientId = `TEMP-${Date.now().toString().slice(-4)}`;
  const newClient = {
    tempClientId,
    companyName: companyName.trim(),
    syncStatus: "PENDING",
    createdAt: new Date().toISOString()
  };

  db.temporary_clients.push(newClient);
  writeDB(db);

  res.status(201).json({
    clientId: tempClientId,
    name: `${companyName.trim()} (Draf Sementara)`,
    status: "Aktif"
  });
});

module.exports = router;