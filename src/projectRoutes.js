// src/projectRoutes.js - Endpoint REST API Modul D-1 (Registrasi & Intake Proyek)
const express = require('express');
const router = express.Router();
const prisma = require('./prisma');
const crypto = require('crypto'); // Gunakan pustaka bawaan Node.js

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

// Format standar respons galat OpenAPI
const sendError = (res, statusCode, code, message, details = {}) => {
  return res.status(statusCode).json({ code, message, details });
};

// 1. GET /api/v1/projects - Koleksi Proyek (Dukungan Paging Konsumen E-2 & Dasbor)
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

    const [total, projects] = await Promise.all([
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
      data: projects,
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

// 2. GET /api/v1/projects/:projectId - Detail Proyek Kanonis (API-K01-07)
router.get('/projects/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const project = await prisma.project.findFirst({
      where: {
        OR: [
          { projectId: projectId },
          { canonicalCode: projectId }
        ]
      },
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    if (!project) {
      return sendError(
        res,
        404,
        'PROJECT_NOT_FOUND',
        `Data proyek dengan ID/Kode ${projectId} tidak ditemukan di sistem intake`,
        { requestedProjectId: projectId }
      );
    }

    res.json(project);
  } catch (err) {
    sendError(res, 500, 'INTERNAL_SERVER_ERROR', err.message);
  }
});

