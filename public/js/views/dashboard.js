// public/js/views/dashboard.js - Perbaikan penanganan respons API
import { fetchProjects } from '../api.js';

export const DashboardView = {
  currentPage: 1,
  limit: 3,
  totalItems: 0,
  totalPages: 1,

  getStatusBadgeHtml(status) {
    if (status === 'REGISTERED') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200/60">• REGISTERED</span>`;
    }
    if (status === 'UNDER_REVIEW') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60">• UNDER_REVIEW</span>`;
    }
    if (status === 'REVISI_HANDOVER') {
      return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200/60">• REVISI_HANDOVER</span>`;
    }
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">• DRAFT</span>`;
  },

  getActionButtonHtml(project) {
    if (project.status === 'UNDER_REVIEW') {
      return `<button data-detail-id="${project.projectId}" class="text-[#1b365d] hover:text-blue-800 font-bold text-xs inline-flex items-center space-x-1"><span>Verifikasi</span><span>↗</span></button>`;
    }
    if (project.status === 'REVISI_HANDOVER') {
      return `<button data-detail-id="${project.projectId}" class="text-[#1b365d] hover:text-blue-800 font-bold text-xs inline-flex items-center space-x-1"><span>Revisi</span><span>↗</span></button>`;
    }
    if (project.status === 'DRAFT') {
      return `<button data-detail-id="${project.projectId}" class="text-[#1b365d] hover:text-blue-800 font-bold text-xs inline-flex items-center space-x-1"><span>Lanjutkan</span><span>↗</span></button>`;
    }
    return `<button data-detail-id="${project.projectId}" class="text-[#1b365d] hover:text-blue-800 font-bold text-xs inline-flex items-center space-x-1"><span>Detail</span><span>↗</span></button>`;
  },

  populateAmPmDropdown(allProjects) {
    const select = document.getElementById('amPmFilter');
    if (!select || select.options.length > 1) return;

    const names = new Set();
    allProjects.forEach(p => {
      if (p.amName) names.add(`AM:${p.amName}`);
      if (p.pmName) names.add(`PM:${p.pmName}`);
    });

    let optionsHtml = `<option value="ALL">Semua AM/PM</option>`;
    names.forEach(item => {
      const [role, name] = item.split(':');
      optionsHtml += `<option value="${name}">${role} · ${name}</option>`;
    });
    select.innerHTML = optionsHtml;
  },

  async render(onOpenDetail, onOpenEdit) {
    try {
      const q = document.getElementById('searchInput')?.value.trim() || '';
      const status = document.getElementById('statusFilter')?.value || 'ALL';
      const amPm = document.getElementById('amPmFilter')?.value || 'ALL';

      // 1. Ambil data agregat kartu metrik
      const allRes = await fetchProjects({ page: 1, limit: 100 });
      const allProjects = Array.isArray(allRes) ? allRes : (allRes.data || []);
      this.updateMetricCards(allProjects);
      this.populateAmPmDropdown(allProjects);

      // 2. Ambil data terpaginasi
      const res = await fetchProjects({
        page: this.currentPage,
        limit: this.limit,
        status: status === 'ALL' ? '' : status,
        q
      });

      let rows = Array.isArray(res) ? res : (res.data || []);
      if (amPm !== 'ALL') {
        rows = rows.filter(p => (p.amName && p.amName.includes(amPm)) || (p.pmName && p.pmName.includes(amPm)));
      }

      this.totalItems = res.meta ? res.meta.total : allProjects.length;
      this.totalPages = res.meta ? res.meta.totalPages : Math.ceil(this.totalItems / this.limit);

      this.renderTableRows(rows, onOpenDetail, onOpenEdit);
      this.renderPagination(onOpenDetail, onOpenEdit);
    } catch (err) {
      console.error('Gagal merender dasbor:', err);
    }
  },

  updateMetricCards(projects) {
    if (!Array.isArray(projects)) return;
    document.getElementById('countDraft').textContent = projects.filter(p => p.status === 'DRAFT').length;
    document.getElementById('countReview').textContent = projects.filter(p => p.status === 'UNDER_REVIEW').length;
    document.getElementById('countRegistered').textContent = projects.filter(p => p.status === 'REGISTERED').length;
    document.getElementById('countRevisi').textContent = projects.filter(p => p.status === 'REVISI_HANDOVER').length;
    document.getElementById('totalBadge').textContent = `${projects.length} proyek`;
  },

  renderTableRows(rows, onOpenDetail) {
    const tbody = document.getElementById('projectTableBody');
    if (!tbody) return;

    if (!rows || rows.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-slate-400">Tidak ada proyek yang cocok.</td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(p => {
      const isHighlight = p.status === 'UNDER_REVIEW';
      const rowBgClass = isHighlight ? 'bg-[#f4f7fb] hover:bg-slate-100/80' : 'hover:bg-slate-50/80';
      const codeColorClass = isHighlight ? 'text-[#1b365d]' : 'text-slate-800';

      const codeHtml = (p.canonicalCode && p.status !== 'DRAFT')
        ? `<span class="font-mono font-bold ${codeColorClass}">${p.canonicalCode}</span>`
        : `<span class="text-slate-400 font-bold">—</span>`;

      const subText = p.status === 'DRAFT'
        ? `Draf • diperbarui 18 Feb 2026`
        : (p.projectName || 'Implementasi & operasional');

      return `
        <tr class="${rowBgClass} transition">
          <td class="px-6 py-4 whitespace-nowrap">${codeHtml}</td>
          <td class="px-6 py-4">
            <div class="font-bold text-slate-900 text-xs">${p.projectName}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">${subText}</div>
          </td>
          <td class="px-6 py-4 text-slate-700 font-medium">${p.clientName || p.clientId}</td>
          <td class="px-6 py-4">
            <div class="text-slate-700 font-medium text-xs">AM · ${p.amName || 'Andi Maulana'}</div>
            <div class="text-[11px] text-slate-400 mt-0.5">PM · ${p.pmName || p.pmEmployeeId}</div>
          </td>
          <td class="px-6 py-4 whitespace-nowrap">${this.getStatusBadgeHtml(p.status)}</td>
          <td class="px-6 py-4 text-right whitespace-nowrap">
            ${this.getActionButtonHtml(p)}
          </td>
        </tr>
      `;
    }).join('');

    tbody.querySelectorAll('[data-detail-id]').forEach(btn => {
      btn.addEventListener('click', () => onOpenDetail(btn.getAttribute('data-detail-id')));
    });
  },

  renderPagination(onOpenDetail, onOpenEdit) {
    const infoEl = document.getElementById('paginationInfo');
    const btnContainer = document.getElementById('paginationButtons');
    if (!infoEl || !btnContainer) return;

    const startItem = this.totalItems === 0 ? 0 : (this.currentPage - 1) * this.limit + 1;
    const endItem = Math.min(this.currentPage * this.limit, this.totalItems);
    infoEl.textContent = `Menampilkan ${startItem}–${endItem} dari ${this.totalItems} proyek`;

    let html = `<button data-page="${this.currentPage - 1}" ${this.currentPage <= 1 ? 'disabled' : ''} class="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30">&lt;</button>`;

    for (let i = 1; i <= Math.max(1, this.totalPages); i++) {
      const activeClass = i === this.currentPage
        ? 'bg-[#1b365d] text-white font-bold shadow-sm'
        : 'hover:bg-slate-100 text-slate-600 font-medium';
      html += `<button data-page="${i}" class="w-7 h-7 rounded-lg text-xs flex items-center justify-center transition ${activeClass}">${i}</button>`;
    }

    html += `<button data-page="${this.currentPage + 1}" ${this.currentPage >= this.totalPages ? 'disabled' : ''} class="px-2 py-1 rounded text-slate-500 hover:bg-slate-100 disabled:opacity-30">&gt;</button>`;
    btnContainer.innerHTML = html;

    btnContainer.querySelectorAll('button[data-page]').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = Number(btn.getAttribute('data-page'));
        if (target >= 1 && target <= this.totalPages && target !== this.currentPage) {
          this.currentPage = target;
          this.render(onOpenDetail, onOpenEdit);
        }
      });
    });
  }
};