const fs = require('fs');
const path = require('path');
const prisma = require('../src/prisma');
const { assertProjectStatus } = require('../src/database');

const dbPath = path.join(__dirname, '../data/db.json');

function asDate(value, label) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Timestamp tidak valid untuk ${label}: ${value}`);
  }
  return date;
}

async function seed() {
  const oldData = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

  for (const project of oldData.projects || []) {
    const data = {
      projectId: project.projectId,
      canonicalCode: project.canonicalCode || null,
      projectName: project.projectName,
      clientId: project.clientId,
      clientName: project.clientName || null,
      amEmployeeId: project.amEmployeeId || 'SDM-0012',
      amName: project.amName || null,
      pmEmployeeId: project.pmEmployeeId || null,
      pmName: project.pmName || null,
      startDate: project.startDate,
      targetEndDate: project.targetEndDate,
      indicativeValue: Number(project.indicativeValue) || 0,
      status: assertProjectStatus(project.status || 'DRAFT'),
      poReceived: Boolean(project.poReceived),
      documentsComplete: Boolean(project.documentsComplete),
      rejectionNotes: project.rejectionNotes || null,
      createdAt: asDate(project.createdAt, `Project ${project.projectId}.createdAt`),
      updatedAt: asDate(project.updatedAt, `Project ${project.projectId}.updatedAt`)
    };
    await prisma.project.upsert({
      where: { projectId: data.projectId },
      create: data,
      update: data
    });
  }

  const projectIds = new Set(
    (await prisma.project.findMany({ select: { projectId: true } }))
      .map(project => project.projectId)
  );
  for (const log of oldData.project_audit_logs || []) {
    if (!projectIds.has(log.projectId)) {
      console.warn(`[Seed] Lewati audit log ${log.logId}: projectId ${log.projectId} tidak ditemukan`);
      continue;
    }
    const data = {
      auditLogId: log.logId,
      projectId: log.projectId,
      actorUserId: log.actorId,
      action: log.action,
      details: log.details || '',
      timestamp: asDate(log.timestamp, `Audit log ${log.logId}.timestamp`)
    };
    await prisma.projectAuditLog.upsert({
      where: { auditLogId: data.auditLogId },
      create: data,
      update: data
    });
  }

  for (const document of oldData.project_documents || []) {
    if (!projectIds.has(document.projectId)) {
      console.warn(`[Seed] Lewati dokumen ${document.documentId}: projectId ${document.projectId} tidak ditemukan`);
      continue;
    }
    const data = {
      documentId: document.documentId,
      projectId: document.projectId,
      documentType: document.documentType,
      fileTitle: document.fileTitle,
      fileUri: document.fileUri,
      mimeType: document.mimeType,
      fileSizeBytes: document.fileSizeBytes,
      uploadedBy: document.uploadedBy,
      uploadedAt: document.uploadedAt
        ? asDate(document.uploadedAt, `Document ${document.documentId}.uploadedAt`)
        : undefined
    };
    await prisma.projectDocument.upsert({
      where: { documentId: data.documentId },
      create: data,
      update: data
    });
  }

  for (const client of oldData.temporary_clients || []) {
    const data = {
      tempClientId: client.tempClientId,
      companyName: client.companyName,
      syncStatus: 'PENDING',
      createdAt: client.createdAt
        ? asDate(client.createdAt, `Temporary client ${client.tempClientId}.createdAt`)
        : undefined
    };
    await prisma.temporaryClient.upsert({
      where: { tempClientId: data.tempClientId },
      create: data,
      update: data
    });
  }

  console.log(`[Seed] Berhasil mengimpor ${oldData.projects?.length || 0} proyek dari data/db.json`);
}

seed()
  .catch(error => {
    console.error('[Seed] Gagal mengimpor data:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