// GET /api/v1/projects/:projectId/charter - Unduh Berkas PDF Project Charter Bergaya Profesional
router.get('/projects/:projectId/charter', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { projectId }
    });

    if (!project) {
      return res.status(404).json({ code: 'PROJECT_NOT_FOUND', message: 'Proyek tidak ditemukan' });
    }

    if (project.status !== 'REGISTERED') {
      return res.status(400).json({
        code: 'INVALID_STATUS',
        message: 'Project Charter hanya dapat diterbitkan untuk proyek yang telah berstatus REGISTERED'
      });
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

    // Helper menggambar teks dan komponen grafis PDF
    const cmds = [];

    // 1. KOTAK HEADER ATAS (Navy Gelap #0b1324)
    cmds.push('0.043 0.075 0.141 rg'); // Warna isi Navy
    cmds.push('40 735 515 65 re f');

    // Teks di dalam Header Navy
    cmds.push('1 1 1 rg'); // Teks Putih
    cmds.push(`BT /F1 8 Tf 55 782 Td (${esc('PT ANAHEIM NIMBUS UNIVERSAL  |  ENTERPRISE RESOURCE PLANNING')}) Tj ET`);
    cmds.push(`BT /F2 15 Tf 55 762 Td (${esc('LEMBAR PENGESAHAN PROJECT CHARTER')}) Tj ET`);
    cmds.push('0.7 0.8 0.9 rg');
    cmds.push(`BT /F1 8 Tf 55 747 Td (${esc('Dokumen Otorisasi & Serah Terima Proyek Kanonis (Modul D-1 Project Intake)')}) Tj ET`);

    // Badge Kode Proyek di Kanan Header
    cmds.push('0.06 0.46 0.43 rg'); // Hijau Emerald
    cmds.push('440 752 100 32 re f');
    cmds.push('1 1 1 rg');
    cmds.push(`BT /F1 7 Tf 452 771 Td (${esc('STATUS: REGISTERED')}) Tj ET`);
    cmds.push(`BT /F2 12 Tf 452 757 Td (${esc('KODE ' + (project.canonicalCode || '-'))}) Tj ET`);

    // 2. SEKSI 1: IDENTITAS UTAMA PROYEK
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 40 710 Td (${esc('1. IDENTITAS UTAMA PROYEK')}) Tj ET`);
    cmds.push('0.8 0.85 0.9 RG 1 w 40 703 m 555 703 l S'); // Garis bawah judul seksi

    const drawRow = (y, label, value, isBoldVal = false) => {
      // Latar selang-seling tipis
      cmds.push('0.97 0.98 0.99 rg');
      cmds.push(`40 ${y - 6} 165 22 re f`);
      // Garis pembatas baris
      cmds.push('0.90 0.92 0.95 RG 0.5 w');
      cmds.push(`40 ${y - 6} 515 22 re S`);
      // Label kiri
      cmds.push('0.39 0.45 0.55 rg');
      cmds.push(`BT /F2 9 Tf 48 ${y + 2} Td (${esc(label)}) Tj ET`);
      // Nilai kanan
      cmds.push('0.06 0.09 0.16 rg');
      cmds.push(`BT /${isBoldVal ? 'F2' : 'F1'} 9.5 Tf 215 ${y + 2} Td (${esc(value)}) Tj ET`);
    };

    drawRow(675, 'Nama Proyek', project.projectName, true);
    drawRow(653, 'Kode Kanonis Resmi', project.canonicalCode || '—', true);
    drawRow(631, 'ID Unik Proyek (UUID v7)', project.projectId, false);
    drawRow(609, 'Instansi Klien Pemesan', `${project.clientName || '—'} (${project.clientId || '—'})`, false);

    // 3. SEKSI 2: PARAMETER KOMERSIAL & KEWENANGAN
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 40 578 Td (${esc('2. PARAMETER ADMINISTRATIF, KOMERSIAL & PENANGGUNG JAWAB')}) Tj ET`);
    cmds.push('0.8 0.85 0.9 RG 1 w 40 571 m 555 571 l S');

    drawRow(543, 'Account Manager (AM)', `${project.amName || 'Andi Maulana'}`, false);
    drawRow(521, 'Project Manager (PM)', `${project.pmName || 'Budi Santoso'}`, true);
    drawRow(499, 'Estimasi Periode Proyek', `${project.startDate || '—'}  s.d.  ${project.targetEndDate || '—'}`, false);
    drawRow(477, 'Nilai Indikatif Proyek', rupiah, true);

    // 4. SEKSI 3: VERIFIKASI DOKUMEN ACUAN KERJA (WI-01 & PO)
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 40 446 Td (${esc('3. STATUS KELENGKAPAN DOKUMEN SERAH TERIMA (WI-01 & PO)')}) Tj ET`);
    cmds.push('0.8 0.85 0.9 RG 1 w 40 439 m 555 439 l S');

    drawRow(411, 'Dokumen Standar WI-01', project.documentsComplete ? 'LENGKAP (RKS, SPK, Kontrak, KAK, SOW Terverifikasi)' : 'BELUM LENGKAP', true);
    drawRow(389, 'Status Dokumen PO Fisik', project.poReceived ? 'PO FISIK TERVERIFIKASI (Penagihan E-2 Terbuka)' : 'BELUM ADA PO FISIK (Penagihan E-2 Diblokir Sementara)', true);

    // 5. KOTAK PERNYATAAN OTORISASI
    cmds.push('0.94 0.97 1.0 rg'); // Biru sangat muda
    cmds.push('0.75 0.85 0.98 RG 0.8 w');
    cmds.push('40 315 515 52 re B');

    cmds.push('0.1 0.25 0.45 rg');
    cmds.push(`BT /F2 9 Tf 52 350 Td (${esc('PERNYATAAN PENGESAHAN SERAH TERIMA (HANDOVER):')}) Tj ET`);
    cmds.push(`BT /F1 8.5 Tf 52 336 Td (${esc('Dengan diterbitkannya Project Charter ini, proyek dinyatakan resmi terdaftar (REGISTERED) di dalam')}) Tj ET`);
    cmds.push(`BT /F1 8.5 Tf 52 324 Td (${esc('sistem ERP PT Anaheim Nimbus Universal dan wewenang pelaksanaan diserahkan kepada Project Manager.')}) Tj ET`);

    // 6. KOTAK TANDA TANGAN PARA PIHAK
    // Kotak Kiri (AM)
    cmds.push('0.90 0.92 0.95 RG 0.7 w');
    cmds.push('40 175 245 115 re S');
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8.5 Tf 55 272 Td (${esc('Diserahkan oleh (Inisiator Komersial):')}) Tj ET`);
    cmds.push('0.06 0.46 0.43 rg');
    cmds.push(`BT /F2 8 Tf 55 230 Td (${esc('[ TERTANDA SECARA DIGITAL - SISTEM ERP ]')}) Tj ET`);
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 55 198 Td (${esc(project.amName || 'Andi Maulana')}) Tj ET`);
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8 Tf 55 185 Td (${esc('Account Manager (AM)')}) Tj ET`);

    // Kotak Kanan (PM)
    cmds.push('0.90 0.92 0.95 RG 0.7 w');
    cmds.push('310 175 245 115 re S');
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8.5 Tf 325 272 Td (${esc('Diterima & Disahkan oleh (Pelaksana):')}) Tj ET`);
    cmds.push('0.06 0.46 0.43 rg');
    cmds.push(`BT /F2 8 Tf 325 230 Td (${esc('[ DISETUJUI & DIREKONSILIASI - PM ]')}) Tj ET`);
    cmds.push('0.06 0.09 0.16 rg');
    cmds.push(`BT /F2 10 Tf 325 198 Td (${esc(project.pmName || 'Budi Santoso')}) Tj ET`);
    cmds.push('0.39 0.45 0.55 rg');
    cmds.push(`BT /F1 8 Tf 325 185 Td (${esc('Project Manager (PM)')}) Tj ET`);

    // 7. FOOTER DOKUMEN
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
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// 3. POST /api/v1/projects - Pendaftaran Draf Proyek Baru (UI-K01-02)
router.post('/projects', async (req, res) => {
  try {
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

    if (!projectName || projectName.trim().length < 5) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Nama proyek wajib diisi minimal 5 karakter' });
    }
    if (!startDate || !targetEndDate) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Tanggal estimasi mulai dan selesai wajib ditentukan' });
    }
    if (new Date(targetEndDate) < new Date(startDate)) {
      return res.status(400).json({ code: 'VALIDATION_ERROR', message: 'Target tanggal selesai tidak boleh mendahului tanggal mulai' });
    }

    const projectId = generateUuidV7();
    const logId = `LOG-${Date.now()}`;

    const newProject = await prisma.project.create({
      data: {
        projectId,
        canonicalCode: null, // Kode kanonis resmi diterbitkan saat REGISTERED
        projectName: projectName.trim(),
        clientId: clientId || 'CL-TEMP',
        clientName: clientName || clientId,
        amEmployeeId: 'SDM-0012',
        amName: 'Andi Maulana',
        pmEmployeeId: pmEmployeeId || 'SDM-0004',
        pmName: pmName || 'Budi Santoso',
        startDate,
        targetEndDate,
        indicativeValue: Number(indicativeValue) || 0,
        documentsComplete: false,
        poReceived: false,
        status: 'DRAFT',
        auditLogs: {
          create: {
            auditLogId: logId,
            actorUserId: 'SDM-0012',
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
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// 4. PUT /api/v1/projects/:projectId - Ubah Data Draf Proyek
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

// 5. POST /api/v1/projects/:projectId/handover - AM Mengajukan Serah Terima ke PM
router.post('/projects/:projectId/handover', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({ where: { projectId } });
    if (!project) {
      return res.status(404).json({ code: 'PROJECT_NOT_FOUND', message: 'Proyek tidak ditemukan' });
    }

    const updated = await prisma.project.update({
      where: { projectId },
      data: {
        status: 'UNDER_REVIEW',
        auditLogs: {
          create: {
            auditLogId: `LOG-${Date.now()}`,
            actorUserId: 'SDM-0012',
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
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// 6. POST /api/v1/projects/:projectId/approve - PM Menyetujui & Registrasi Resmi Proyek
// POST /projects/:projectId/approve - Persetujuan Penerimaan Handover oleh PM
router.post('/projects/:projectId/approve', async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({ where: { projectId } });
    if (!project) {
      return res.status(404).json({ code: 'PROJECT_NOT_FOUND', message: 'Proyek tidak ditemukan' });
    }

    // Ambil nomor urut tertinggi dari kode yang sudah ada untuk menghindari benturan nomor
    const yearPrefix = '2026';
    const allProjectsWithCode = await prisma.project.findMany({
      where: {
        canonicalCode: {
          startsWith: yearPrefix
        }
      },
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

    // Jika proyek sudah memiliki kode (misal saat revisi), gunakan kode tersebut; jika belum, terbitkan nomor urut baru
    const canonicalCode = project.canonicalCode || `${yearPrefix}${String(maxSeq + 1).padStart(2, '0')}`;

    const updated = await prisma.project.update({
      where: { projectId },
      data: {
        status: 'REGISTERED',
        canonicalCode,
        auditLogs: {
          create: {
            auditLogId: `LOG-${Date.now()}`,
            actorUserId: project.pmEmployeeId || 'SDM-0004',
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
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// 7. POST /api/v1/projects/:projectId/reject - PM Menolak Handover (Wajib Min. 20 Karakter)
// POST /projects/:projectId/reject - Penolakan Handover oleh PM
router.post('/projects/:projectId/reject', async (req, res) => {
  try {
    const { projectId } = req.params;
    // Baca 'notes' atau fallback ke 'reason'
    const rejectionReason = (req.body.notes || req.body.reason || '').trim();

    if (!rejectionReason || rejectionReason.length < 20) {
      return res.status(400).json({
        code: 'VALIDATION_ERROR',
        message: 'Catatan penolakan PM wajib diisi minimal 20 karakter'
      });
    }

    const project = await prisma.project.findUnique({ where: { projectId } });
    if (!project) {
      return res.status(404).json({ code: 'PROJECT_NOT_FOUND', message: 'Proyek tidak ditemukan' });
    }

    const updated = await prisma.project.update({
      where: { projectId },
      data: {
        status: 'REVISI_HANDOVER',
        // Update audit log sesuai skema Prisma
        auditLogs: {
          create: {
            auditLogId: `LOG-${Date.now()}`,
            actorUserId: project.pmEmployeeId || 'SDM-0004',
            action: 'REJECT',
            details: rejectionReason,
            timestamp: new Date()
          }
        }
      },
      include: { auditLogs: { orderBy: { timestamp: 'desc' } } }
    });

    res.json({
      message: 'Handover dikembalikan ke AM untuk revisi',
      data: updated
    });
  } catch (err) {
    res.status(500).json({ code: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
});

// 8. PATCH /api/v1/projects/:projectId/documents-status - Perbarui Status WI-01 & PO
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