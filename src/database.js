const crypto = require('crypto');

const VALID_PROJECT_STATUSES = ['DRAFT', 'UNDER_REVIEW', 'REVISI_HANDOVER', 'REGISTERED'];

function assertProjectStatus(status) {
  if (!VALID_PROJECT_STATUSES.includes(status)) {
    throw new Error(`Status proyek tidak valid: ${status}`);
  }
  return status;
}

function uuidv7() {
  const now = BigInt(Date.now());
  const timeHex = now.toString(16).padStart(12, '0');
  const randA = crypto.randomBytes(2).toString('hex');
  const randB = crypto.randomBytes(8).toString('hex');
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8, 12)}-7${randA.slice(1, 4)}-8${randB.slice(1, 4)}-${randB.slice(4, 16)}`;
}

function getWIBTimestamp(dateInput = new Date()) {
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000);
  return wib.toISOString().replace(/\.\d{3}Z$/, '+07:00');
}

async function generateNextCanonicalCode(prisma) {
  const yearPrefix = new Date().getFullYear().toString();
  const projects = await prisma.project.findMany({
    where: {
      canonicalCode: {
        startsWith: yearPrefix
      }
    },
    select: { canonicalCode: true }
  });

  let maxSeq = 0;
  for (const p of projects) {
    if (p.canonicalCode && p.canonicalCode.length >= 6) {
      const seq = parseInt(p.canonicalCode.slice(4), 10);
      if (!Number.isNaN(seq) && seq > maxSeq) {
        maxSeq = seq;
      }
    }
  }
  const nextSeq = maxSeq + 1;
  return `${yearPrefix}${String(nextSeq).padStart(2, '0')}`;
}

function toCanonicalProject(project) {
  const result = {
    projectId: project.projectId,
    canonicalCode: project.canonicalCode || null,
    projectName: project.projectName,
    clientId: project.clientId,
    clientName: project.clientName || project.clientId,
    amEmployeeId: project.amEmployeeId || '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
    amName: project.amName || 'Andi Maulana',
    pmEmployeeId: project.pmEmployeeId || 'SDM-0004',
    pmName: project.pmName || 'Budi Santoso, M.T.',
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    indicativeValue: Number(project.indicativeValue ?? 0),
    documentsComplete: typeof project.documentsComplete === 'boolean' ? project.documentsComplete : true,
    poReceived: typeof project.poReceived === 'boolean' ? project.poReceived : false,
    status: project.status || 'DRAFT',
    rejectionNotes: project.rejectionNotes || null,
    createdAt: getWIBTimestamp(project.createdAt || new Date()),
    updatedAt: getWIBTimestamp(project.updatedAt || new Date())
  };

  if (Array.isArray(project.auditLogs)) {
    result.auditLogs = project.auditLogs.map(log => ({
      auditLogId: log.auditLogId,
      action: log.action,
      actorUserId: log.actorUserId,
      details: log.details,
      timestamp: getWIBTimestamp(log.timestamp)
    }));
  }

  return result;
}

module.exports = {
  VALID_PROJECT_STATUSES,
  assertProjectStatus,
  uuidv7,
  getWIBTimestamp,
  generateNextCanonicalCode,
  toCanonicalProject
};
