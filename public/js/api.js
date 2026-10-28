const API_BASE = '/api/v1';

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
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
  const res = await fetch(`/api/v1/projects/${projectId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      notes: notes,
      reason: notes 
    })
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || 'Gagal menolak handover proyek');
  }
  return data;
}

export function getProjectCharterUrl(projectId) {
  return `${API_BASE}/projects/${encodeURIComponent(projectId)}/charter`;
}

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
