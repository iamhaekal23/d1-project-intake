// server.js - Entry Point Aplikasi Modul D-1
const express = require('express');
const cors = require('cors');
const path = require('path');

const mockService = require('./src/mockService');
const projectRoutes = require('./src/projectRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware Global
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Pemasangan Rute API
app.use('/api/v1', mockService);
app.use('/api/v1', projectRoutes);

app.use((err, req, res, next) => {
  console.error('[API] Gagal memproses permintaan:', err);
  if (res.headersSent) return next(err);
  return res.status(500).json({
    code: 'INTERNAL_SERVER_ERROR',
    message: 'Terjadi kesalahan internal'
  });
});

// Server Listen
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Aplikasi D-1 Project Intake Aktif di Port ${PORT}`);
  console.log(`🔗 Web UI Dasbor : http://localhost:${PORT}`);
  console.log(`📦 REST API Proyek: http://localhost:${PORT}/api/v1/projects`);
  console.log(`====================================================`);
});