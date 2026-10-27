const crypto = require('crypto');

const PROJECT_STATUSES = Object.freeze([
  'DRAFT',
  'UNDER_REVIEW',
  'REVISI_HANDOVER',
  'REGISTERED'
]);

function assertProjectStatus(status) {
  if (!PROJECT_STATUSES.includes(status)) {
    throw new Error(`Status proyek tidak valid: ${status}`);
  }
  return status;
}

function getWIBTimestamp(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  return new Date(date.getTime() + 7 * 60 * 60 * 1000)
    .toISOString()
    .replace('Z', '+07:00');
}

async function generateNextCanonicalCode(prisma, year = new Date().getFullYear().toString()) {
  const latestProject = await prisma.project.findFirst({
    where: { canonicalCode: { startsWith: year } },
    orderBy: { canonicalCode: 'desc' },
    select: { canonicalCode: true }
  });
  const latestSequence = latestProject
    ? Number(latestProject.canonicalCode.slice(year.length))
    : 0;
  return `${year}${(latestSequence + 1).toString().padStart(2, '0')}`;
}

function uuidv7() {
  const bytes = crypto.randomBytes(16);
  const timestamp = BigInt(Date.now());

  for (let index = 5; index >= 0; index--) {
    bytes[index] = Number((timestamp >> BigInt((5 - index) * 8)) & 0xffn);
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x70;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function toCanonicalProject(project) {
  return {
    projectId: project.projectId,
    canonicalCode: project.canonicalCode || null,
    projectName: project.projectName,
    clientId: project.clientId,
    clientName: project.clientName,
    amEmployeeId: project.amEmployeeId || 'SDM-0012',
    pmEmployeeId: project.pmEmployeeId || 'SDM-0004',
    startDate: project.startDate,
    targetEndDate: project.targetEndDate,
    documentsComplete: typeof project.documentsComplete === 'boolean' ? project.documentsComplete : true,
    poReceived: typeof project.poReceived === 'boolean' ? project.poReceived : false,
    status: project.status || 'DRAFT',
    createdAt: getWIBTimestamp(project.createdAt || new Date()),
    updatedAt: getWIBTimestamp(project.updatedAt || new Date())
  };
}

module.exports = {
  PROJECT_STATUSES,
  assertProjectStatus,
  generateNextCanonicalCode,
  getWIBTimestamp,
  toCanonicalProject,
  uuidv7
};
