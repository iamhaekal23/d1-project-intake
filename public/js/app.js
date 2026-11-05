// public/js/app.js - Main Router & State Orchestrator Modul D-1
import { DashboardView } from './views/dashboard.js';
import { FormView } from './views/form.js';
import { DetailView } from './views/detail.js';
import { fetchProjectIntakeDetail, loginF1 } from './api.js';

class AppRouter {
  constructor() {
    this.appContent = document.getElementById('appContent');
    this.modalContainer = document.getElementById('modalContainer');
    this.breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    this.templates = {};
    this.currentView = null;
    this._toastTimer = null;
    this.currentUser = JSON.parse(localStorage.getItem('user')) || {
      akunId: '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
      namaLengkap: 'Fikri Lazuardi Fadilla',
      email: 'account.manager@anaheimnimbus.co.id',
      peran: 'AM'
    };
  }

  // Notifikasi Toast Global
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

  // Prapemuatan seluruh template HTML dari public/components/
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
      this.showToast('Gagal memuat template antarmuka modular', true);
    }
  }

  // Pembaruan profil akun aktif di sidebar
  updateSidebarProfile(user = null) {
    const currentUser = user || this.currentUser || JSON.parse(localStorage.getItem('user')) || {
      namaLengkap: 'Fikri Lazuardi Fadilla',
      peran: 'AM'
    };

    let nameEl = document.getElementById('sidebarUserName');
    let roleEl = document.getElementById('sidebarUserRole');
    let avatarEl = document.getElementById('sidebarUserAvatar');

    // Pencarian elemen otomatis jika ID belum terpasang di HTML sidebar
    if (!nameEl) {
      const candidates = document.querySelectorAll('aside .text-white.leading-tight, aside .font-semibold.text-white');
      for (const el of candidates) {
        if (el.textContent.includes('Andi') || el.textContent.includes('Fikri') || el.textContent.includes('Account')) {
          nameEl = el;
          nameEl.id = 'sidebarUserName';
          break;
        }
      }
    }

    if (!roleEl) {
      const candidates = document.querySelectorAll('aside .text-slate-400, aside .text-\\[10px\\].text-slate-400');
      for (const el of candidates) {
        if (el.textContent.includes('Account Manager') || el.textContent.includes('AM')) {
          roleEl = el;
          roleEl.id = 'sidebarUserRole';
          break;
        }
      }
    }

    if (!avatarEl) {
      const candidates = document.querySelectorAll('aside .w-8.h-8, aside .w-9.h-9, aside .rounded-lg, aside .rounded-full');
      for (const el of candidates) {
        const txt = el.textContent.trim();
        if (txt === 'AM' || txt === 'FL') {
          avatarEl = el;
          avatarEl.id = 'sidebarUserAvatar';
          break;
        }
      }
    }

    if (nameEl) nameEl.textContent = currentUser.namaLengkap || 'Fikri Lazuardi Fadilla';
    if (roleEl) roleEl.textContent = currentUser.peran === 'AM' ? 'Account Manager' : (currentUser.peran || 'Pengguna');
    if (avatarEl && currentUser.namaLengkap) {
      const initials = currentUser.namaLengkap.split(' ').map(n => n[0]).slice(0, 2).join('');
      avatarEl.textContent = initials.toUpperCase();
    }
  }

  // Sinkronisasi Sesi Autentikasi dengan API F-1
  async syncProfileWithF1() {
    try {
      const authData = await loginF1('account.manager', 'Password123!');
      if (authData?.user) {
        localStorage.setItem('token', authData.accessToken || authData.token);
        localStorage.setItem('user', JSON.stringify(authData.user));
        this.currentUser = authData.user;
        this.updateSidebarProfile(this.currentUser);
        console.log(`[D-1] Profil akun tersinkronisasi (${authData.source || 'F1'}):`, this.currentUser);
      }
    } catch (err) {
      console.warn('[D-1] Menggunakan sesi akun lokal (F-1 offline):', err.message);
      this.updateSidebarProfile();
    }
  }

  // Tampilan Dasbor Proyek (UI-K01-01)
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
          `"${p.amName || 'Fikri Lazuardi Fadilla'}"`,
          `"${p.pmName || 'Haekal Khadafy'}"`,
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

    // Render data tabel dan kartu metrik
    await DashboardView.render(
      (id) => this.navigateToDetail(id),
      (id) => this.navigateToEdit(id)
    );
  }

  // Tampilan Form Registrasi Draf Baru (UI-K01-02)
  async navigateToCreate() {
    this.currentView = 'create';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Draf proyek baru';
    this.appContent.innerHTML = this.templates.form;

    await FormView.loadMasterData();
    FormView.resetForCreate();
    this.attachFormEvents();
  }

  // Tampilan Form Ubah Draf (UI-K01-02 Edit Mode)
  async navigateToEdit(projectId) {
    this.currentView = 'edit';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Ubah draf proyek';
    this.appContent.innerHTML = this.templates.form;

    await FormView.loadMasterData();
    try {
      const res = await fetchProjectIntakeDetail(projectId);
      const proj = res.data || res;
      FormView.populateForEdit(proj);
      this.attachFormEvents();
    } catch (err) {
      this.showToast(err.message || 'Gagal memuat proyek', true);
      this.navigateToDashboard();
    }
  }

  // Event listener tombol aksi form
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

  // Tampilan Rincian Proyek & Dokumen WI-01 (UI-K01-03)
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

  // Inisialisasi awal saat halaman dibuka
  async init() {
    this.updateSidebarProfile();
    await this.loadComponents();

    // Link Sidebar & Header
    ['navProjectIntake', 'menuIntake'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateToDashboard();
      });
    });

    document.getElementById('breadcrumbRoot')?.addEventListener('click', () => {
      this.navigateToDashboard();
    });

    document.getElementById('btnLogout')?.addEventListener('click', () => {
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      location.reload();
    });

    // Render dasbor terlebih dahulu agar tidak ada jeda tampilan
    await this.navigateToDashboard();

    // Jalankan sinkronisasi F-1 secara asynchronous di latar belakang
    this.syncProfileWithF1();
  }
}

// Jalankan Router Aplikasi
document.addEventListener('DOMContentLoaded', () => {
  const router = new AppRouter();
  router.init();
});