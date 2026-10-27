// public/js/api.js - Panggilan REST API Modul D-1
const API_BASE = '/api/v1';

export const ProjectAPI = {
  // Ambil daftar proyek kanonis (mendukung struktur pembungkus data & meta)
  async getProjects() {
    const res = await fetch(`${API_BASE}/projects?page=1&limit=100`);
    if (!res.ok) throw new Error('Gagal mengambil daftar proyek');
    const result = await res.json();
    return Array.isArray(result) ? result : (result.data || []);
  },

  // Simpan draf proyek baru
  async createProject(payload) {
    const res = await fetch(`${API_BASE}/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer mock-jwt-token-f1-account-manager-2026'
      },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (!res.ok) throw result;
    return result;
  },

  async handoverProject(projectId) {
    return this.postProjectAction(projectId, 'handover');
  },

  async approveProject(projectId) {
    return this.postProjectAction(projectId, 'approve');
  },

  async rejectProject(projectId, rejectionNotes) {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rejectionNotes })
    });
    const result = await res.json();
    if (!res.ok) throw result;
    return result;
  },

  async postProjectAction(projectId, action) {
    const res = await fetch(`${API_BASE}/projects/${encodeURIComponent(projectId)}/${action}`, {
      method: 'POST'
    });
    const result = await res.json();
    if (!res.ok) throw result;
    return result;
  },

  // Ambil data PM (dari adapter F-2)
  async getPMReferences() {
    const res = await fetch(`${API_BASE}/referensi/sdm`);
    if (!res.ok) throw new Error('Gagal memuat master PM');
    const data = await res.json();
    return data.items || [];
  },

  // Ambil data Klien (dari adapter F-6)
  async getClients() {
    const res = await fetch(`${API_BASE}/clients`);
    if (!res.ok) throw new Error('Gagal memuat master Klien');
    const data = await res.json();
    return data.data || [];
  },

  // Tambah draf klien sementara (Q-09)
  async addTemporaryClient(companyName) {
    const res = await fetch(`${API_BASE}/temporary-clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyName })
    });
    const result = await res.json();
    if (!res.ok) throw result;
    return result;
  }
};