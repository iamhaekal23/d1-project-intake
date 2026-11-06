// public/js/app.js - Main Router & State Orchestrator Modul D1
import { DashboardView } from './views/dashboard.js';
import { FormView } from './views/form.js';
import { DetailView } from './views/detail.js';
import { fetchEmployees, fetchProjectIntakeDetail, fetchProjects, loginF1 } from './api.js';

class AppRouter {
  constructor() {
    this.appContent = document.getElementById('appContent');
    this.modalContainer = document.getElementById('modalContainer');
    this.breadcrumbCurrent = document.getElementById('breadcrumbCurrent');
    this.templates = {};
    this.currentView = null;
    this._toastTimer = null;
    this.pmCandidates = [];
    this.isF2Live = false;
    this.livePmAccounts = [];

    // Profil awal AM dari sesi lokal atau default
    this.amAccount = {
      akunId: '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
      employeeId: null,
      namaLengkap: 'Fikri Lazuardi Fadilla (AM)',
      email: 'fikri.lazuardi@anaheimnimbus.co.id',
      peran: 'AM',
      roleCode: 'AM'
    };

    const savedPmAccounts = JSON.parse(localStorage.getItem('pmAccounts') || '[]');
    this.pmAccounts = Array.isArray(savedPmAccounts)
      ? savedPmAccounts.filter(account => account && account.employeeId && account.namaLengkap)
      : [];

    const savedUser = JSON.parse(localStorage.getItem('user'));
    this.currentUser = savedUser ? {
      ...savedUser,
      ...(savedUser.peran === 'PM' && !savedUser.employeeId
        ? { employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a01' }
        : {})
    } : this.amAccount;
  }

  showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    if (!toast || !toastMsg) return;

    toastMsg.textContent = message;

    if (isError) {
      toast.className = 'fixed top-16 right-8 bg-rose-900 text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-medium z-50 flex items-center border border-rose-700 transition-all duration-300';
    } else {
      toast.className = 'fixed top-16 right-8 bg-slate-900 text-white px-5 py-3 rounded-xl shadow-2xl text-xs font-medium z-50 flex items-center border border-slate-700 transition-all duration-300';
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
      this.showToast('Gagal memuat template antarmuka modular', true);
    }
  }

  updateSidebarProfile(user = null) {
    const currentUser = user || this.currentUser || this.amAccount;

    const nameEl = document.getElementById('sidebarUserName');
    const roleEl = document.getElementById('sidebarUserRole');
    const avatarEl = document.getElementById('sidebarUserAvatar');

    if (nameEl) nameEl.textContent = currentUser.namaLengkap;
    if (roleEl) {
      roleEl.textContent = currentUser.peran === 'AM'
        ? 'Account Manager'
        : currentUser.peran === 'PM' ? 'Project Manager' : (currentUser.peran || 'Pengguna');
    }

    // Avatar inisial: FL untuk Fikri, AM untuk Account Manager resmi F1
    if (avatarEl && currentUser.namaLengkap) {
      let initials = 'AM';
      if (currentUser.namaLengkap.includes('Fikri')) {
        initials = 'FL';
      } else if (currentUser.namaLengkap === 'Account Manager') {
        initials = 'AM';
      } else {
        initials = currentUser.namaLengkap.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
      }
      avatarEl.textContent = initials;
    }

    const accountSwitcher = document.getElementById('accountSwitcher');
    if (accountSwitcher) accountSwitcher.value = this.getAccountKey(currentUser);
  }

  getDefaultPmAccount() {
    return {
      akunId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a01',
      employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a01',
      namaLengkap: 'Haekal Khadafy',
      email: 'haekal.khadafy@anaheimnimbus.co.id',
      peran: 'PM',
      roleCode: 'PM'
    };
  }

  getPmAccounts() {
    if (this.isF2Live && this.livePmAccounts && this.livePmAccounts.length > 0) {
      return this.livePmAccounts;
    }

    const accounts = [this.getDefaultPmAccount(), ...this.pmAccounts];
    if (this.currentUser.peran === 'PM'
      && this.currentUser.employeeId
      && !accounts.some(account => account.employeeId === this.currentUser.employeeId)) {
      accounts.push(this.currentUser);
    }
    return accounts;
  }

  getAccountKey(user) {
    return user.peran === 'PM' ? `PM:${user.employeeId}` : 'AM';
  }

