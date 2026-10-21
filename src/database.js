// src/database.js - Lapisan Akses Data Fisik D-1
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_FILE = path.join(__dirname, '../data/db.json');

// Membaca file database lokal
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    return { projects: [], temporary_clients: [], project_documents: [], project_audit_logs: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (err) {
    return { projects: [], temporary_clients: [], project_documents: [], project_audit_logs: [] };
  }
}

// Menulis pembaruan data ke disk secara persisten
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// Generator Nomor Kanonis Resmi Tahunan YYYYXX (Keputusan Mitra Q-02)
function generateNextCanonicalCode(projects) {
  const currentYear = new Date().getFullYear().toString();
  const yearly = projects.filter(p => p.canonicalCode && p.canonicalCode.startsWith(currentYear));
  const nextSeq = yearly.length + 1;
  return `${currentYear}${nextSeq.toString().padStart(2, '0')}`;
}

module.exports = {
  readDB,
  writeDB,
  generateNextCanonicalCode
};