// public/js/views/form.js - Logika Formulir Registrasi Draf Proyek & Modal Klien
import {
  createProject,
  updateProject,
  handoverProject,
  fetchClients,
  fetchEmployees,
  createTemporaryClient
} from '../api.js';

export const FormView = {
  editingProjectId: null,
  clientsList: [],
  employeesList: [],

  formatRupiahInput(val) {
    const num = Number(String(val).replace(/[^0-9]/g, '')) || 0;
    if (num === 0) return 'Rp 0';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  },

  async loadMasterData() {
    try {
      // 1. Ambil data SDM melalui helper API
      const jsonSdm = await fetchEmployees();
      this.employeesList = jsonSdm.items || jsonSdm.data || (Array.isArray(jsonSdm) ? jsonSdm : []);

      const pmSelect = document.getElementById('pmSelect');
      if (pmSelect) {
        // Saring khusus personil yang memiliki jabatan Project Manager (mengecualikan Junior Programmer)
        const pmEmployees = this.employeesList.filter(emp => {
          const title = (emp.namaJabatan || emp.jobTitle || '').toLowerCase();
          return (
            title.includes('project manager') ||
            title.includes('manajer proyek') ||
            title.includes('pm')
          ) && !title.includes('junior');
        });

        // Gunakan hasil filter jika ada; jika tidak ada, gunakan daftar SDM yang tersedia
        const targetPmList = pmEmployees.length > 0 ? pmEmployees : this.employeesList;

        if (targetPmList.length === 0) {
          pmSelect.innerHTML = '<option value="">-- Tidak ada PM tersedia --</option>';
        } else {
          pmSelect.innerHTML = targetPmList.map(pm => {
            const id = pm.employeeId || pm.id || '';
            const nama = pm.namaLengkap || pm.name || 'Tanpa Nama';
            const jabatan = pm.namaJabatan || 'Project Manager';
            return `<option value="${id}" data-name="${nama}">${nama} · ${jabatan}</option>`;
          }).join('');
        }
      }

      // 2. Ambil data Klien melalui helper API
      const jsonClients = await fetchClients();
      this.clientsList = jsonClients.data || jsonClients.items || (Array.isArray(jsonClients) ? jsonClients : []);

      const clientSelect = document.getElementById('clientSelect');
      if (clientSelect) {
        if (this.clientsList.length === 0) {
          clientSelect.innerHTML = '<option value="">-- Tidak ada klien tersedia --</option>';
        } else {
          clientSelect.innerHTML = this.clientsList.map(c => {
            const id = c.clientId || c.code || c.id || '';
            const nama = c.name || c.companyName || '';
            return `<option value="${id}" data-name="${nama}">${nama}</option>`;
          }).join('');
        }
      }
    } catch (err) {
      console.error('[FormView] Gagal memuat data master SDM / Klien:', err);
    }
  },

  clearErrors() {
    ['errProjectName', 'errStartDate', 'errTargetEndDate', 'errModalClientName'].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = '';
        el.classList.add('hidden');
      }
    });
    document.querySelectorAll('#projectForm input').forEach(inp => inp.classList.remove('border-rose-500'));
  },

  resetForCreate() {
    this.editingProjectId = null;
    this.clearErrors();
    const form = document.getElementById('projectForm');
    form?.reset();

    const titleEl = document.getElementById('formViewTitle');
    if (titleEl) titleEl.textContent = 'Registrasi Draf Proyek Baru';

    const subEl = document.getElementById('formViewSubtitle');
    if (subEl) subEl.textContent = 'Lengkapi informasi awal proyek sebelum handover ke Project Manager.';

    const badgeEl = document.getElementById('formBadgeCode');
    if (badgeEl) badgeEl.textContent = 'DRAFT';

    const btnDraft = document.getElementById('btnSubmitDraft');
    if (btnDraft) btnDraft.textContent = 'Simpan Draf';

    document.getElementById('btnSimpanKirim')?.classList.remove('hidden');

    // Sinkronkan nama AM dengan sesi aktif F-1
    const amInput = document.getElementById('amName');
    if (amInput) {
      const user = JSON.parse(localStorage.getItem('user')) || { namaLengkap: 'Fikri Lazuardi Fadilla' };
      amInput.value = user.namaLengkap || 'Fikri Lazuardi Fadilla';
    }

    const dispVal = document.getElementById('indicativeValueDisplay');
    const rawVal = document.getElementById('indicativeValue');
    if (dispVal && rawVal) {
      dispVal.value = 'Rp 0';
      rawVal.value = '0';
    }

    this.bindCurrencyFormatting();
  },

  populateForEdit(project) {
    this.editingProjectId = project.projectId;
    this.clearErrors();

    const titleEl = document.getElementById('formViewTitle');
    if (titleEl) titleEl.textContent = 'Ubah Data Proyek';

    const badgeEl = document.getElementById('formBadgeCode');
    if (badgeEl) badgeEl.textContent = `${project.status}`;

    const identifier = project.canonicalCode
      ? `Kode ${project.canonicalCode}`
      : (project.projectName || `#${project.projectId.substring(0, 8)}`);

    const subEl = document.getElementById('formViewSubtitle');
    if (subEl) subEl.textContent = `Perbarui rincian data untuk ${identifier}.`;

    const btnDraft = document.getElementById('btnSubmitDraft');
    if (btnDraft) btnDraft.textContent = 'Simpan Perubahan';

    document.getElementById('btnSimpanKirim')?.classList.add('hidden');

    const pName = document.getElementById('projectName');
    if (pName) pName.value = project.projectName || '';

    const amInput = document.getElementById('amName');
    if (amInput) amInput.value = project.amName || 'Fikri Lazuardi Fadilla';

    const sDate = document.getElementById('startDate');
    if (sDate) sDate.value = project.startDate || '';

    const eDate = document.getElementById('targetEndDate');
    if (eDate) eDate.value = project.targetEndDate || '';

    const dispVal = document.getElementById('indicativeValueDisplay');
    const rawVal = document.getElementById('indicativeValue');
    if (dispVal && rawVal) {
      rawVal.value = project.indicativeValue || 0;
      dispVal.value = this.formatRupiahInput(project.indicativeValue || 0);
    }

    const clientSelect = document.getElementById('clientSelect');
    if (clientSelect) {
      let matched = false;
      for (const opt of clientSelect.options) {
        if (opt.value === project.clientId || opt.text.includes(project.clientName) || opt.getAttribute('data-name') === project.clientName) {
          opt.selected = true;
          matched = true;
          break;
        }
      }
      if (!matched && project.clientName) {
        const customOpt = document.createElement('option');
        customOpt.value = project.clientId || project.clientName;
        customOpt.textContent = project.clientName;
        customOpt.selected = true;
        clientSelect.prepend(customOpt);
      }
    }

    const pmSelect = document.getElementById('pmSelect');
    if (pmSelect) {
      let matched = false;
      for (const opt of pmSelect.options) {
        if (opt.value === project.pmEmployeeId || opt.text.includes(project.pmName) || opt.getAttribute('data-name') === project.pmName) {
          opt.selected = true;
          matched = true;
          break;
        }
      }
      if (!matched && project.pmName) {
        const customOpt = document.createElement('option');
        customOpt.value = project.pmEmployeeId || 'SDM-TEMP';
        customOpt.textContent = `${project.pmName} · Project Manager`;
        customOpt.selected = true;
        pmSelect.prepend(customOpt);
      }
    }

    this.bindCurrencyFormatting();
  },

  bindCurrencyFormatting() {
    const dispVal = document.getElementById('indicativeValueDisplay');
    const rawVal = document.getElementById('indicativeValue');
    if (!dispVal || !rawVal) return;

    dispVal.onfocus = () => {
      if (rawVal.value === '0') {
        dispVal.value = '';
      }
    };

    dispVal.onblur = () => {
      if (!rawVal.value || rawVal.value === '0') {
        dispVal.value = 'Rp 0';
        rawVal.value = '0';
      }
    };

    dispVal.oninput = (e) => {
      const clean = e.target.value.replace(/[^0-9]/g, '');
      rawVal.value = clean || '0';
      dispVal.value = clean ? this.formatRupiahInput(clean) : 'Rp 0';
    };
  },

  validate() {
    this.clearErrors();
    let hasError = false;

    const projectName = document.getElementById('projectName')?.value.trim() || '';
    const startDate = document.getElementById('startDate')?.value || '';
    const targetEndDate = document.getElementById('targetEndDate')?.value || '';

    if (!projectName || projectName.length < 5) {
      const err = document.getElementById('errProjectName');
      if (err) {
        err.textContent = 'Nama proyek wajib diisi (minimal 5 karakter)';
        err.classList.remove('hidden');
      }
      document.getElementById('projectName')?.classList.add('border-rose-500');
      hasError = true;
    }

    if (!startDate) {
      const err = document.getElementById('errStartDate');
      if (err) {
        err.textContent = 'Estimasi tanggal mulai wajib ditentukan';
        err.classList.remove('hidden');
      }
      document.getElementById('startDate')?.classList.add('border-rose-500');
      hasError = true;
    }

    if (!targetEndDate) {
      const err = document.getElementById('errTargetEndDate');
      if (err) {
        err.textContent = 'Estimasi target selesai wajib ditentukan';
        err.classList.remove('hidden');
      }
      document.getElementById('targetEndDate')?.classList.add('border-rose-500');
      hasError = true;
    }

    if (startDate && targetEndDate && new Date(targetEndDate) < new Date(startDate)) {
      const err = document.getElementById('errTargetEndDate');
      if (err) {
        err.textContent = 'Target tanggal selesai tidak boleh mendahului tanggal mulai proyek';
        err.classList.remove('hidden');
      }
      document.getElementById('targetEndDate')?.classList.add('border-rose-500');
      hasError = true;
    }

    return !hasError;
  },

  async handleFormSubmit(sendToPmAfterSave = false, onSuccess, onError) {
    if (!this.validate()) return;

    const clientSelect = document.getElementById('clientSelect');
    const pmSelect = document.getElementById('pmSelect');
    const rawVal = document.getElementById('indicativeValue')?.value || '0';

    const currentUser = JSON.parse(localStorage.getItem('user')) || {
      namaLengkap: 'Fikri Lazuardi Fadilla'
    };
    const amNameVal = document.getElementById('amName')?.value?.trim() || currentUser.namaLengkap || 'Fikri Lazuardi Fadilla';

    const payload = {
      projectName: document.getElementById('projectName').value.trim(),
      clientName: clientSelect.selectedOptions[0]?.getAttribute('data-name') || clientSelect.selectedOptions[0]?.text || clientSelect.value,
      clientId: clientSelect.value,
      pmEmployeeId: pmSelect.value,
      pmName: pmSelect.selectedOptions[0]?.getAttribute('data-name') || pmSelect.selectedOptions[0]?.text?.split('·')[0]?.trim() || 'Project Manager',
      amName: amNameVal,
      startDate: document.getElementById('startDate').value,
      targetEndDate: document.getElementById('targetEndDate').value,
      indicativeValue: Number(rawVal)
    };

    try {
      if (this.editingProjectId) {
        const res = await updateProject(this.editingProjectId, payload);
        const updated = res.data || res;
        this.editingProjectId = null;
        onSuccess(updated, 'Data draf proyek berhasil diperbarui');
      } else {
        const res = await createProject(payload);
        const created = res.data || res;

        if (sendToPmAfterSave && created?.projectId) {
          await handoverProject(created.projectId);
          onSuccess(created, 'Proyek berhasil diajukan untuk review PM');
        } else {
          onSuccess(created, 'Draf proyek berhasil disimpan');
        }
      }
    } catch (err) {
      onError(err.message || 'Gagal menyimpan data proyek');
    }
  },

  initClientModal(onClientCreated, onError) {
    const modal = document.getElementById('clientModal');
    const openBtn = document.getElementById('btnOpenClientModal');
    const closeBtn = document.getElementById('btnCloseClientModal');
    const cancelBtn = document.getElementById('btnCancelClientModal');
    const saveBtn = document.getElementById('btnSaveClientModal');

    const open = () => {
      this.clearErrors();
      const clientNameInp = document.getElementById('modalClientName');
      if (clientNameInp) clientNameInp.value = '';
      modal?.classList.remove('hidden');
      modal?.classList.add('flex');
    };

    const close = () => {
      modal?.classList.add('hidden');
      modal?.classList.remove('flex');
    };

    openBtn?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    cancelBtn?.addEventListener('click', close);

    saveBtn?.addEventListener('click', async () => {
      const name = document.getElementById('modalClientName')?.value.trim() || '';
      if (!name || name.length < 3) {
        const err = document.getElementById('errModalClientName');
        if (err) {
          err.textContent = 'Nama instansi minimal 3 karakter';
          err.classList.remove('hidden');
        }
        return;
      }

      try {
        const newClient = await createTemporaryClient(name);
        await this.loadMasterData();
        const clientSelect = document.getElementById('clientSelect');
        if (clientSelect) {
          const cId = newClient.clientId || newClient.tempClientId || name;
          const cName = newClient.companyName || newClient.name || name;
          const opt = document.createElement('option');
          opt.value = cId;
          opt.textContent = cName;
          opt.setAttribute('data-name', cName);
          opt.selected = true;
          clientSelect.prepend(opt);
        }
        close();
        if (typeof onClientCreated === 'function') {
          onClientCreated(newClient);
        }
      } catch (err) {
        if (typeof onError === 'function') {
          onError(err.message || 'Gagal menambahkan klien sementara');
        }
      }
    });
  }
};