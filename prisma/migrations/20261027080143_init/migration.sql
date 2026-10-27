-- CreateTable
CREATE TABLE "Project" (
    "projectId" TEXT NOT NULL PRIMARY KEY,
    "canonicalCode" TEXT,
    "projectName" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientName" TEXT,
    "amEmployeeId" TEXT NOT NULL,
    "amName" TEXT,
    "pmEmployeeId" TEXT,
    "pmName" TEXT,
    "startDate" TEXT NOT NULL,
    "targetEndDate" TEXT NOT NULL,
    "indicativeValue" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "poReceived" BOOLEAN NOT NULL DEFAULT false,
    "documentsComplete" BOOLEAN NOT NULL DEFAULT false,
    "rejectionNotes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ProjectDocument" (
    "documentId" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileTitle" TEXT NOT NULL,
    "fileUri" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectDocument_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectAuditLog" (
    "auditLogId" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "actorUserId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectAuditLog_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("projectId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TemporaryClient" (
    "tempClientId" TEXT NOT NULL PRIMARY KEY,
    "companyName" TEXT NOT NULL,
    "syncStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_canonicalCode_key" ON "Project"("canonicalCode");

-- CreateIndex
CREATE INDEX "Project_status_idx" ON "Project"("status");

-- CreateIndex
CREATE INDEX "ProjectDocument_projectId_idx" ON "ProjectDocument"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAuditLog_projectId_idx" ON "ProjectAuditLog"("projectId");
