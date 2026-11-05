// src/projectRoutes.js - Endpoint REST API Modul D-1 (Registrasi & Intake Proyek)
const express = require('express');
const router = express.Router();
const prisma = require('./prisma');
const crypto = require('crypto');

// Pembangkit UUID v7 standar RFC 9562
function generateUuidV7() {
  const timestamp = BigInt(Date.now());
  const bytes = crypto.randomBytes(16);

  // 48-bit timestamp UNIX milidetik
  bytes.writeUIntBE(Number(timestamp >> 16n), 0, 4);
  bytes.writeUInt16BE(Number(timestamp & 0xffffn), 4);

  // Versi 7 (0111)
  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  // Varian RFC 4122 (10xx)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// Regex format UUID (RFC 4122 / RFC 9562)
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Format standar respons galat OpenAPI
const sendError = (res, statusCode, code, message, details = {}) => {
  return res.status(statusCode).json({ code, message, details });
};

// Middleware Pemeriksaan Bearer Token (Penyelesaian INT-01)
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(
      res,
      401,
      'UNAUTHORIZED',
      'Akses ditolak: Header Authorization Bearer token wajib disertakan',
      { header: 'Authorization' }
    );
  }

  const token = authHeader.split(' ')[1];
  if (!token || token.trim() === '') {
    return sendError(
      res,
      401,
      'UNAUTHORIZED',
      'Akses ditolak: Token Bearer tidak valid atau kosong',
      { header: 'Authorization' }
    );
  }

  req.token = token;
  next();
};

// Konversi Timestamp ke Format ISO 8601 dengan Offset WIB (+07:00) (Penyelesaian INT-04)
function formatWib(date) {
  if (!date) return null;
  const d = new Date(date);
  const wibTime = new Date(d.getTime() + (7 * 60 * 60 * 1000));
  const YYYY = wibTime.getUTCFullYear();
  const MM = String(wibTime.getUTCMonth() + 1).padStart(2, '0');
  const DD = String(wibTime.getUTCDate()).padStart(2, '0');
  const hh = String(wibTime.getUTCHours()).padStart(2, '0');
  const mm = String(wibTime.getUTCMinutes()).padStart(2, '0');
  const ss = String(wibTime.getUTCSeconds()).padStart(2, '0');
  return `${YYYY}-${MM}-${DD}T${hh}:${mm}:${ss}+07:00`;
}

// Serializer Objek Proyek Kanonis Resmi (Penyelesaian INT-03, INT-04, INT-06 & Dukungan E-5)
function toCanonicalProjectResponse(project) {
  return {
    projectId: project.projectId,
    canonicalCode: project.canonicalCode || null,
    projectName: project.projectName,
    clientId: project.clientId,
    clientName: project.clientName,
    amEmployeeId: project.amEmployeeId,
    amName: project.amName || 'Fikri Lazuardi Fadilla (AM)',
    pmEmployeeId: project.pmEmployeeId,
    pmName: project.pmName || 'Sandy Walsh',
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    documentsComplete: Boolean(project.documentsComplete),
    poReceived: Boolean(project.poReceived),
    status: project.status,
    active: project.status === 'REGISTERED', // Kebutuhan modul E-5
    createdAt: formatWib(project.createdAt),
    updatedAt: formatWib(project.updatedAt)
    // indicativeValue, auditLogs, dan rejectionNotes sengaja tidak disertakan (Perlindungan INT-03)
  };
}

