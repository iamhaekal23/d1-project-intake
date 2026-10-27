// public/js/app.js - State Manager & Kontrol Antarmuka Pengguna
import { ProjectAPI } from './api.js';

// State Global Aplikasi
let projects = [];
let clients = [];
let pms = [];
let activeProject = null;

// Paginasi: Tepat 3 Baris Per Halaman
let currentPage = 1;
const itemsPerPage = 3;

// 1. Inisialisasi Saat Halaman Dibuka
async function initApp() {
  try {
    const [fetchedProjects, fetchedClients, fetchedPMs] = await Promise.all([
      ProjectAPI.getProjects(),
      ProjectAPI.getClients(),
      ProjectAPI.getPMReferences()
    ]);

    projects = fetchedProjects || [];
    clients = fetchedClients || [];
    pms = fetchedPMs || [];

    populateDropdowns();
    renderDashboardTable();
    setupEventListeners();
  } catch (err) {
    console.error('Inisialisasi gagal:', err);
    showToast('Gagal memuat data dari server lokal', 'error');
  }
}

// 2. Perpindahan Tampilan (Routing Internal)
export function navigateTo(viewName, projectData = null) {
  const views = {
    dashboard: document.getElementById('viewDashboard'),
    create: document.getElementById('viewCreate'),
    detail: document.getElementById('viewDetail')
  };

  const breadcrumbs = {
    dashboard: 'Dasbor proyek',
    create: 'Draf proyek baru',
    detail: `Detail proyek / ${projectData?.canonicalCode || 'DRAFT'}`
  };

  Object.values(views).forEach(v => v.classList.add('hidden'));
  views[viewName].classList.remove('hidden');
  document.getElementById('breadcrumbCurrent').innerText = breadcrumbs[viewName];

  if (viewName === 'detail' && projectData) {
    renderProjectDetail(projectData);
  }
}

