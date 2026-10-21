// src/database.js - Akses Basis Data Fisik & Serializer Kanonis D-1
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../data/db.json');

// Membaca isi basis data fisik db.json
function readDB() {
  try {
    if (!fs.existsSync(DB_PATH)) {
      return { projects: [], temporary_clients: [], project_audit_logs: [] };
    }
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('[Database] Gagal membaca db.json:', err.message);
    return { projects: [], temporary_clients: [], project_audit_logs: [] };
  }
}

// Menyimpan pembaruan ke basis data fisik db.json
function writeDB(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Database] Gagal menulis ke db.json:', err.message);
  }
}

// Menghasilkan timestamp ISO 8601 dengan offset WIB UTC+7 (contoh: 2026-10-21T22:00:00+07:00)
function getWIBTimestamp() {
  const now = new Date();
  const wibTime = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  const iso = wibTime.toISOString().replace('Z', '+07:00');
  return iso;
}

// Generator nomor kode kanonis tahunan urut format YYYYXX (Keputusan Q-02)
function generateNextCanonicalCode(existingProjects = []) {
  const currentYear = new Date().getFullYear().toString();
  const yearProjects = existingProjects.filter(p => 
    p.canonicalCode && p.canonicalCode.startsWith(currentYear)
  );
  const nextSeq = yearProjects.length + 1;
  return `${currentYear}${nextSeq.toString().padStart(2, '0')}`;
}

// Serializer Kanonis Resmi (API-K01-07): Menyaring atribut sensitif (indicativeValue)
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
    createdAt: project.createdAt || getWIBTimestamp(),
    updatedAt: project.updatedAt || getWIBTimestamp()
  };
}

module.exports = {
  readDB,
  writeDB,
  getWIBTimestamp,
  generateNextCanonicalCode,
  toCanonicalProject
};