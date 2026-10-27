const express = require('express');
const router = express.Router();
const prisma = require('./prisma');
const asyncHandler = require('./asyncHandler');
const {
  assertProjectStatus,
  generateNextCanonicalCode,
  getWIBTimestamp,
  toCanonicalProject,
  uuidv7
} = require('./database');

const ACTOR_USER_ID = '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1';

function findProjectWhere(projectId) {
  return {
    OR: [
      { projectId },
      { canonicalCode: projectId }
    ]
  };
}

function notFound(projectId, withDetails = false) {
  const body = {
    code: 'PROJECT_NOT_FOUND',
    message: withDetails
      ? `Data proyek dengan ID ${projectId} tidak ditemukan di sistem intake`
      : `Proyek ${projectId} tidak ditemukan`
  };
  if (withDetails) body.details = { requestedProjectId: projectId };
  return body;
}

function projectForCreateResponse(project) {
  return {
    ...project,
    createdAt: getWIBTimestamp(project.createdAt),
    updatedAt: getWIBTimestamp(project.updatedAt)
  };
}

async function updateProjectAndLog(project, status, action, details, extraData = {}) {
  assertProjectStatus(status);
  return prisma.$transaction(async transaction => {
    const updatedProject = await transaction.project.update({
      where: { projectId: project.projectId },
      data: { status, ...extraData }
    });
    await transaction.projectAuditLog.create({
      data: {
        auditLogId: uuidv7(),
        projectId: project.projectId,
        actorUserId: ACTOR_USER_ID,
        action,
        details
      }
    });
    return updatedProject;
  });
}

router.get('/projects', asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 3);
  const where = {};

  if (req.query.status && req.query.status !== 'ALL') {
    where.status = req.query.status;
  }
  if (req.query.q) {
    const keyword = String(req.query.q);
    where.OR = [
      { projectName: { contains: keyword } },
      { canonicalCode: { contains: keyword } },
      { clientName: { contains: keyword } }
    ];
  }

  const [total, projects] = await prisma.$transaction([
    prisma.project.count({ where }),
    prisma.project.findMany({
      where,
      orderBy: { canonicalCode: 'desc' },
      skip: (page - 1) * limit,
      take: limit
    })
  ]);
  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    data: projects.map(toCanonicalProject),
    meta: { page, limit, total, totalPages }
  });
}));

router.get('/projects/:projectId', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findFirst({ where: findProjectWhere(projectId) });

  if (!project) {
    return res.status(404).json(notFound(projectId, true));
  }
  return res.status(200).json(toCanonicalProject(project));
}));

router.post('/projects', asyncHandler(async (req, res) => {
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

  if (typeof projectName !== 'string' || projectName.trim().length < 5) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Nama proyek wajib diisi minimal 5 karakter',
      details: { field: 'projectName' }
    });
  }
  if (!startDate || !targetEndDate) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Estimasi tanggal mulai dan selesai wajib ditentukan',
      details: { field: 'dates' }
    });
  }
  if (new Date(targetEndDate) < new Date(startDate)) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Target selesai tidak boleh mendahului tanggal mulai proyek',
      details: { field: 'targetEndDate' }
    });
  }

  const canonicalCode = await generateNextCanonicalCode(prisma);
  const now = new Date();
  const project = await prisma.$transaction(async transaction => {
    const createdProject = await transaction.project.create({
      data: {
        projectId: uuidv7(),
        canonicalCode,
        projectName: projectName.trim(),
        clientId: clientId || 'PTANTRI',
        clientName: clientName || 'PT Anaheim Nimbus Universal',
        amEmployeeId: ACTOR_USER_ID,
        amName: 'Andi Maulana',
        pmEmployeeId: pmEmployeeId || 'SDM-0004',
        pmName: pmName || 'Budi Santoso, M.T.',
        startDate,
        targetEndDate,
        indicativeValue: Number(indicativeValue) || 0,
        documentsComplete: true,
        poReceived: false,
        status: assertProjectStatus('DRAFT'),
        createdAt: now
      }
    });
    await transaction.projectAuditLog.create({
      data: {
        auditLogId: uuidv7(),
        projectId: createdProject.projectId,
        actorUserId: ACTOR_USER_ID,
        action: 'CREATE_DRAFT',
        details: `Draf proyek terdaftar dengan kode kanonis ${canonicalCode}`
      }
    });
    return createdProject;
  });

  return res.status(201).json({
    message: 'Draf proyek berhasil didaftarkan',
    data: projectForCreateResponse(project)
  });
}));

router.post('/projects/:projectId/handover', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findFirst({ where: findProjectWhere(projectId) });
  if (!project) return res.status(404).json(notFound(projectId));

  const updatedProject = await updateProjectAndLog(
    project,
    'UNDER_REVIEW',
    'SUBMIT_REVIEW',
    `Proyek ${project.canonicalCode || project.projectId} diajukan untuk review PM`
  );
  return res.status(200).json({
    message: 'Proyek berhasil diajukan untuk review PM',
    data: toCanonicalProject(updatedProject)
  });
}));

router.post('/projects/:projectId/approve', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const project = await prisma.project.findFirst({ where: findProjectWhere(projectId) });
  if (!project) return res.status(404).json(notFound(projectId));

  const updatedProject = await updateProjectAndLog(
    project,
    'REGISTERED',
    'APPROVE_HANDOVER',
    `Serah terima proyek ${project.canonicalCode || project.projectId} disetujui`
  );
  return res.status(200).json({
    message: 'Proyek disetujui dan berstatus REGISTERED',
    data: toCanonicalProject(updatedProject)
  });
}));

router.post('/projects/:projectId/reject', asyncHandler(async (req, res) => {
  const { projectId } = req.params;
  const { rejectionNotes } = req.body;

  if (typeof rejectionNotes !== 'string' || rejectionNotes.trim().length < 20) {
    return res.status(400).json({
      code: 'VALIDATION_ERROR',
      message: 'Catatan revisi PM wajib diisi minimal 20 karakter',
      details: { field: 'rejectionNotes' }
    });
  }

  const project = await prisma.project.findFirst({ where: findProjectWhere(projectId) });
  if (!project) return res.status(404).json(notFound(projectId));

  const notes = rejectionNotes.trim();
  const updatedProject = await updateProjectAndLog(
    project,
    'REVISI_HANDOVER',
    'REJECT_REVISION',
    notes,
    { rejectionNotes: notes }
  );
  return res.status(200).json({
    message: 'Serah terima proyek ditolak untuk revisi',
    data: toCanonicalProject(updatedProject)
  });
}));

module.exports = router;
