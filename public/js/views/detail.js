// public/js/views/detail.js - Logika Layar Detail Proyek & Verifikasi PM (UI-K01-03)
import {
  fetchProjectIntakeDetail,
  updateDocumentStatus,
  approveProject,
  rejectProject,
  deleteProject,
  handoverProject
} from '../api.js';

export const DetailView = {
  activeProject: null,
  listenersInitialized: false,
  onOpenEdit: null,
  onToast: null,
  onDeleteSuccess: null,

  formatRupiah(val) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(Number(val || 0));
  },

  formatDateOnly(dateStr) {
    if (!dateStr) return '-';
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  },

  formatTanggalWib(isoStr) {
    if (!isoStr) return '-';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return isoStr;

      const tgl = d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
      const jam = d.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).replace('.', ':');

      return `${tgl} · ${jam} WIB`;
    } catch {
      return isoStr;
    }
  },

  async loadAndRender(projectId, onToast) {
    try {
      const res = await fetchProjectIntakeDetail(projectId);
      const proj = res.data || res;
      this.activeProject = proj;
      this.renderHeader(proj);
      this.renderMetadata(proj);
      this.renderRejectionBanner(proj);
      this.renderDocuments(proj);
      this.renderPmPanel(proj);
      this.renderTimeline(proj);
    } catch (err) {
      if (typeof onToast === 'function') {
        onToast(err.message || 'Gagal memuat rincian proyek', true);
      }
    }
  },

  renderHeader(proj) {
    const code = (proj.status === 'REGISTERED' && proj.canonicalCode)
      ? proj.canonicalCode
      : (proj.canonicalCode || '-');

    const currentUser = JSON.parse(localStorage.getItem('user') || '{"peran":"AM"}');
    const isAm = currentUser.peran === 'AM';

    document.getElementById('detailTitle').textContent = `Kode ${code}`;
    document.getElementById('detailSubtitle').textContent = `${proj.projectName} - ${proj.clientName || proj.clientId}`;

    // Kontrol Tombol Ubah Proyek (Muncul jika status DRAFT atau REVISI_HANDOVER untuk AM)
    const btnEdit = document.getElementById('btnEditProject');
    if (btnEdit) {
      const canEdit = (proj.status === 'DRAFT' || proj.status === 'REVISI_HANDOVER') && isAm;
      btnEdit.classList.toggle('hidden', !canEdit);
    }

    // Kontrol Tombol Hapus Draf (Hanya muncul jika status DRAFT dan peran AM)
    const btnDelete = document.getElementById('btnDeleteProject');
    if (btnDelete) {
      const canDelete = proj.status === 'DRAFT' && isAm;
      btnDelete.classList.toggle('hidden', !canDelete);
    }

    // Badge Status Proyek
    const badge = document.getElementById('detailBadgeStatus');
    if (badge) {
      if (proj.status === 'REGISTERED') {
        badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60';
        badge.textContent = 'REGISTERED';
      } else if (proj.status === 'REVISI_HANDOVER') {
        badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60';
        badge.textContent = 'REVISI_HANDOVER';
      } else if (proj.status === 'UNDER_REVIEW') {
        badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60';
        badge.textContent = 'UNDER_REVIEW';
      } else {
        badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200';
        badge.textContent = 'DRAFT';
      }
    }

    // Kontrol Tombol Unduh Project Charter (Hanya muncul jika REGISTERED)
    const btnCharter = document.getElementById('btnDownloadCharter');
    if (btnCharter) {
      btnCharter.classList.toggle('hidden', proj.status !== 'REGISTERED');
    }
  },

  renderMetadata(proj) {
    const code = (proj.status === 'REGISTERED' && proj.canonicalCode)
      ? proj.canonicalCode
      : (proj.canonicalCode || '-');

    document.getElementById('detailCode').textContent = code;
    document.getElementById('detailClient').textContent = proj.clientName || proj.clientId || '-';
    document.getElementById('detailAm').textContent = proj.amName || 'Fikri Lazuardi Fadilla';
    document.getElementById('detailPm').textContent = proj.pmName || 'Project Manager';
    document.getElementById('panelPmName').textContent = proj.pmName || 'Project Manager';

    // Inisial avatar PM
    const pmInitials = (proj.pmName || 'PM')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    const avatarEl = document.getElementById('panelPmAvatar');
    if (avatarEl) avatarEl.textContent = pmInitials;

    // Tanggal Pengajuan
    const rawDate = proj.createdAt || proj.updatedAt || new Date().toISOString();
    document.getElementById('detailSubmissionDate').textContent = this.formatTanggalWib(rawDate);

    // Estimasi Tanggal Mulai & Selesai
    if (proj.startDate && proj.targetEndDate) {
      const startFormatted = this.formatDateOnly(proj.startDate);
      const endFormatted = this.formatDateOnly(proj.targetEndDate);
      document.getElementById('detailDates').textContent = `${startFormatted} s.d. ${endFormatted}`;
    } else {
      document.getElementById('detailDates').textContent = '-';
    }

    document.getElementById('detailValue').textContent = this.formatRupiah(proj.indicativeValue);
  },

  renderRejectionBanner(proj) {
    const rejBanner = document.getElementById('detailRejectionBanner');
    const rejText = document.getElementById('detailRejectionText');
    if (!rejBanner) return;

    if (proj.rejectionNotes && proj.status === 'REVISI_HANDOVER') {
      if (rejText) rejText.textContent = `"${proj.rejectionNotes}"`;
      rejBanner.classList.remove('hidden');
    } else {
      rejBanner.classList.add('hidden');
    }
  },

  renderDocuments(proj) {
    const container = document.getElementById('documentListContainer');
    if (!container) return;

    const currentUser = JSON.parse(localStorage.getItem('user') || '{"peran":"AM"}');
    const isAm = currentUser.peran === 'AM';
    const canAmUpdateDocuments = isAm && proj.status !== 'UNDER_REVIEW' && proj.status !== 'REGISTERED';

    // 1. Data 5 Berkas Dokumen Standar WI-01 (Mock representatif)
    const standardDocs = [
      { type: 'RKS', size: '1,8 MB', defaultName: `RKS_${(proj.clientName || 'Proyek').replace(/\s+/g, '')}.pdf` },
      { type: 'SPK', size: '820 KB', defaultName: `SPK_${proj.canonicalCode || '202602'}.pdf` },
      { type: 'Kontrak', size: '2,4 MB', defaultName: `Kontrak_${(proj.clientName || 'Proyek').replace(/\s+/g, '')}.pdf` },
      { type: 'KAK', size: '640 KB', defaultName: `KAK_${(proj.projectName || 'Pekerjaan').replace(/\s+/g, '')}.pdf` },
      { type: 'SOW', size: '1,2 MB', defaultName: `SOW_${(proj.projectName || 'Pekerjaan').replace(/\s+/g, '')}.pdf` }
    ];

    const tglDoc = this.formatTanggalWib(proj.createdAt || new Date()).split(' · ')[0];

    const docsHtml = standardDocs.map(doc => `
      <div class="p-3.5 rounded-xl border border-slate-200 bg-white flex items-center justify-between">
        <div class="flex items-center space-x-3">
          <div class="w-8 h-8 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center text-slate-400">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div class="font-bold text-slate-900 text-xs">${doc.type}</div>
            <div class="text-[11px] text-slate-400 mt-0.5 truncate max-w-[150px]">${doc.defaultName}</div>
            <div class="text-[10px] text-slate-400">${doc.size} · ${tglDoc}</div>
          </div>
        </div>
        <div class="w-5 h-5 rounded-full border border-emerald-400 text-emerald-600 flex items-center justify-center text-[10px] font-bold">✓</div>
      </div>
    `).join('');

    // 2. Kartu Dokumen PO (Item ke-6: Penentu blokir termin modul E-2)
    let poCardHtml = '';
    if (proj.poReceived) {
      poCardHtml = `
        <div id="poCardContainer" class="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between ${canAmUpdateDocuments ? 'cursor-pointer hover:bg-emerald-100/50 transition' : 'cursor-default'}" title="${canAmUpdateDocuments ? 'Klik untuk membatalkan status PO' : ''}">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <div class="font-bold text-emerald-900 text-xs">PO</div>
              <div class="text-[11px] text-emerald-800 font-semibold mt-0.5">PO_${proj.canonicalCode || 'Fisik'}.pdf</div>
              <div class="text-[10px] text-emerald-700/80">1,1 MB · Terverifikasi</div>
            </div>
          </div>
          <div class="w-5 h-5 rounded-full border border-emerald-400 text-emerald-600 flex items-center justify-center text-[10px] font-bold">✓</div>
        </div>
      `;
    } else {
      poCardHtml = `
        <div id="poCardContainer" class="p-3.5 rounded-xl border border-dashed border-amber-300 bg-[#fef9ee] flex items-center justify-between ${canAmUpdateDocuments ? 'cursor-pointer hover:bg-amber-100/50 transition' : 'cursor-default'}" title="${canAmUpdateDocuments ? 'Klik untuk menandai PO fisik tersedia' : ''}">
          <div class="flex items-center space-x-3">
            <div class="w-8 h-8 rounded-lg bg-amber-100/80 text-amber-700 flex items-center justify-center">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <div class="font-bold text-amber-900 text-xs">PO</div>
              <div class="text-[11px] text-amber-800 font-semibold mt-0.5">Unggah PO fisik</div>
              <div class="text-[10px] text-amber-700/80">PDF · maks. 10 MB</div>
            </div>
          </div>
          <div class="w-5 h-5 rounded-full bg-amber-200/80 text-amber-800 flex items-center justify-center text-[10px] font-bold">!</div>
        </div>
      `;
    }

    container.innerHTML = docsHtml + poCardHtml;

    // 3. Sakelar Dokumen Lengkap MANUAL
    const toggleDocs = document.getElementById('toggleDocsComplete');
    const docsCompleteControl = document.getElementById('docsCompleteControl');
    docsCompleteControl?.classList.toggle('hidden', !isAm);

    if (toggleDocs) {
      toggleDocs.checked = Boolean(proj.documentsComplete);
      toggleDocs.disabled = !canAmUpdateDocuments;
    }
    docsCompleteControl?.classList.toggle('opacity-60', isAm && !canAmUpdateDocuments);
    docsCompleteControl?.querySelector('label')?.classList.toggle('cursor-not-allowed', !canAmUpdateDocuments);
    docsCompleteControl?.querySelector('label')?.classList.toggle('cursor-pointer', canAmUpdateDocuments);

    // 4. Banner Peringatan Proteksi Penagihan Modul E-2
    const poBanner = document.getElementById('poWarningBanner');
    if (poBanner) {
      poBanner.classList.toggle('hidden', Boolean(proj.poReceived));
    }

    // 5. Checklist manual di panel kanan
    const chkDoc = document.getElementById('chkManualCompleteIcon');
    if (chkDoc) {
      chkDoc.className = proj.documentsComplete ? 'text-emerald-600 font-bold' : 'text-slate-300 font-bold';
    }
  },

  renderTimeline(proj) {
    const container = document.getElementById('historyTimelineContainer');
    if (!container) return;

    const logs = proj.auditLogs || proj.project_audit_logs || [];
    let timelineItems = [];

    if (logs.length > 0) {
      timelineItems = logs.map(l => ({
        title: l.action === 'CREATE_DRAFT' ? 'Draf proyek dibuat'
             : l.action === 'HANDOVER' ? 'Dikirim untuk review PM'
             : l.action === 'REJECT' ? 'Handover ditolak PM (Perlu Revisi)'
             : l.action === 'APPROVE' ? 'Disetujui & Resmi Terdaftar'
             : l.action,
        actor: (l.action === 'REJECT' || l.action === 'APPROVE')
          ? (proj.pmName || 'PM')
          : (proj.amName || 'AM'),
        time: this.formatTanggalWib(l.timestamp || l.createdAt),
        details: l.details || ''
      }));
    } else {
      timelineItems.push({
        title: 'Draf proyek dibuat',
        actor: proj.amName || 'Fikri Lazuardi Fadilla',
        time: this.formatTanggalWib(proj.createdAt || new Date().toISOString()),
        details: ''
      });
    }

    container.innerHTML = timelineItems.map((item, idx) => {
      const dotColor = idx === 0 ? 'bg-slate-900 ring-4 ring-slate-100' : 'bg-slate-300';
      const titleColor = idx === 0 ? 'text-slate-900 font-bold' : 'text-slate-700 font-semibold';
      const escapedDetails = String(item.details || '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
      })[c]);
      const detailsHtml = escapedDetails
        ? `<div class="mt-1 text-[10px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100 italic font-medium">"${escapedDetails}"</div>`
        : '';

      return `
        <div class="relative pb-3">
          <span class="w-2.5 h-2.5 rounded-full ${dotColor} absolute -left-[21.5px] top-1"></span>
          <div class="${titleColor} text-[11px] leading-tight">${item.title}</div>
          <div class="text-[10px] text-slate-400 mt-0.5">${item.actor} · ${item.time}</div>
          ${detailsHtml}
        </div>
      `;
    }).join('');
  },

  renderPmPanel(proj) {
    const currentUser = JSON.parse(localStorage.getItem('user') || '{"peran":"AM"}');
    const isAm = currentUser.peran === 'AM';
    const isPm = currentUser.peran === 'PM';

    const btnApprove = document.getElementById('btnApprovePM');
    const btnReject = document.getElementById('btnRejectPM');
    const btnHandover = document.getElementById('btnSubmitHandover');
    const notesInput = document.getElementById('pmNotes');
    const errNotes = document.getElementById('errPmNotes');
    const charLabel = document.getElementById('charCountLabel');
    const notesLabel = notesInput?.previousElementSibling;

    if (errNotes) errNotes.classList.add('hidden');

    // 1. Kondisi: DRAFT atau REVISI_HANDOVER (Wewenang AM)
    if (proj.status === 'DRAFT' || proj.status === 'REVISI_HANDOVER') {
      btnApprove?.classList.add('hidden');
      btnReject?.classList.add('hidden');

      if (btnHandover) {
        btnHandover.classList.toggle('hidden', !isAm);
        btnHandover.innerHTML = proj.status === 'REVISI_HANDOVER'
          ? '<span>Ajukan Handover Ulang ke PM</span>'
          : '<span>Ajukan Serah Terima ke PM</span>';
      }

      if (notesInput) {
        const canReply = isAm && proj.status === 'REVISI_HANDOVER';
        notesInput.disabled = !canReply;
        notesInput.value = '';
        notesInput.placeholder = canReply
          ? 'Tulis balasan atau keterangan perbaikan untuk PM (opsional).'
          : 'Catatan revisi PM akan tampil saat proyek dikembalikan untuk revisi.';
      }

      if (notesLabel) {
        notesLabel.innerHTML = (proj.status === 'REVISI_HANDOVER' && isAm)
          ? 'Catatan balasan AM untuk PM (opsional)'
          : 'Catatan Revisi PM (Min. 20 karakter) <span class="text-rose-500">*</span>';
      }

      if (charLabel) {
        const showReplyCounter = isAm && proj.status === 'REVISI_HANDOVER';
        charLabel.classList.toggle('hidden', !showReplyCounter);
        if (showReplyCounter) {
          charLabel.className = 'text-slate-400 font-semibold';
          charLabel.textContent = 'Opsional (Max. 1000 karakter)';
        }
      }
    }
    // 2. Kondisi: UNDER_REVIEW (Wewenang Verifikasi PM)
    else if (proj.status === 'UNDER_REVIEW') {
      btnHandover?.classList.add('hidden');
      btnApprove?.classList.toggle('hidden', !isPm);
      btnReject?.classList.toggle('hidden', !isPm);

      if (btnApprove) {
        btnApprove.disabled = false;
        btnApprove.className = 'w-full py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2';
        btnApprove.innerHTML = '<span>Terima & Registrasi Proyek</span>';
      }

      if (btnReject) {
        btnReject.disabled = false;
        btnReject.classList.remove('opacity-50', 'cursor-not-allowed');
      }

      if (notesInput) {
        notesInput.disabled = !isPm;
        notesInput.value = '';
        notesInput.placeholder = 'Mohon unggah PO fisik dan konfirmasi jadwal pelaksanaan dengan klien.';
      }

      if (notesLabel) {
        notesLabel.innerHTML = 'Catatan Revisi PM (Min. 20 karakter) <span class="text-rose-500">*</span>';
      }

      if (charLabel) {
        charLabel.classList.toggle('hidden', !isPm);
        charLabel.className = 'text-slate-400 font-semibold';
        charLabel.textContent = '0/20 karakter';
      }
    }
    // 3. Kondisi: REGISTERED (Kunci Selesai)
    else if (proj.status === 'REGISTERED') {
      btnHandover?.classList.add('hidden');
      btnReject?.classList.add('hidden');

      if (btnApprove) {
        btnApprove.disabled = true;
        btnApprove.className = 'w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold cursor-not-allowed flex items-center justify-center space-x-2';
        btnApprove.innerHTML = '<span>Proyek Resmi Terdaftar (REGISTERED)</span>';
        btnApprove.classList.toggle('hidden', !isPm);
      }

      if (notesInput) {
        notesInput.disabled = true;
        notesInput.value = '';
        notesInput.placeholder = 'Proyek telah resmi terdaftar. Panel verifikasi ditutup.';
      }

      if (charLabel) charLabel.classList.add('hidden');
    }
  },

  initListeners(onOpenEdit, onToast, onDeleteSuccess) {
    this.onOpenEdit = onOpenEdit;
    this.onToast = onToast;
    this.onDeleteSuccess = onDeleteSuccess;

    if (this.listenersInitialized) return;
    this.listenersInitialized = true;

    // ========================================================================
    // DELEGASI EVENT TUNGGAL UNTUK SELURUH KLIK TOMBOL LAYAR DETAIL
    // ========================================================================
    document.addEventListener('click', async (e) => {
      // 1. BUKA MODAL KONFIRMASI HAPUS DRAF
      const btnDelete = e.target.closest('#btnDeleteProject');
      if (btnDelete && this.activeProject) {
        const modal = document.getElementById('deleteConfirmModal');
        const nameLabel = document.getElementById('deleteModalProjectName');
        if (nameLabel) nameLabel.textContent = `"${this.activeProject.projectName}"`;
        modal?.classList.remove('hidden');
        return;
      }

      // 2. TOMBOL BATAL PADA MODAL HAPUS
      if (e.target.closest('#btnCancelDeleteModal')) {
        document.getElementById('deleteConfirmModal')?.classList.add('hidden');
        return;
      }

      // 3. TOMBOL KONFIRMASI HAPUS PERMANEN
      const btnConfirmDelete = e.target.closest('#btnConfirmDeleteModal');
      if (btnConfirmDelete && this.activeProject) {
        const modal = document.getElementById('deleteConfirmModal');
        try {
          btnConfirmDelete.disabled = true;
          btnConfirmDelete.innerHTML = '<span>Menghapus...</span>';

          await deleteProject(this.activeProject.projectId);
          const deletedName = this.activeProject.projectName;
          this.activeProject = null;

          modal?.classList.add('hidden');

          if (typeof this.onToast === 'function') {
            this.onToast(`Draf proyek "${deletedName}" berhasil dihapus permanen`);
          }

          if (typeof this.onDeleteSuccess === 'function') {
            this.onDeleteSuccess();
          } else {
            document.getElementById('btnBackFromDetail')?.click();
          }
        } catch (err) {
          if (typeof this.onToast === 'function') {
            this.onToast(err.message || 'Gagal menghapus draf proyek', true);
          }
        } finally {
          btnConfirmDelete.disabled = false;
          btnConfirmDelete.innerHTML = '<span>Hapus</span>';
        }
        return;
      }

      // 4. TOMBOL UBAH DATA PROYEK
      const btnEdit = e.target.closest('#btnEditProject');
      if (btnEdit && this.activeProject?.projectId) {
        if (typeof this.onOpenEdit === 'function') {
          this.onOpenEdit(this.activeProject.projectId);
        }
        return;
      }

      // 5. TOMBOL AJUKAN HANDOVER (AM KE PM)
      const btnHandover = e.target.closest('#btnSubmitHandover');
      if (btnHandover && this.activeProject) {
        try {
          btnHandover.disabled = true;
          const res = await handoverProject(this.activeProject.projectId);
          this.activeProject = res.data || res;

          if (typeof this.onToast === 'function') {
            this.onToast(`Proyek berhasil diserahkan ke PM (${this.activeProject.status})`);
          }
          await this.loadAndRender(this.activeProject.projectId, this.onToast);
        } catch (err) {
          if (typeof this.onToast === 'function') {
            this.onToast(err.message || 'Gagal mengajukan handover ke PM', true);
          }
        } finally {
          btnHandover.disabled = false;
        }
        return;
      }

      // 6. TOMBOL UNDUH PROJECT CHARTER (PDF)
      const btnCharter = e.target.closest('#btnDownloadCharter');
      if (btnCharter && this.activeProject?.projectId) {
        window.open(`/api/v1/projects/${this.activeProject.projectId}/charter`, '_blank');
        return;
      }

      // 7. KLIK KARTU PO (UBAH STATUS UNGGAHAN PO FISIK)
      const poCard = e.target.closest('#poCardContainer');
      if (poCard && this.activeProject) {
        const currentUser = JSON.parse(localStorage.getItem('user') || '{"peran":"AM"}');
        if (currentUser.peran !== 'AM' || this.activeProject.status === 'UNDER_REVIEW' || this.activeProject.status === 'REGISTERED') {
          return;
        }

        try {
          const nextPoState = !this.activeProject.poReceived;
          const res = await updateDocumentStatus(this.activeProject.projectId, {
            poReceived: nextPoState
          });
          this.activeProject = res.data || res;
          this.renderDocuments(this.activeProject);

          if (typeof this.onToast === 'function') {
            this.onToast(
              nextPoState ? 'Dokumen PO fisik berhasil diverifikasi. Blokir penagihan E2 dibuka.' : 'PO ditandai belum diunggah. Penagihan E2 diblokir.',
              !nextPoState
            );
          }
        } catch (err) {
          if (typeof this.onToast === 'function') {
            this.onToast(err.message || 'Gagal mengubah status PO fisik', true);
          }
        }
        return;
      }

      // 8. TOMBOL TERIMA & REGISTRASI PROYEK OLEH PM
      const btnApprove = e.target.closest('#btnApprovePM');
      if (btnApprove && this.activeProject) {
        try {
          btnApprove.disabled = true;
          const res = await approveProject(this.activeProject.projectId);
          const updated = res.data || res;

          if (typeof this.onToast === 'function') {
            this.onToast(`Proyek ${updated.canonicalCode || ''} resmi REGISTERED`);
          }
          await this.loadAndRender(this.activeProject.projectId, this.onToast);
        } catch (err) {
          if (typeof this.onToast === 'function') {
            this.onToast(err.message || 'Gagal menyetujui proyek', true);
          }
          btnApprove.disabled = false;
        }
        return;
      }

      // 9. TOMBOL TOLAK (BUTUH REVISI) OLEH PM
      const btnReject = e.target.closest('#btnRejectPM');
      if (btnReject && this.activeProject) {
        const notesInput = document.getElementById('pmNotes');
        const errEl = document.getElementById('errPmNotes');
        const notes = notesInput?.value.trim() || '';

        if (notes.length < 20) {
          if (errEl) {
            errEl.textContent = 'Catatan revisi wajib diisi minimal 20 karakter.';
            errEl.className = 'text-rose-600 font-bold';
            errEl.classList.remove('hidden');
          }
          notesInput?.classList.add('border-rose-500');
          return;
        }

        notesInput?.classList.remove('border-rose-500');

        try {
          btnReject.disabled = true;
          await rejectProject(this.activeProject.projectId, notes);
          if (notesInput) notesInput.value = '';

          if (typeof this.onToast === 'function') {
            this.onToast('Handover dikembalikan ke AM untuk revisi');
          }
          await this.loadAndRender(this.activeProject.projectId, this.onToast);
        } catch (err) {
          if (typeof this.onToast === 'function') {
            this.onToast(err.message || 'Gagal menolak handover', true);
          }
          btnReject.disabled = false;
        }
        return;
      }
    });

    // SAKELAR DOKUMEN LENGKAP MANUAL (WI-01)
    document.addEventListener('change', async (e) => {
      if (e.target.id === 'toggleDocsComplete' && this.activeProject) {
        try {
          const nextState = e.target.checked;
          const res = await updateDocumentStatus(this.activeProject.projectId, {
            documentsComplete: nextState
          });
          this.activeProject = res.data || res;
          this.renderDocuments(this.activeProject);

          if (typeof this.onToast === 'function') {
            this.onToast(`Status kelengkapan WI-01 ditandai: ${nextState ? 'Lengkap' : 'Belum Lengkap'}`);
          }
        } catch (err) {
          if (typeof this.onToast === 'function') {
            this.onToast(err.message || 'Gagal memperbarui status dokumen', true);
          }
        }
      }
    });

    // PENGHITUNG KARAKTER CATATAN REVISI PM
    document.addEventListener('input', (e) => {
      if (e.target.id === 'pmNotes') {
        const charLabel = document.getElementById('charCountLabel');
        const len = e.target.value.trim().length;
        if (charLabel) {
          if (len >= 20) {
            charLabel.className = 'text-emerald-600 font-semibold';
            charLabel.textContent = `${len}/20 karakter (Valid)`;
          } else {
            charLabel.className = 'text-slate-400 font-medium';
            charLabel.textContent = `${len}/20 karakter (Kurang ${20 - len})`;
          }
        }
      }
    });
  }
};