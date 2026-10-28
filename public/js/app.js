// public/js/app.js - Main Router & State Orchestrator
import { DashboardView } from './views/dashboard.js';
import { FormView } from './views/form.js';
import { DetailView } from './views/detail.js';
import { fetchProjectById } from './api.js';

class AppRouter {
  constructor() {
    this.appContent = document.getElementById('appContent');
    this.modalContainer = document.getElementById('modalContainer');
    this.breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    this.templates = {};
    this.currentView = null;
    this._toastTimer = null;
  }

  showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;
    if (toastIcon) {
      toastIcon.textContent = isError ? '✕' : '✓';
      toastIcon.className = isError ? 'text-rose-400 font-bold text-sm' : 'text-emerald-400 font-bold text-sm';
    }

    if (isError) {
      toast.className = 'fixed top-16 right-8 bg-rose-900 text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-medium z-50 flex items-center space-x-2.5 border border-rose-700 transition-all duration-300';
    } else {
      toast.className = 'fixed top-16 right-8 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-medium z-50 flex items-center space-x-2.5 border border-slate-700 transition-all duration-300';
    }

    toast.classList.remove('hidden');

    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      toast.classList.add('hidden');
    }, 4000);
  }

  async loadComponents() {
    try {
      const [dashHtml, formHtml, detailHtml, modalHtml] = await Promise.all([
        fetch('/components/dashboardView.html').then(r => r.text()),
        fetch('/components/formView.html').then(r => r.text()),
        fetch('/components/detailView.html').then(r => r.text()),
        fetch('/components/clientModal.html').then(r => r.text())
      ]);

      this.templates = {
        dashboard: dashHtml,
        form: formHtml,
        detail: detailHtml
      };

      if (this.modalContainer) {
        this.modalContainer.innerHTML = modalHtml;
      }
    } catch (err) {
      console.error('Gagal memuat template antarmuka:', err);
    }
  }

  // Tampilan Dasbor
  async navigateToDashboard() {
    this.currentView = 'dashboard';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Dasbor proyek';
    this.appContent.innerHTML = this.templates.dashboard;

    document.getElementById('btnNavCreate')?.addEventListener('click', () => {
      this.navigateToCreate();
    });

    // Listener Tombol Ekspor Tabel Proyek ke CSV
    document.getElementById('btnExportProjects')?.addEventListener('click', async () => {
      try {
        const res = await fetch('/api/v1/projects');
        const json = await res.json();
        const projects = json.data || json.items || json || [];

        if (!Array.isArray(projects) || projects.length === 0) {
          this.showToast('Tidak ada data proyek untuk diekspor', true);
          return;
        }

        const headers = [
          'Kode Proyek',
          'ID Proyek (UUID)',
          'Nama Proyek',
          'Klien',
          'Account Manager (AM)',
          'Project Manager (PM)',
          'Estimasi Mulai',
          'Estimasi Selesai',
          'Nilai Indikatif (Rp)',
          'Status Proyek',
          'Dokumen Lengkap (WI-01)',
          'PO Diterima'
        ];

        const rows = projects.map(p => [
          `"${p.canonicalCode || '—'}"`,
          `"${p.projectId || ''}"`,
          `"${(p.projectName || '').replace(/"/g, '""')}"`,
          `"${(p.clientName || p.clientId || '').replace(/"/g, '""')}"`,
          `"${p.amName || 'Andi Maulana'}"`,
          `"${p.pmName || 'Budi Santoso'}"`,
          `"${p.startDate || '—'}"`,
          `"${p.targetEndDate || '—'}"`,
          `"${Number(p.indicativeValue || 0)}"`,
          `"${p.status || 'DRAFT'}"`,
          `"${p.documentsComplete ? 'LENGKAP' : 'BELUM'}"`,
          `"${p.poReceived ? 'PO DITERIMA' : 'BELUM ADA PO'}"`
        ]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const todayStr = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `Daftar_Proyek_Intake_${todayStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        this.showToast('Data proyek berhasil diekspor ke CSV');
      } catch (err) {
        console.error('Gagal mengekspor data:', err);
        this.showToast('Terjadi kesalahan saat mengekspor data', true);
      }
    });

    const searchInput = document.getElementById('searchInput');
    const statusFilter = document.getElementById('statusFilter');
    const amPmFilter = document.getElementById('amPmFilter');

    const handleFilter = () => {
      DashboardView.currentPage = 1;
      DashboardView.render(
        (id) => this.navigateToDetail(id),
        (id) => this.navigateToEdit(id)
      );
    };

    searchInput?.addEventListener('input', handleFilter);
    statusFilter?.addEventListener('change', handleFilter);
    amPmFilter?.addEventListener('change', handleFilter);

    await DashboardView.render(
      (id) => this.navigateToDetail(id),
      (id) => this.navigateToEdit(id)
    );
  }

  // Tampilan Form Registrasi Draf Baru
  async navigateToCreate() {
    this.currentView = 'create';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Draf proyek baru';
    this.appContent.innerHTML = this.templates.form;

    await FormView.loadMasterData();
    FormView.resetForCreate();
    this.attachFormEvents();
  }

  // Tampilan Form Ubah Draf
  async navigateToEdit(projectId) {
    this.currentView = 'edit';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Ubah draf proyek';
    this.appContent.innerHTML = this.templates.form;

    await FormView.loadMasterData();
    try {
      const proj = await fetchProjectById(projectId);
      FormView.populateForEdit(proj);
      this.attachFormEvents();
    } catch (err) {
      this.showToast(err.message || 'Gagal memuat proyek', true);
      this.navigateToDashboard();
    }
  }

  attachFormEvents() {
    document.getElementById('btnBackFromCreate')?.addEventListener('click', () => this.navigateToDashboard());
    document.getElementById('btnCancelCreate')?.addEventListener('click', () => this.navigateToDashboard());

    const form = document.getElementById('projectForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      FormView.handleFormSubmit(
        false,
        async (saved, msg) => {
          await this.navigateToDashboard();
          this.showToast(msg);
        },
        (errMsg) => this.showToast(errMsg, true)
      );
    });

    document.getElementById('btnSimpanKirim')?.addEventListener('click', () => {
      FormView.handleFormSubmit(
        true,
        async (saved, msg) => {
          await this.navigateToDashboard();
          this.showToast(msg);
        },
        (errMsg) => this.showToast(errMsg, true)
      );
    });

    FormView.initClientModal(
      (newClient) => this.showToast(`Draf klien "${newClient.companyName || newClient.name}" berhasil ditambahkan`),
      (err) => this.showToast(err, true)
    );
  }

  // Tampilan Rincian Proyek (WI-01 & PM)
  async navigateToDetail(projectId) {
    this.currentView = 'detail';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Detail proyek';
    this.appContent.innerHTML = this.templates.detail;

    document.getElementById('btnBackFromDetail')?.addEventListener('click', () => this.navigateToDashboard());

    DetailView.initListeners(
      (id) => this.navigateToEdit(id),
      (msg, isErr) => this.showToast(msg, isErr)
    );

    await DetailView.loadAndRender(projectId, (msg, isErr) => this.showToast(msg, isErr));
  }

  async init() {
    await this.loadComponents();

    // Link Sidebar
    document.getElementById('navProjectIntake')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigateToDashboard();
    });
    document.getElementById('breadcrumbRoot')?.addEventListener('click', () => {
      this.navigateToDashboard();
    });

    await this.navigateToDashboard();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const router = new AppRouter();
  router.init();
});