// 3. Render Tabel Dasbor dengan Paginasi 3 Baris
function renderDashboardTable() {
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  const statusFilter = document.getElementById('statusFilter').value;
  const amPmFilter = document.getElementById('amPmFilter').value;

  // Hitung Kartu Metrik
  document.getElementById('countDraft').innerText = projects.filter(p => p.status === 'DRAFT').length;
  document.getElementById('countReview').innerText = projects.filter(p => p.status === 'UNDER_REVIEW').length;
  document.getElementById('countRegistered').innerText = projects.filter(p => p.status === 'REGISTERED').length;
  document.getElementById('countRevisi').innerText = projects.filter(p => p.status === 'REVISI_HANDOVER').length;
  document.getElementById('totalBadge').innerText = `${projects.length} proyek`;

  // Filter Data
  const filtered = projects.filter(p => {
    const matchSearch =
      p.projectName?.toLowerCase().includes(searchTerm) ||
      p.canonicalCode?.toLowerCase().includes(searchTerm) ||
      p.clientName?.toLowerCase().includes(searchTerm);
    const matchStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const matchAmPm =
      amPmFilter === 'ALL' ||
      p.amName?.includes(amPmFilter) ||
      p.pmName?.includes(amPmFilter);
    return matchSearch && matchStatus && matchAmPm;
  });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  // Pemotongan Array Paginasi
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginatedProjects = filtered.slice(startIndex, endIndex);

  const tbody = document.getElementById('projectTableBody');
  if (paginatedProjects.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Tidak ada proyek yang sesuai filter.</td></tr>`;
  } else {
    tbody.innerHTML = paginatedProjects.map(p => {
      const { badge, actionBtn } = getStatusDisplay(p);
      const codeDisplay = p.canonicalCode
        ? `<span class="font-mono font-bold text-slate-900">${p.canonicalCode}</span>`
        : `<span class="text-slate-400 font-bold">—</span>`;

      return `
        <tr class="hover:bg-slate-50/80 transition">
          <td class="px-6 py-4">${codeDisplay}</td>
          <td class="px-6 py-4">
            <div class="font-bold text-slate-900 text-xs">${p.projectName}</div>
            <div class="text-[10px] text-slate-400 mt-0.5">Mulai: ${p.startDate} • Target: ${p.targetEndDate}</div>
          </td>
          <td class="px-6 py-4 text-slate-700 font-medium">${p.clientName}</td>
          <td class="px-6 py-4">
            <div class="text-slate-700">AM · ${p.amName || 'Andi Maulana'}</div>
            <div class="text-[10px] text-slate-400">PM · ${p.pmName || 'Budi Santoso, M.T.'}</div>
          </td>
          <td class="px-6 py-4">${badge}</td>
          <td class="px-6 py-4 text-right">
            <button data-id="${p.projectId}" class="btn-detail font-semibold text-xs flex items-center justify-end space-x-1 ml-auto transition">
              ${actionBtn}
            </button>
          </td>
        </tr>
      `;
    }).join('');

    document.querySelectorAll('.btn-detail').forEach(btn => {
      btn.addEventListener('click', () => {
        const proj = projects.find(p => p.projectId === btn.dataset.id);
        if (proj) navigateTo('detail', proj);
      });
    });
  }

  renderPaginationControls(startIndex, endIndex, totalItems, totalPages);
}

// 4. Tombol Paginasi
function renderPaginationControls(startIndex, endIndex, totalItems, totalPages) {
  const infoEl = document.getElementById('paginationInfo');
  const buttonsEl = document.getElementById('paginationButtons');

  if (totalItems === 0) {
    infoEl.innerText = `Menampilkan 0 dari 0 proyek`;
    buttonsEl.innerHTML = '';
    return;
  }

  infoEl.innerText = `Menampilkan ${startIndex + 1}–${endIndex} dari ${totalItems} proyek`;

  let btnHtml = `
    <button id="btnPrevPage" ${currentPage === 1 ? 'disabled class="px-2 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"'}>&lt;</button>
  `;

  for (let i = 1; i <= totalPages; i++) {
    if (i === currentPage) {
      btnHtml += `<button class="px-2.5 py-1 rounded bg-[#0d1527] text-white font-semibold">${i}</button>`;
    } else {
      btnHtml += `<button data-page="${i}" class="btn-page-num px-2.5 py-1 rounded hover:bg-slate-100 text-slate-600 transition">${i}</button>`;
    }
  }

  btnHtml += `
    <button id="btnNextPage" ${currentPage === totalPages ? 'disabled class="px-2 py-1 rounded border border-slate-200 text-slate-300 cursor-not-allowed"' : 'class="px-2 py-1 rounded border border-slate-200 hover:bg-slate-50 text-slate-600"'}>&gt;</button>
  `;

  buttonsEl.innerHTML = btnHtml;

  document.getElementById('btnPrevPage')?.addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      renderDashboardTable();
    }
  });

  document.getElementById('btnNextPage')?.addEventListener('click', () => {
    if (currentPage < totalPages) {
      currentPage++;
      renderDashboardTable();
    }
  });

  document.querySelectorAll('.btn-page-num').forEach(btn => {
    btn.addEventListener('click', () => {
      currentPage = parseInt(btn.dataset.page, 10);
      renderDashboardTable();
    });
  });
}

function getStatusDisplay(p) {
  switch (p.status) {
    case 'REGISTERED':
      return {
        badge: `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">• REGISTERED</span>`,
        actionBtn: `<span class="text-slate-700 hover:text-blue-700">Detail ↗</span>`
      };
    case 'UNDER_REVIEW':
      return {
        badge: `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200/60">• UNDER_REVIEW</span>`,
        actionBtn: `<span class="text-blue-700 hover:text-blue-900">Verifikasi ↗</span>`
      };
    case 'REVISI_HANDOVER':
      return {
        badge: `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60">• REVISI_HANDOVER</span>`,
        actionBtn: `<span class="text-rose-700 hover:text-rose-900">Revisi ↗</span>`
      };
    default:
      return {
        badge: `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">• DRAFT</span>`,
        actionBtn: `<span class="text-slate-700 hover:text-blue-700">Lanjutkan ↗</span>`
      };
  }
}