  renderAccountSwitcher(selectedKey = this.getAccountKey(this.currentUser)) {
    const accountSwitcher = document.getElementById('accountSwitcher');
    if (!accountSwitcher) return;

    // Bersihkan opsi lama dan tetapkan nama AM aktif
    const amDisplayName = this.amAccount.namaLengkap.replace(' (AM)', '');
    accountSwitcher.replaceChildren(new Option(`AM · ${amDisplayName}`, 'AM'));

    // Masukkan hanya akun PM resmi
    this.getPmAccounts().forEach(account => {
      accountSwitcher.add(new Option(`PM · ${account.namaLengkap}`, this.getAccountKey(account)));
    });

    const validKeys = Array.from(accountSwitcher.options).map(opt => opt.value);
    if (validKeys.includes(selectedKey)) {
      accountSwitcher.value = selectedKey;
    } else {
      accountSwitcher.value = 'AM';
    }
  }

  // Sinkronisasi SDM dari F2: HANYA saring Project Manager
  async syncAccountsWithF2() {
    try {
      const res = await fetchEmployees();
      const items = res.items || res.data || (Array.isArray(res) ? res : []);
      const isLive = res.source === 'F2_LIVE_API' || res.source === 'F2_API';

      if (isLive && items.length > 0) {
        this.isF2Live = true;

        const pms = items.filter(emp => {
          const title = (emp.namaJabatan || emp.jobTitle || '').toLowerCase();
          return (
            title.includes('project manager') ||
            title.includes('manajer proyek') ||
            title.includes('pm')
          ) && !title.includes('junior');
        });

        const targetList = pms.length > 0 ? pms : items;

        this.livePmAccounts = targetList.map(pm => {
          const empId = pm.employeeId || pm.id;
          const nama = pm.namaLengkap || pm.name || 'Sandy Walsh';
          return {
            akunId: empId,
            employeeId: empId,
            namaLengkap: nama,
            email: `${nama.toLowerCase().replace(/[^a-z0-9]/g, '.')}@anaheimnimbus.co.id`,
            peran: 'PM',
            roleCode: 'PM',
            namaJabatan: pm.namaJabatan || 'Project Manager'
          };
        });

        localStorage.removeItem('pmAccounts');
        this.pmAccounts = [];

        if (this.currentUser.peran === 'PM') {
          const matchingLivePm = this.livePmAccounts.find(p => p.employeeId === this.currentUser.employeeId);
          if (!matchingLivePm && this.livePmAccounts.length > 0) {
            this.currentUser = this.livePmAccounts[0];
            localStorage.setItem('user', JSON.stringify(this.currentUser));
            this.updateSidebarProfile(this.currentUser);
          }
        }

        this.renderAccountSwitcher();
      } else {
        this.isF2Live = false;
        this.livePmAccounts = [];
        this.renderAccountSwitcher();
      }
    } catch (err) {
      console.warn('[App] F-2 luring, menggunakan daftar PM fallback:', err.message);
      this.isF2Live = false;
      this.livePmAccounts = [];
      this.renderAccountSwitcher();
    }
  }

  async loadPmCandidates() {
    const result = await fetchEmployees();
    const employees = result.items || result.data || (Array.isArray(result) ? result : []);
    const addedIds = new Set(this.getPmAccounts().map(account => account.employeeId));
    this.pmCandidates = employees.filter(employee => {
      const employeeId = employee.employeeId || employee.id;
      const title = employee.namaJabatan || employee.jobTitle || '';
      return employeeId
        && (!title || /project manager|manajer proyek|\bpm\b/i.test(title))
        && !addedIds.has(employeeId);
    });

    const candidateSelect = document.getElementById('pmAccountCandidate');
    if (!candidateSelect) return;
    candidateSelect.replaceChildren(new Option(
      this.pmCandidates.length ? 'Pilih pegawai PM' : 'Tidak ada PM lain tersedia',
      ''
    ));
    this.pmCandidates.forEach(employee => {
      const employeeId = employee.employeeId || employee.id;
      const name = employee.namaLengkap || employee.name || 'Tanpa Nama';
      candidateSelect.add(new Option(name, employeeId));
    });
  }

