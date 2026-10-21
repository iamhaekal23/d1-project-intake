// public/js/api.js - Service Panggilan REST API Modul D-1 & Mock Hulu
const API_BASE = '/api/v1';

export const ProjectAPI = {
  // 1. Ambil daftar proyek dari backend (untuk Dasbor UI-K01-01)
  async getProjects() {
    const res = await fetch(`${API_BASE}/projects`);
    if (!res.ok) throw new Error('Gagal mengambil daftar proyek');
    return await res.json();
  },

  // 2. Registrasi draf proyek baru (API-K01-01)
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

  // 3. Ambil data master PM dari referensi SDM (F-2)
  async getPMReferences() {
    const res = await fetch(`${API_BASE}/referensi/sdm`);
    if (!res.ok) throw new Error('Gagal memuat master PM');
    const data = await res.json();
    return data.items || [];
  },

  // 4. Ambil master instansi klien dari CRM (F-6)
  async getClients() {
    const res = await fetch(`${API_BASE}/clients`);
    if (!res.ok) throw new Error('Gagal memuat master Klien');
    const data = await res.json();
    return data.data || [];
  },

  // 5. Simpan draf klien mandiri sementara (ENT-K01-04)
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