function populateDropdowns() {
  const clientSelect = document.getElementById('clientSelect');
  clientSelect.innerHTML = clients.map(c => `
    <option value="${c.clientId}" data-name="${c.name}">${c.name}</option>
  `).join('');

  const pmSelect = document.getElementById('pmSelect');
  pmSelect.innerHTML = pms.map(p => `
    <option value="${p.employeeId}" data-name="${p.namaLengkap}">${p.namaLengkap} (${p.namaJabatan || 'PM'})</option>
  `).join('');
}

// 5. Validasi Formulir Registrasi (Aturan Bisnis D-1)
async function handleProjectSubmit(targetStatus = 'DRAFT') {
  clearValidationErrors();

  const projectName = document.getElementById('projectName').value.trim();
  const clientSelect = document.getElementById('clientSelect');
  const clientId = clientSelect.value;
  const clientName = clientSelect.selectedOptions[0]?.getAttribute('data-name') || '';
  const pmSelect = document.getElementById('pmSelect');
  const pmEmployeeId = pmSelect.value;
  const pmName = pmSelect.selectedOptions[0]?.getAttribute('data-name') || '';
  const startDate = document.getElementById('startDate').value;
  const targetEndDate = document.getElementById('targetEndDate').value;
  const indicativeValue = document.getElementById('indicativeValue').value;

  let isValid = true;
  if (!projectName || projectName.length < 5) {
    showFieldError('errProjectName', 'Nama proyek wajib diisi (minimal 5 karakter)');
    isValid = false;
  }
  if (!startDate) {
    showFieldError('errStartDate', 'Estimasi tanggal mulai wajib ditentukan');
    isValid = false;
  }
  if (!targetEndDate) {
    showFieldError('errTargetEndDate', 'Estimasi target selesai wajib ditentukan');
    isValid = false;
  }
  if (startDate && targetEndDate && new Date(targetEndDate) < new Date(startDate)) {
    showFieldError('errTargetEndDate', 'Target tanggal selesai tidak boleh mendahului tanggal mulai proyek');
    isValid = false;
  }

  if (!isValid) return;

  const payload = {
    projectName,
    clientId,
    clientName,
    pmEmployeeId,
    pmName,
    startDate,
    targetEndDate,
    indicativeValue: Number(indicativeValue) || 0
  };

  try {
    const res = await ProjectAPI.createProject(payload);
    const newProject = res.data;

    if (targetStatus === 'UNDER_REVIEW') {
      const handoverResult = await ProjectAPI.handoverProject(newProject.projectId);
      Object.assign(newProject, handoverResult.data);
    }

    projects.unshift(newProject);
    currentPage = 1;
    showToast(targetStatus === 'DRAFT' ? 'Draf proyek berhasil disimpan' : 'Proyek diajukan untuk review PM');
    renderDashboardTable();
    navigateTo('dashboard');
    document.getElementById('projectForm').reset();
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan proyek', 'error');
  }
}

// 6. Rincian Proyek & Panel Verifikasi PM
function renderProjectDetail(proj) {
  activeProject = proj;

  document.getElementById('detailTitle').innerText = proj.canonicalCode ? `Kode ${proj.canonicalCode}` : 'Draf Proyek';
  document.getElementById('detailSubtitle').innerText = `${proj.projectName} · ${proj.clientName}`;
  document.getElementById('detailCode').innerText = proj.canonicalCode || '— (Belum Terbit)';
  document.getElementById('detailClient').innerText = proj.clientName;
  document.getElementById('detailPm').innerText = proj.pmName || 'Budi Santoso, M.T.';
  document.getElementById('detailDates').innerText = `${proj.startDate} – ${proj.targetEndDate}`;
  document.getElementById('detailValue').innerText = `Rp ${Number(proj.indicativeValue || 0).toLocaleString('id-ID')}`;

  const badgeEl = document.getElementById('detailBadgeStatus');
  if (proj.status === 'REGISTERED') {
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800';
    badgeEl.innerText = '• REGISTERED';
  } else if (proj.status === 'REVISI_HANDOVER') {
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-100 text-rose-800';
    badgeEl.innerText = '• REVISI_HANDOVER';
  } else {
    badgeEl.className = 'px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-100 text-amber-800';
    badgeEl.innerText = '• UNDER_REVIEW';
  }
}