  async addPmAccount() {
    const candidateId = document.getElementById('pmAccountCandidate')?.value;
    const employee = this.pmCandidates.find(item => (item.employeeId || item.id) === candidateId);
    if (!employee) {
      this.showToast('Pilih pegawai PM terlebih dahulu', true);
      return;
    }

    const employeeId = employee.employeeId || employee.id;
    const account = {
      akunId: employeeId,
      employeeId,
      namaLengkap: employee.namaLengkap || employee.name || 'Tanpa Nama',
      email: employee.email || '',
      peran: 'PM',
      roleCode: 'PM'
    };
    this.pmAccounts = [...this.pmAccounts, account];
    localStorage.setItem('pmAccounts', JSON.stringify(this.pmAccounts));
    this.renderAccountSwitcher(this.getAccountKey(account));
    document.getElementById('addPmAccountPanel')?.classList.add('hidden');
    document.getElementById('btnAddPmAccount')?.setAttribute('aria-expanded', 'false');
    this.switchAccount(this.getAccountKey(account));
  }

  switchAccount(accountKey) {
    let selectedAccount = null;

    if (accountKey === 'AM') {
      selectedAccount = this.amAccount;
    } else {
      selectedAccount = this.getPmAccounts().find(account => this.getAccountKey(account) === accountKey);
    }

    if (!selectedAccount) return;

    this.currentUser = selectedAccount;
    localStorage.setItem('user', JSON.stringify(selectedAccount));

    DashboardView.currentPage = 1;
    this.updateSidebarProfile(selectedAccount);
    this.navigateToDashboard();
    this.showToast(`Beralih ke akun ${selectedAccount.peran === 'AM' ? `Account Manager · ${selectedAccount.namaLengkap}` : `PM · ${selectedAccount.namaLengkap}`}`);
  }

  // Sinkronisasi Sesi Autentikasi dengan API F1
  async syncProfileWithF1() {
    try {
      const authData = await loginF1('account.manager', 'Password123!');
      if (authData?.user) {
        localStorage.setItem('token', authData.accessToken || authData.token);

        // Bedakan nama tampilan berdasarkan source F1 Live vs Local Fallback
        const isLive = authData.source === 'F1_LIVE_API';
        const activeName = isLive
          ? 'Account Manager'
          : (authData.user.namaLengkap || 'Fikri Lazuardi Fadilla (AM)');

        this.amAccount = {
          akunId: authData.user.akunId,
          employeeId: authData.user.employeeId || null,
          namaLengkap: activeName,
          email: authData.user.email || 'account.manager@anaheimnimbus.co.id',
          peran: 'AM',
          roleCode: authData.user.roleCode || 'AM'
        };

        if (this.currentUser.peran === 'AM') {
          this.currentUser = this.amAccount;
          localStorage.setItem('user', JSON.stringify(this.amAccount));
          this.updateSidebarProfile(this.currentUser);
        }

        this.renderAccountSwitcher();
        console.log(`[D1] Profil AM sinkron (${authData.source}):`, this.amAccount.namaLengkap);
      }
    } catch (err) {
      console.warn('[D1] Koneksi login gagal, menerapkan fallback lokal Fikri:', err.message);
      this.amAccount = {
        akunId: '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
        employeeId: null,
        namaLengkap: 'Fikri Lazuardi Fadilla (AM)',
        email: 'fikri.lazuardi@anaheimnimbus.co.id',
        peran: 'AM',
        roleCode: 'AM'
      };
      if (this.currentUser.peran === 'AM') {
        this.currentUser = this.amAccount;
        localStorage.setItem('user', JSON.stringify(this.amAccount));
        this.updateSidebarProfile(this.currentUser);
      }
      this.renderAccountSwitcher();
    }
  }

