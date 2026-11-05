// public/js/api.js - Layanan Klien API Modul D1 & Integrasi F1/F2/F6
const API_BASE = '/api/v1';

async function request(path, options = {}) {
  // Ambil token JWT F1 dari localStorage jika sesi aktif
  const token = localStorage.getItem('token');
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...authHeaders,
      ...(options.headers || {})
    },
    ...options
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.message || `Permintaan gagal (${response.status})`);
    error.status = response.status;
    error.body = data;
    throw error;
  }
  return data;
}

// ============================================================================
// 1. AUTENTIKASI F1 (IDENTITAS & HAK AKSES)
// ============================================================================
export async function loginF1(emailOrUsername = 'account.manager', password = 'Password123!') {
  return request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ emailOrUsername, password })
  });
}

// ============================================================================
// 2. PROYEK KANONIS (MODUL D1)
// ============================================================================
export async function fetchProjects(params = {}) {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.limit) query.set('limit', String(params.limit));
  if (params.status && params.status !== 'ALL') query.set('status', params.status);
  if (params.q) query.set('q', params.q);
  const qs = query.toString();
  return request(`/projects${qs ? `?${qs}` : ''}`);
}

export async function fetchProjectById(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}`);
}

export async function fetchProjectIntakeDetail(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}/intake-detail`);
}
export async function createProject(payload) {
  return request('/projects', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
}

export async function updateProject(projectId, payload) {
  return request(`/projects/${encodeURIComponent(projectId)}`, {
    method: 'PUT',
    body: JSON.stringify(payload)
  });
}

export async function updateDocumentStatus(projectId, payload) {
  return request(`/projects/${encodeURIComponent(projectId)}/documents-status`, {
    method: 'PATCH',
    body: JSON.stringify(payload)
  });
}

export async function handoverProject(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}/handover`, {
    method: 'POST'
  });
}

export async function approveProject(projectId) {
  return request(`/projects/${encodeURIComponent(projectId)}/approve`, {
    method: 'POST'
  });
}

export async function rejectProject(projectId, notes) {
  return request(`/projects/${encodeURIComponent(projectId)}/reject`, {
    method: 'POST',
    body: JSON.stringify({ 
      notes: notes,
      reason: notes 
    })
  });
}

export function getProjectCharterUrl(projectId) {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/charter`;
}

// ============================================================================
// 3. INTEGRASI REFERENSI HULU (F6 CRM & F2 MASTER SDM)
// ============================================================================
export async function fetchClients() {
  return request('/clients');
}

export async function createTemporaryClient(companyName) {
  return request('/temporary-clients', {
    method: 'POST',
    body: JSON.stringify({ companyName })
  });
}

export async function fetchEmployees() {
  return request('/referensi/sdm');
}