async function verifyPMDecision(action) {
  if (!activeProject) return;

  try {
    let result;
    if (action === 'APPROVE') {
      result = await ProjectAPI.approveProject(activeProject.projectId);
    } else if (action === 'REJECT') {
      const notes = document.getElementById('pmNotes').value.trim();
      const errEl = document.getElementById('errPmNotes');

      if (notes.length < 20) {
        errEl.innerText = 'Catatan revisi PM wajib diisi minimal 20 karakter.';
        errEl.classList.remove('hidden');
        return;
      }

      errEl.classList.add('hidden');
      result = await ProjectAPI.rejectProject(activeProject.projectId, notes);
    }

    activeProject = { ...activeProject, ...result.data };
    projects = projects.map(project =>
      project.projectId === activeProject.projectId ? activeProject : project
    );
    showToast(action === 'APPROVE'
      ? 'Proyek berhasil disetujui & berstatus REGISTERED'
      : 'Handover dikembalikan ke AM untuk revisi');
    renderProjectDetail(activeProject);
    renderDashboardTable();
  } catch (err) {
    showToast(err.message || 'Gagal memperbarui status proyek', 'error');
  }
}

// 7. Modal Klien Sementara
async function submitTemporaryClient() {
  const nameInput = document.getElementById('modalClientName');
  const errEl = document.getElementById('errModalClientName');
  const name = nameInput.value.trim();

  if (!name || name.length < 3) {
    errEl.innerText = 'Nama instansi minimal 3 karakter';
    errEl.classList.remove('hidden');
    return;
  }
  errEl.classList.add('hidden');

  try {
    const newClient = await ProjectAPI.addTemporaryClient(name);
    clients.push(newClient);
    populateDropdowns();
    document.getElementById('clientSelect').value = newClient.clientId;
    toggleClientModal(false);
    nameInput.value = '';
    showToast('Klien sementara berhasil ditambahkan');
  } catch (err) {
    showToast(err.message || 'Gagal menyimpan klien', 'error');
  }
}

function toggleClientModal(isOpen) {
  const modal = document.getElementById('clientModal');
  if (isOpen) {
    modal.classList.remove('hidden');
    modal.classList.add('flex');
  } else {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }
}

function clearValidationErrors() {
  ['errProjectName', 'errStartDate', 'errTargetEndDate', 'errPmNotes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.add('hidden');
  });
}

function showFieldError(elementId, message) {
  const el = document.getElementById(elementId);
  if (el) {
    el.innerText = message;
    el.classList.remove('hidden');
  }
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toastMsg');
  msgEl.innerText = message;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 4500);
}

function setupEventListeners() {
  document.getElementById('btnNavCreate')?.addEventListener('click', () => navigateTo('create'));
  document.getElementById('btnBackFromCreate')?.addEventListener('click', () => navigateTo('dashboard'));
  document.getElementById('btnCancelCreate')?.addEventListener('click', () => navigateTo('dashboard'));
  document.getElementById('btnBackFromDetail')?.addEventListener('click', () => navigateTo('dashboard'));

  document.getElementById('searchInput')?.addEventListener('input', () => {
    currentPage = 1;
    renderDashboardTable();
  });
  document.getElementById('statusFilter')?.addEventListener('change', () => {
    currentPage = 1;
    renderDashboardTable();
  });
  document.getElementById('amPmFilter')?.addEventListener('change', () => {
    currentPage = 1;
    renderDashboardTable();
  });

  document.getElementById('projectForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    handleProjectSubmit('DRAFT');
  });
  document.getElementById('btnSimpanKirim')?.addEventListener('click', () => {
    handleProjectSubmit('UNDER_REVIEW');
  });

  document.getElementById('btnOpenClientModal')?.addEventListener('click', () => toggleClientModal(true));
  document.getElementById('btnCloseClientModal')?.addEventListener('click', () => toggleClientModal(false));
  document.getElementById('btnCancelClientModal')?.addEventListener('click', () => toggleClientModal(false));
  document.getElementById('btnSaveClientModal')?.addEventListener('click', submitTemporaryClient);

  document.getElementById('btnApprovePM')?.addEventListener('click', () => verifyPMDecision('APPROVE'));
  document.getElementById('btnRejectPM')?.addEventListener('click', () => verifyPMDecision('REJECT'));
}

initApp();