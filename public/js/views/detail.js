// public/js/views/detail.js - Logika Khusus Layar Detail Proyek & Verifikasi PM (UI-K01-03)
import {
  fetchProjectById,
  updateDocumentStatus,
  approveProject,
  rejectProject
} from '../api.js';

export const DetailView = {
  activeProject: null,
  listenersInitialized: false,

  formatRupiah(val) {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(Number(val || 0));
  },

  // Helper format tanggal kalender (DD Mmm YYYY)
  formatDateOnly(dateStr) {
    if (!dateStr) return '—';
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

  // Helper format timestamp operasional WIB (DD Mmm YYYY · HH:mm WIB)
  formatTanggalWib(isoStr) {
    if (!isoStr) return '—';
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
      const res = await fetchProjectById(projectId);
      const proj = res.data || res;
      this.activeProject = proj;
      this.renderHeader(proj);
      this.renderMetadata(proj);
      this.renderRejectionBanner(proj);
      this.renderDocuments(proj);
      this.renderPmPanel(proj);
      this.renderTimeline(proj);
    } catch (err) {
      onToast(err.message || 'Gagal memuat rincian proyek', true);
    }
  },

  renderHeader(proj) {
    const code = (proj.canonicalCode && proj.status === 'REGISTERED')
      ? proj.canonicalCode
      : (proj.canonicalCode || '—');

    document.getElementById('detailTitle').textContent = `Kode ${code}`;
    document.getElementById('detailSubtitle').textContent = `${proj.projectName} · ${proj.clientName || proj.clientId}`;

    // Kontrol Tombol Ubah Proyek (Hanya muncul jika DRAFT atau REVISI_HANDOVER)
    const btnEdit = document.getElementById('btnEditProject');
    if (btnEdit) {
      if (proj.status === 'DRAFT' || proj.status === 'REVISI_HANDOVER') {
        btnEdit.classList.remove('hidden');
      } else {
        btnEdit.classList.add('hidden');
      }
    }

    const badge = document.getElementById('detailBadgeStatus');
    if (!badge) return;

    if (proj.status === 'REGISTERED') {
      badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60';
      badge.textContent = '• REGISTERED';
    } else if (proj.status === 'REVISI_HANDOVER') {
      badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60';
      badge.textContent = '• REVISI_HANDOVER';
    } else if (proj.status === 'UNDER_REVIEW') {
      badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60';
      badge.textContent = '• UNDER_REVIEW';
    } else {
      badge.className = 'inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200';
      badge.textContent = '• DRAFT';
    }

    // Kontrol Tombol Unduh Project Charter (Hanya muncul jika REGISTERED)
    const btnCharter = document.getElementById('btnDownloadCharter');
    if (btnCharter) {
      if (proj.status === 'REGISTERED') {
        btnCharter.classList.remove('hidden');
      } else {
        btnCharter.classList.add('hidden');
      }
    }
  },

  renderMetadata(proj) {
    document.getElementById('detailCode').textContent = (proj.canonicalCode && proj.status === 'REGISTERED')
      ? proj.canonicalCode
      : (proj.canonicalCode || '—');
    document.getElementById('detailClient').textContent = proj.clientName || proj.clientId || '—';
    document.getElementById('detailAm').textContent = proj.amName || 'Andi Maulana';
    document.getElementById('detailPm').textContent = proj.pmName || 'Budi Santoso';
    document.getElementById('panelPmName').textContent = proj.pmName || 'Budi Santoso';

    // Inisial avatar PM
    const pmInitials = (proj.pmName || 'Budi Santoso')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
    const avatarEl = document.getElementById('panelPmAvatar');
    if (avatarEl) avatarEl.textContent = pmInitials;

    // 1. Tanggal Pengajuan: DD Mmm YYYY · HH:mm WIB
    const rawDate = proj.createdAt || proj.updatedAt || new Date().toISOString();
    document.getElementById('detailSubmissionDate').textContent = this.formatTanggalWib(rawDate);

    // 2. Estimasi Mulai & Selesai: DD Mmm YYYY s.d. DD Mmm YYYY
    if (proj.startDate && proj.targetEndDate) {
      const startFormatted = this.formatDateOnly(proj.startDate);
      const endFormatted = this.formatDateOnly(proj.targetEndDate);
      document.getElementById('detailDates').textContent = `${startFormatted} s.d. ${endFormatted}`;
    } else {
      document.getElementById('detailDates').textContent = '—';
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

    // 1. Data 5 Berkas Dokumen Standar WI-01
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

    // 2. Kartu Dokumen PO (Item ke-6)
    let poCardHtml = '';
    if (proj.poReceived) {
      poCardHtml = `
        <div id="poCardContainer" class="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/60 flex items-center justify-between cursor-pointer hover:bg-emerald-100/50 transition">
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
        <div id="poCardContainer" class="p-3.5 rounded-xl border border-dashed border-amber-300 bg-[#fef9ee] flex items-center justify-between cursor-pointer hover:bg-amber-100/50 transition">
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

    // 3. Sinkronisasi Sakelar Dokumen Lengkap MANUAL
    const toggleDocs = document.getElementById('toggleDocsComplete');
    if (toggleDocs) {
      toggleDocs.checked = Boolean(proj.documentsComplete);
    }

    // 4. Kontrol Banner Peringatan Penagihan E-2
    const poBanner = document.getElementById('poWarningBanner');
    if (poBanner) {
      if (proj.poReceived) {
        poBanner.classList.add('hidden');
      } else {
        poBanner.classList.remove('hidden');
      }
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
        actor: l.actorUserId ? (l.actorUserId.includes('SDM-0004') || l.actorUserId.includes('SDM-0008') ? (proj.pmName || 'PM') : (proj.amName || 'AM')) : 'Sistem',
        time: this.formatTanggalWib(l.timestamp || l.createdAt),
        details: l.details || ''
      }));
    } else {
      timelineItems.push({
        title: 'Draf proyek dibuat',
        actor: proj.amName || 'Andi Maulana',
        time: this.formatTanggalWib(proj.createdAt || new Date().toISOString())
      });

      if (proj.status === 'UNDER_REVIEW' || proj.status === 'REGISTERED' || proj.status === 'REVISI_HANDOVER') {
        timelineItems.unshift({
          title: 'Dikirim untuk review PM',
          actor: proj.amName || 'Andi Maulana',
          time: this.formatTanggalWib(proj.updatedAt || new Date().toISOString())
        });
      }

      if (proj.status === 'REVISI_HANDOVER') {
        timelineItems.unshift({
          title: 'Handover ditolak PM (Perlu Revisi)',
          actor: proj.pmName || 'Budi Santoso',
          time: this.formatTanggalWib(proj.updatedAt || new Date().toISOString()),
          details: proj.rejectionNotes
        });
      }

      if (proj.status === 'REGISTERED') {
        timelineItems.unshift({
          title: 'Disetujui & Resmi Terdaftar',
          actor: proj.pmName || 'Budi Santoso',
          time: this.formatTanggalWib(proj.updatedAt || new Date().toISOString())
        });
      }
    }

    container.innerHTML = timelineItems.map((item, idx) => {
      const dotColor = idx === 0 ? 'bg-slate-900 ring-4 ring-slate-100' : 'bg-slate-300';
      const titleColor = idx === 0 ? 'text-slate-900 font-bold' : 'text-slate-700 font-semibold';
      const detailsHtml = item.details ? `<div class="mt-1 text-[10px] text-rose-600 bg-rose-50 p-2 rounded-lg border border-rose-100 italic font-medium">"${item.details}"</div>` : '';

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
    const btnApprove = document.getElementById('btnApprovePM');
    const btnReject = document.getElementById('btnRejectPM');
    const notesInput = document.getElementById('pmNotes');
    const errNotes = document.getElementById('errPmNotes');
    const charLabel = document.getElementById('charCountLabel');

    // Buat tombol Handover AM jika belum ada di DOM
    let btnHandover = document.getElementById('btnSubmitHandover');
    if (!btnHandover && btnApprove && btnApprove.parentNode) {
      btnHandover = document.createElement('button');
      btnHandover.id = 'btnSubmitHandover';
      btnHandover.type = 'button';
      btnHandover.className = 'w-full py-2.5 rounded-xl bg-[#152a4a] hover:bg-[#0f1f38] text-white text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2';
      btnHandover.innerHTML = '<span>Ajukan Serah Terima ke PM</span><span>→</span>';
      btnApprove.parentNode.insertBefore(btnHandover, btnApprove);
    }

    // 1. KONDISI: Proyek DRAFT atau REVISI_HANDOVER (Wewenang AM)
    if (proj.status === 'DRAFT' || proj.status === 'REVISI_HANDOVER') {
      btnApprove?.classList.add('hidden');
      btnReject?.classList.add('hidden');
      if (notesInput) {
        notesInput.disabled = true;
        notesInput.value = '';
        notesInput.placeholder = 'Panel keputusan PM akan aktif setelah AM mengajukan serah terima (handover).';
      }
      if (errNotes) errNotes.classList.add('hidden');
      if (charLabel) charLabel.classList.add('hidden');

      if (btnHandover) {
        btnHandover.classList.remove('hidden');
        btnHandover.innerHTML = proj.status === 'REVISI_HANDOVER'
          ? '<span>Ajukan Handover Ulang ke PM</span><span>→</span>'
          : '<span>Ajukan Serah Terima ke PM</span><span>→</span>';
      }
    } 
    // 2. KONDISI: Proyek UNDER_REVIEW (Wewenang PM Aktif)
    else if (proj.status === 'UNDER_REVIEW') {
      btnHandover?.classList.add('hidden');
      btnApprove?.classList.remove('hidden');
      btnReject?.classList.remove('hidden');

      if (btnApprove) {
        btnApprove.disabled = false;
        btnApprove.className = 'w-full py-2.5 rounded-xl bg-[#0f766e] hover:bg-[#0d655e] text-white text-xs font-bold shadow-sm transition flex items-center justify-center space-x-2';
        btnApprove.innerHTML = '<span>✓</span><span>Terima & Registrasi Proyek</span>';
      }
      if (btnReject) {
        btnReject.disabled = false;
        btnReject.classList.remove('opacity-50', 'cursor-not-allowed');
      }
      if (notesInput) {
        notesInput.disabled = false;
        notesInput.placeholder = 'Mohon unggah PO fisik dan konfirmasi jadwal pelaksanaan dengan klien.';
      }
      if (charLabel) charLabel.classList.remove('hidden');
    } 
    // 3. KONDISI: Proyek REGISTERED (Terkunci Selesai)
    else if (proj.status === 'REGISTERED') {
      btnHandover?.classList.add('hidden');
      btnApprove?.classList.remove('hidden');
      btnReject?.classList.add('hidden');

      if (btnApprove) {
        btnApprove.disabled = true;
        btnApprove.className = 'w-full py-2.5 rounded-xl bg-slate-200 text-slate-500 text-xs font-bold cursor-not-allowed flex items-center justify-center space-x-2';
        btnApprove.innerHTML = '<span>✓</span><span>Proyek Resmi Terdaftar (REGISTERED)</span>';
      }
      if (notesInput) {
        notesInput.disabled = true;
        notesInput.value = '';
        notesInput.placeholder = 'Proyek telah resmi terdaftar. Panel verifikasi ditutup.';
      }
      if (errNotes) errNotes.classList.add('hidden');
      if (charLabel) charLabel.classList.add('hidden');
    }
  },

  initListeners(onOpenEdit, onToast) {
    if (this.listenersInitialized) return;
    this.listenersInitialized = true;

    // 1. Listener Tombol Serah Terima AM ke PM
    document.addEventListener('click', async (e) => {
      const btn = e.target.closest('#btnSubmitHandover');
      if (btn && this.activeProject) {
        try {
          btn.disabled = true;
          const { handoverProject } = await import('../api.js');
          const res = await handoverProject(this.activeProject.projectId);
          this.activeProject = res.data || res;
          onToast(`Proyek berhasil diserahkan ke PM (${this.activeProject.status})`);
          await this.loadAndRender(this.activeProject.projectId, onToast);
        } catch (err) {
          onToast(err.message || 'Gagal mengajukan handover ke PM', true);
        } finally {
          btn.disabled = false;
        }
      }
    });

    // 2. Tombol Ubah Data Proyek
    document.getElementById('btnEditProject')?.addEventListener('click', () => {
      if (this.activeProject?.projectId) {
        onOpenEdit(this.activeProject.projectId);
      }
    });

    // 3. Sakelar Manual Dokumen Lengkap (WI-01)
    document.getElementById('toggleDocsComplete')?.addEventListener('change', async (e) => {
      if (!this.activeProject) return;
      try {
        const nextState = e.target.checked;
        const res = await updateDocumentStatus(this.activeProject.projectId, {
          documentsComplete: nextState
        });
        this.activeProject = res.data || res;
        this.renderDocuments(this.activeProject);
        onToast(`Status kelengkapan WI-01 ditandai: ${nextState ? 'Lengkap' : 'Belum Lengkap'}`);
      } catch (err) {
        onToast(err.message || 'Gagal memperbarui status dokumen', true);
      }
    });

    // 4. Klik Kartu PO (Mengubah Status Unggahan PO & Peringatan E-2)
    document.getElementById('documentListContainer')?.addEventListener('click', async (e) => {
      const poCard = e.target.closest('#poCardContainer');
      if (!poCard || !this.activeProject) return;

      try {
        const nextPoState = !this.activeProject.poReceived;
        const res = await updateDocumentStatus(this.activeProject.projectId, {
          poReceived: nextPoState
        });
        this.activeProject = res.data || res;
        this.renderDocuments(this.activeProject);
        onToast(nextPoState ? 'Dokumen PO fisik berhasil diverifikasi. Blokir penagihan E-2 dibuka.' : 'PO ditandai belum diunggah. Penagihan E-2 diblokir.', !nextPoState);
      } catch (err) {
        onToast(err.message || 'Gagal mengubah status PO fisik', true);
      }
    });

    // 5. Tombol Terima & Registrasi Proyek oleh PM
    document.getElementById('btnApprovePM')?.addEventListener('click', async () => {
      if (!this.activeProject) return;
      try {
        const res = await approveProject(this.activeProject.projectId);
        const updated = res.data || res;
        onToast(`Proyek ${updated.canonicalCode || ''} resmi REGISTERED`);
        await this.loadAndRender(this.activeProject.projectId, onToast);
      } catch (err) {
        onToast(err.message || 'Gagal menyetujui proyek', true);
      }
    });

    // 6. Tombol Tolak (Butuh Revisi) oleh PM
    document.getElementById('btnRejectPM')?.addEventListener('click', async () => {
      if (!this.activeProject) return;
      const notesInput = document.getElementById('pmNotes');
      const errEl = document.getElementById('errPmNotes');
      const notes = notesInput?.value.trim() || '';

      if (notes.length < 20) {
        if (errEl) {
          errEl.textContent = 'Catatan revisi wajib diisi minimal 20 karakter.';
          errEl.className = 'text-rose-600 font-bold';
        }
        notesInput?.classList.add('border-rose-500');
        return;
      }

      if (errEl) {
        errEl.textContent = 'Wajib diisi jika menolak handover.';
        errEl.className = 'text-rose-600 font-medium';
      }
      notesInput?.classList.remove('border-rose-500');

      try {
        await rejectProject(this.activeProject.projectId, notes);
        notesInput.value = '';
        onToast('Handover dikembalikan ke AM untuk revisi');
        await this.loadAndRender(this.activeProject.projectId, onToast);
      } catch (err) {
        onToast(err.message || 'Gagal menolak handover', true);
      }
    });

    // 7. Penghitung Karakter Interaktif Catatan PM
    const notesInput = document.getElementById('pmNotes');
    const charLabel = document.getElementById('charCountLabel');
    notesInput?.addEventListener('input', (e) => {
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
    });

    // Tombol Unduh Project Charter
    document.getElementById('btnDownloadCharter')?.addEventListener('click', () => {
      if (this.activeProject?.projectId) {
        window.open(`/api/v1/projects/${this.activeProject.projectId}/charter`, '_blank');
      }
    });
  }
};