// ============================================================================
// 1. GET /api/v1/projects - Koleksi Proyek (Paging Konsumen E-2 & Dasbor D-1)
// ============================================================================
router.get('/projects', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.max(1, parseInt(req.query.limit) || 3);
    const status = req.query.status;
    const q = req.query.q ? req.query.q.trim().toLowerCase() : '';

    const where = {};
    if (status && status !== 'ALL') {
      where.status = status;
    }
    if (q) {
      where.OR = [
        { projectName: { contains: q } },
        { clientName: { contains: q } },
        { canonicalCode: { contains: q } }
      ];
    }

    const [total, rawProjects] = await Promise.all([
      prisma.project.count({ where }),
      prisma.project.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
      })
    ]);

    res.json({
      data: rawProjects,
      items: rawProjects,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 2. GET /api/v1/projects/:projectId - Detail Proyek Kanonis (API-K01-07)
// ============================================================================
router.get('/projects/:projectId', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    // 1. Validasi Format Parameter: Wajib UUID (Penyelesaian INT-02)
    if (!UUID_REGEX.test(projectId)) {
      return sendError(
        res,
        400,
        'INVALID_PROJECT_ID_FORMAT',
        `Format projectId '${projectId}' tidak valid. Parameter harus berupa UUID v7`,
        { requestedProjectId: projectId }
      );
    }

    // 2. Pencarian Berdasarkan UUID Primer
    const project = await prisma.project.findUnique({
      where: { projectId }
    });

    // 3. Penanganan Jika Data Tidak Ditemukan
    if (!project) {
      return sendError(
        res,
        404,
        'PROJECT_NOT_FOUND',
        `Data proyek dengan ID ${projectId} tidak ditemukan di sistem intake`,
        { requestedProjectId: projectId }
      );
    }

    // 4. Kembalikan Respons Bersih Melalui Serializer Kanonis
    res.json(toCanonicalProjectResponse(project));
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// Detail untuk UI intake; nilai indikatif tidak termasuk respons API kanonis publik.
router.get('/projects/:projectId/intake-detail', authenticateToken, async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!UUID_REGEX.test(projectId)) {
      return sendError(
        res,
        400,
        'INVALID_PROJECT_ID_FORMAT',
        `Format projectId '${projectId}' tidak valid. Parameter harus berupa UUID v7`,
        { requestedProjectId: projectId }
      );
    }

    const project = await prisma.project.findUnique({ where: { projectId } });
    if (!project) {
      return sendError(
        res,
        404,
        'PROJECT_NOT_FOUND',
        `Data proyek dengan ID ${projectId} tidak ditemukan di sistem intake`,
        { requestedProjectId: projectId }
      );
    }

    res.json({
      ...toCanonicalProjectResponse(project),
      indicativeValue: Number(project.indicativeValue ?? 0)
    });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 3. GET /api/v1/projects/:projectId/charter - Unduh PDF Project Charter
// ============================================================================
router.get('/projects/:projectId/charter', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { projectId: projectId },
          { canonicalCode: projectId }
        ]
      }
    });

    if (!project) {
      return sendError(res, 404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
    }

    if (project.status !== 'REGISTERED') {
      return sendError(
        res,
        400,
        'INVALID_STATUS',
        'Project Charter hanya dapat diterbitkan untuk proyek yang telah berstatus REGISTERED'
      );
    }

    const esc = (str) => String(str ?? '—')
      .replace(/\\/g, '\\\\')
      .replace(/\(/g, '\\(')
      .replace(/\)/g, '\\)');

    const rupiah = new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(Number(project.indicativeValue || 0));

    const tglCetak = new Date().toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });

    const cmds = [];

    // Header Navy Gelap
    cmds.push('0.043 0.075 0.141 rg');
    cmds.push('40 735 515 65 re f');
    cmds.push('1 1 1 rg');
    cmds.push(`BT /F1 8 Tf 55 782 Td (${esc('PT ANAHEIM NIMBUS UNIVERSAL  |  ENTERPRISE RESOURCE PLANNING')}) Tj ET`);
    cmds.push(`BT /F2 15 Tf 55 762 Td (${esc('LEMBAR PENGESAHAN PROJECT CHARTER')}) Tj ET`);
    cmds.push('0.7 0.8 0.9 rg');
    cmds.push(`BT /F1 8 Tf 55 747 Td (${esc('Dokumen Otorisasi & Serah Terima Proyek Kanonis (Modul D-1 Project Intake)')}) Tj ET`);

    // Badge Status
    cmds.push('0.06 0.46 0.43 rg');
    cmds.push('440 752 100 32 re f');
    cmds.push('1 1 1 rg');
    cmds.push(`BT /F1 7 Tf 452 771 Td (${esc('STATUS: REGISTERED')}) Tj ET`);
    cmds.push(`BT /F2 12 Tf 452 757 Td (${esc('KODE ' + (project.canonicalCode || '-'))}) Tj ET`);

    // Seksi 1: Identitas Proyek
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 40 710 Td (${esc('1. IDENTITAS UTAMA PROYEK')}) Tj ET`);
    cmds.push('0.8 0.85 0.9 RG 1 w 40 703 m 555 703 l S');

    const drawRow = (y, label, value, isBoldVal = false) => {
      cmds.push('0.97 0.98 0.99 rg');
      cmds.push(`40 ${y - 6} 165 22 re f`);
      cmds.push('0.90 0.92 0.95 RG 0.5 w');
      cmds.push(`40 ${y - 6} 515 22 re S`);
      cmds.push('0.39 0.45 0.55 rg');
      cmds.push(`BT /F2 9 Tf 48 ${y + 2} Td (${esc(label)}) Tj ET`);
      cmds.push('0.06 0.09 0.16 rg');
      cmds.push(`BT /${isBoldVal ? 'F2' : 'F1'} 9.5 Tf 215 ${y + 2} Td (${esc(value)}) Tj ET`);
    };

    drawRow(675, 'Nama Proyek', project.projectName, true);
    drawRow(653, 'Kode Kanonis Resmi', project.canonicalCode || '—', true);
    drawRow(631, 'ID Unik Proyek (UUID v7)', project.projectId, false);
    drawRow(609, 'Instansi Klien Pemesan', `${project.clientName || '—'} (${project.clientId || '—'})`, false);

    // Seksi 2: Parameter Administratif
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 40 578 Td (${esc('2. PARAMETER ADMINISTRATIF, KOMERSIAL & PENANGGUNG JAWAB')}) Tj ET`);
    cmds.push('0.8 0.85 0.9 RG 1 w 40 571 m 555 571 l S');

    drawRow(543, 'Account Manager (AM)', `${project.amName || 'Fikri Lazuardi Fadilla (AM)'}`, false);
    drawRow(521, 'Project Manager (PM)', `${project.pmName || 'Sandy Walsh'}`, true);
    drawRow(499, 'Estimasi Periode Proyek', `${project.startDate || '—'}  s.d.  ${project.targetEndDate || '—'}`, false);
    drawRow(477, 'Nilai Indikatif Proyek', rupiah, true);

    // Seksi 3: Verifikasi Dokumen
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 40 446 Td (${esc('3. STATUS KELENGKAPAN DOKUMEN SERAH TERIMA (WI-01 & PO)')}) Tj ET`);
    cmds.push('0.8 0.85 0.9 RG 1 w 40 439 m 555 439 l S');

    drawRow(411, 'Dokumen Standar WI-01', project.documentsComplete ? 'LENGKAP (RKS, SPK, Kontrak, KAK, SOW Terverifikasi)' : 'BELUM LENGKAP', true);
    drawRow(389, 'Status Dokumen PO Fisik', project.poReceived ? 'PO FISIK TERVERIFIKASI (Penagihan E-2 Terbuka)' : 'BELUM ADA PO FISIK (Penagihan E-2 Diblokir Sementara)', true);

    // Pernyataan Pengesahan
    cmds.push('0.94 0.97 1.0 rg');
    cmds.push('0.75 0.85 0.98 RG 0.8 w');
    cmds.push('40 315 515 52 re B');
    cmds.push('0.1 0.25 0.45 rg');
    cmds.push(`BT /F2 9 Tf 52 350 Td (${esc('PERNYATAAN PENGESAHAN SERAH TERIMA (HANDOVER):')}) Tj ET`);
    cmds.push(`BT /F1 8.5 Tf 52 336 Td (${esc('Dengan diterbitkannya Project Charter ini, proyek dinyatakan resmi terdaftar (REGISTERED) di dalam')}) Tj ET`);
    cmds.push(`BT /F1 8.5 Tf 52 324 Td (${esc('sistem ERP PT Anaheim Nimbus Universal dan wewenang pelaksanaan diserahkan kepada Project Manager.')}) Tj ET`);

    // Kotak Tanda Tangan
    cmds.push('0.90 0.92 0.95 RG 0.7 w');
    cmds.push('40 175 245 115 re S');
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8.5 Tf 55 272 Td (${esc('Diserahkan oleh (Inisiator Komersial):')}) Tj ET`);
    cmds.push('0.06 0.46 0.43 rg');
    cmds.push(`BT /F2 8 Tf 55 230 Td (${esc('[ TERTANDA SECARA DIGITAL - SISTEM ERP ]')}) Tj ET`);
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 55 198 Td (${esc(project.amName || 'Fikri Lazuardi Fadilla (AM)')}) Tj ET`);
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8 Tf 55 185 Td (${esc('Account Manager (AM)')}) Tj ET`);

    cmds.push('0.90 0.92 0.95 RG 0.7 w');
    cmds.push('310 175 245 115 re S');
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8.5 Tf 325 272 Td (${esc('Diterima & Disahkan oleh (Pelaksana):')}) Tj ET`);
    cmds.push('0.06 0.46 0.43 rg');
    cmds.push(`BT /F2 8 Tf 325 230 Td (${esc('[ DISETUJUI & DIREKONSILIASI - PM ]')}) Tj ET`);
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 325 198 Td (${esc(project.pmName || 'Sandy Walsh')}) Tj ET`);
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8 Tf 325 185 Td (${esc('Project Manager (PM)')}) Tj ET`);

    // Footer Dokumen
    cmds.push('0.85 0.88 0.92 RG 0.5 w 40 70 m 555 70 l S');
    cmds.push('0.55 0.60 0.68 rg');
    cmds.push(`BT /F1 8 Tf 40 55 Td (${esc('Dicetak otomatis oleh Modul D-1 (Project Intake) - PT Anaheim Nimbus Universal pada ' + tglCetak)}) Tj ET`);
    cmds.push(`BT /F2 8 Tf 485 55 Td (${esc('Halaman 1 / 1')}) Tj ET`);

    const streamContent = cmds.join('\n');
    const objects = [
      '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
      '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
      '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj\n',
      '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
      '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n',
      `6 0 obj\n<< /Length ${Buffer.byteLength(streamContent, 'utf8')} >>\nstream\n${streamContent}\nendstream\nendobj\n`
    ];

    let pdf = '%PDF-1.4\n';
    const offsets = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, 'utf8'));
      pdf += obj;
    }
    const xrefOffset = Buffer.byteLength(pdf, 'utf8');
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (let i = 1; i <= objects.length; i++) {
      pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    const pdfBuffer = Buffer.from(pdf, 'utf8');

    const fileName = `Project_Charter_${project.canonicalCode || project.projectId}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.status(200).send(pdfBuffer);
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 4. POST /api/v1/projects - Pendaftaran Draf Proyek Baru (UI-K01-02)
// ============================================================================
router.post('/projects', async (req, res) => {
  try {
    const {
      projectName,
      clientId,
      clientName,
      amEmployeeId,
      amName,
      pmEmployeeId,
      pmName,
      startDate,
      targetEndDate,
      indicativeValue
    } = req.body;

    if (!projectName || projectName.trim().length < 5) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Nama proyek wajib diisi minimal 5 karakter');
    }
    if (!startDate || !targetEndDate) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Tanggal estimasi mulai dan selesai wajib ditentukan');
    }
    if (new Date(targetEndDate) < new Date(startDate)) {
      return sendError(res, 400, 'VALIDATION_ERROR', 'Target tanggal selesai tidak boleh mendahului tanggal mulai');
    }

    const projectId = generateUuidV7();
    const logId = `LOG-${Date.now()}`;

    const newProject = await prisma.project.create({
      data: {
        projectId,
        canonicalCode: null, // Kode resmi diterbitkan saat disetujui (REGISTERED)
        projectName: projectName.trim(),
        clientId: clientId || 'CL-TEMP',
        clientName: clientName || clientId,
        amEmployeeId: amEmployeeId || '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
        amName: amName || 'Fikri Lazuardi Fadilla (AM)',
        pmEmployeeId: pmEmployeeId || '01929b4a-5f10-7a22-9d44-3c8f1b2e7a90',
        pmName: pmName || 'Sandy Walsh',
        startDate,
        targetEndDate,
        indicativeValue: Number(indicativeValue) || 0,
        documentsComplete: false,
        poReceived: false,
        status: 'DRAFT',
        auditLogs: {
          create: {
            auditLogId: logId,
            actorUserId: amEmployeeId || '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
            action: 'CREATE_DRAFT',
            details: 'Draf proyek dibuat oleh Account Manager (AM)',
            timestamp: new Date()
          }
        }
      },
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    res.status(201).json({
      message: 'Draf proyek berhasil disimpan',
      data: newProject
    });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 5. PUT /api/v1/projects/:projectId - Ubah Data Draf Proyek
// ============================================================================
router.put('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({ where: { projectId } });

    if (!project) {
      return sendError(res, 404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
    }
    if (project.status === 'REGISTERED') {
      return sendError(res, 400, 'IMMUTABLE_ERROR', 'Proyek yang telah REGISTERED tidak dapat diubah tanpa persetujuan COO');
    }

    const updated = await prisma.project.update({
      where: { projectId },
      data: {
        projectName: req.body.projectName?.trim() || project.projectName,
        clientId: req.body.clientId || project.clientId,
        clientName: req.body.clientName || project.clientName,
        pmEmployeeId: req.body.pmEmployeeId || project.pmEmployeeId,
        pmName: req.body.pmName || project.pmName,
        startDate: req.body.startDate || project.startDate,
        targetEndDate: req.body.targetEndDate || project.targetEndDate,
        indicativeValue: req.body.indicativeValue !== undefined ? Number(req.body.indicativeValue) : project.indicativeValue
      },
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    res.json({ message: 'Data proyek berhasil diperbarui', data: updated });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 6. POST /api/v1/projects/:projectId/handover - AM Mengajukan ke PM
// ============================================================================
router.post('/projects/:projectId/handover', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({ where: { projectId } });

    if (!project) {
      return sendError(res, 404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
    }

    const updated = await prisma.project.update({
      where: { projectId },
      data: {
        status: 'UNDER_REVIEW',
        auditLogs: {
          create: {
            auditLogId: `LOG-${Date.now()}`,
            actorUserId: project.amEmployeeId || '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
            action: 'HANDOVER',
            details: 'AM mengajukan berkas handover untuk peninjauan PM',
            timestamp: new Date()
          }
        }
      },
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    res.json({ message: 'Proyek berhasil diserahkan ke PM', data: updated });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 7. POST /api/v1/projects/:projectId/approve - PM Menyetujui & Registrasi Resmi
// ============================================================================
router.post('/projects/:projectId/approve', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findUnique({ where: { projectId } });

    if (!project) {
      return sendError(res, 404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
    }

    const yearPrefix = '2026';
    const allProjectsWithCode = await prisma.project.findMany({
      where: { canonicalCode: { startsWith: yearPrefix } },
      select: { canonicalCode: true }
    });

    let maxSeq = 0;
    for (const p of allProjectsWithCode) {
      if (p.canonicalCode && p.canonicalCode.length >= 6) {
        const seq = parseInt(p.canonicalCode.slice(4), 10);
        if (!Number.isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }

    const canonicalCode = project.canonicalCode || `${yearPrefix}${String(maxSeq + 1).padStart(2, '0')}`;

    const updated = await prisma.project.update({
      where: { projectId },
      data: {
        status: 'REGISTERED',
        canonicalCode,
        auditLogs: {
          create: {
            auditLogId: `LOG-${Date.now()}`,
            actorUserId: project.pmEmployeeId || '01929b4a-5f10-7a22-9d44-3c8f1b2e7a90',
            action: 'APPROVE',
            details: `PM menyetujui handover. Kode resmi ${canonicalCode} diterbitkan.`,
            timestamp: new Date()
          }
        }
      },
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    res.json({ message: 'Proyek berhasil disetujui & berstatus REGISTERED', data: updated });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 8. POST /api/v1/projects/:projectId/reject - PM Menolak Handover (Min. 20 Karakter)
// ============================================================================
router.post('/projects/:projectId/reject', async (req, res) => {
  try {
    const { projectId } = req.params;
    const rejectionReason = (req.body.notes || req.body.reason || '').trim();

    if (!rejectionReason || rejectionReason.length < 20) {
      return sendError(
        res,
        400,
        'VALIDATION_ERROR',
        'Catatan penolakan PM wajib diisi minimal 20 karakter'
      );
    }

    const project = await prisma.project.findUnique({ where: { projectId } });
    if (!project) {
      return sendError(res, 404, 'PROJECT_NOT_FOUND', 'Proyek tidak ditemukan');
    }

    const updated = await prisma.project.update({
      where: { projectId },
      data: {
        status: 'REVISI_HANDOVER',
        auditLogs: {
          create: {
            auditLogId: `LOG-${Date.now()}`,
            actorUserId: project.pmEmployeeId || '01929b4a-5f10-7a22-9d44-3c8f1b2e7a90',
            action: 'REJECT',
            details: rejectionReason,
            timestamp: new Date()
          }
        }
      },
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    res.json({ message: 'Handover dikembalikan ke AM untuk revisi', data: updated });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// ============================================================================
// 9. PATCH /api/v1/projects/:projectId/documents-status - Status WI-01 & PO
// ============================================================================
router.patch('/projects/:projectId/documents-status', async (req, res) => {
  try {
    const { projectId } = req.params;
    const dataToUpdate = {};

    if (typeof req.body.documentsComplete === 'boolean') {
      dataToUpdate.documentsComplete = req.body.documentsComplete;
    }
    if (typeof req.body.poReceived === 'boolean') {
      dataToUpdate.poReceived = req.body.poReceived;
    }

    const updated = await prisma.project.update({
      where: { projectId },
      data: dataToUpdate,
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    res.json({ message: 'Status kelengkapan berkas berhasil diperbarui', data: updated });
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

module.exports = router;