  async navigateToDashboard() {
    this.currentView = 'dashboard';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Dasbor proyek';
    this.appContent.innerHTML = this.templates.dashboard;

    const isPm = this.currentUser.peran === 'PM';
    document.getElementById('draftMetricCard')?.classList.toggle('hidden', isPm);
    document.getElementById('amPmFilter')?.classList.toggle('hidden', isPm);
    document.getElementById('metricsCardGrid')?.classList.toggle('lg:grid-cols-4', !isPm);
    document.getElementById('metricsCardGrid')?.classList.toggle('lg:grid-cols-3', isPm);

    const btnNavCreate = document.getElementById('btnNavCreate');
    if (btnNavCreate) {
      btnNavCreate.classList.toggle('hidden', this.currentUser.peran !== 'AM');
      btnNavCreate.addEventListener('click', () => this.navigateToCreate());
    }

    document.getElementById('btnExportProjects')?.addEventListener('click', async () => {
      try {
        const json = await fetchProjects({
          page: 1,
          limit: 100,
          pmEmployeeId: this.currentUser.peran === 'PM' ? this.currentUser.employeeId : undefined
        });
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
          `"${p.amName || 'Account Manager'}"`,
          `"${p.pmName || 'Sandy Walsh'}"`,
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
        (id) => this.navigateToEdit(id),
        this.currentUser
      );
    };

    searchInput?.addEventListener('input', handleFilter);
    statusFilter?.addEventListener('change', handleFilter);
    amPmFilter?.addEventListener('change', handleFilter);

    await DashboardView.render(
      (id) => this.navigateToDetail(id),
      (id) => this.navigateToEdit(id),
      this.currentUser
    );
  }

  async navigateToCreate() {
    if (this.currentUser.peran !== 'AM') {
      this.showToast('Hanya akun AM yang dapat membuat proyek', true);
      return;
    }
    this.currentView = 'create';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Draf proyek baru';
    this.appContent.innerHTML = this.templates.form;

    await FormView.loadMasterData();
    FormView.resetForCreate();
    this.attachFormEvents();
  }

  async navigateToEdit(projectId) {
    if (this.currentUser.peran !== 'AM') {
      this.showToast('Hanya akun AM yang dapat mengubah proyek', true);
      return;
    }
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

  attachFormEvents() {
    document.getElementById('btnBackFromCreate')?.addEventListener('click', () => this.navigateToDashboard());
    document.getElementById('btnCancelCreate')?.addEventListener('click', () => this.navigateToDashboard());

    const form = document.getElementById('projectForm');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      FormView.handleFormSubmit(
        false,
        async (saved, msg) => {
          if (this.currentView === 'edit') {
            await this.navigateToDetail(saved.projectId);
          } else {
            await this.navigateToDashboard();
          }
          this.showToast(msg);
        },
        (errMsg) => this.showToast(errMsg, true)
      );
    });

    document.getElementById('btnSimpanKirim')?.addEventListener('click', () => {
      FormView.handleFormSubmit(
        true,
        async (saved, msg) => {
          if (this.currentView === 'edit') {
            await this.navigateToDetail(saved.projectId);
          } else {
            await this.navigateToDashboard();
          }
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

  async navigateToDetail(projectId) {
    this.currentView = 'detail';
    if (this.breadcrumbCurrent) this.breadcrumbCurrent.textContent = 'Detail proyek';
    this.appContent.innerHTML = this.templates.detail;

    document.getElementById('btnBackFromDetail')?.addEventListener('click', () => this.navigateToDashboard());

    DetailView.initListeners(
      (id) => this.navigateToEdit(id),
      (msg, isErr) => this.showToast(msg, isErr),
      () => this.navigateToDashboard()
    );

    await DetailView.loadAndRender(projectId, (msg, isErr) => this.showToast(msg, isErr));
  }

  async init() {
    this.updateSidebarProfile();
    await this.loadComponents();

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
      localStorage.clear();
      location.reload();
    });

    document.getElementById('accountSwitcher')?.addEventListener('change', (event) => {
      this.switchAccount(event.target.value);
    });

    document.getElementById('btnAddPmAccount')?.addEventListener('click', async () => {
      const panel = document.getElementById('addPmAccountPanel');
      if (!panel) return;
      panel.classList.toggle('hidden');
      document.getElementById('btnAddPmAccount')?.setAttribute(
        'aria-expanded',
        String(!panel.classList.contains('hidden'))
      );
      if (!panel.classList.contains('hidden')) {
        try {
          await this.loadPmCandidates();
        } catch (err) {
          panel.classList.add('hidden');
          document.getElementById('btnAddPmAccount')?.setAttribute('aria-expanded', 'false');
          console.error('Gagal memuat daftar akun PM:', err);
          this.showToast(err.message || 'Gagal memuat daftar pegawai PM', true);
        }
      }
    });
    document.getElementById('btnSavePmAccount')?.addEventListener('click', () => this.addPmAccount());
    document.getElementById('btnCancelAddPmAccount')?.addEventListener('click', () => {
      document.getElementById('addPmAccountPanel')?.classList.add('hidden');
      document.getElementById('btnAddPmAccount')?.setAttribute('aria-expanded', 'false');
    });

    await this.navigateToDashboard();
    await this.syncAccountsWithF2();
    await this.syncProfileWithF1();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const router = new AppRouter();
  router.init();
});