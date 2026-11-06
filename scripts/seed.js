// scripts/seed.js - Inisialisasi Data Awal Basis Data SQLite Prisma D1 (Mode Offline Kelompok D1)
const prisma = require('../src/prisma');

const F2_BASE = process.env.F2_API_URL || 'http://localhost:8080';

// 1. Akun AM Tunggal Kelompok D1 (F1 Auth)
const DEFAULT_AM = {
  akunId: '01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1',
  namaLengkap: 'Fikri Lazuardi Fadilla'
};

// 2. Daftar Default PM Kelompok D1 (Digunakan saat F2 offline)
const DEFAULT_PMS = [
  { employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a01', namaLengkap: 'Haekal Khadafy' },
  { employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a02', namaLengkap: 'Rama Sadea Putra' },
  { employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a03', namaLengkap: 'Muhammad Yafi Nasrulloh' },
  { employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a04', namaLengkap: 'Nayara Christony Paul Barriga' },
  { employeeId: '01929b4a-5f10-7a22-9d44-3c8f1b2e7a05', namaLengkap: 'Fadhilah Aditya Ahmad' }
];

// Helper untuk mengambil referensi SDM live jika server F2 sedang berjalan
async function fetchEmployeesFromF2() {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${F2_BASE}/api/v1/sdm`, {
      headers: {
        Authorization: 'Bearer token-coo',
        Accept: 'application/json'
      },
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const result = await res.json();
      const items = result.items || result.data || [];
      if (Array.isArray(items) && items.length > 0) {
        console.log(`[F2 LIVE API] Mengambil ${items.length} pegawai live dari F2.`);
        return items;
      }
    }
  } catch (err) {
    console.log(`[MODE MANDIRI D1] Server F2 offline (${err.message}). Menggunakan daftar PM anggota D1.`);
  }

  return DEFAULT_PMS;
}

async function main() {
  console.log('--- 1. Membersihkan tabel lama di SQLite (dev.db) ---');
  await prisma.projectAuditLog.deleteMany({});
  await prisma.projectDocument.deleteMany({});
  await prisma.temporaryClient.deleteMany({});
  await prisma.project.deleteMany({});

  console.log('--- 2. Memeriksa ketersediaan API hulu F2 ---');
  const availablePMs = await fetchEmployeesFromF2();

  const pm1 = availablePMs[0] || DEFAULT_PMS[0]; // Haekal Khadafy
  const pm2 = availablePMs[1] || DEFAULT_PMS[1]; // Rama Sadea Putra
  const pm3 = availablePMs[2] || DEFAULT_PMS[2]; // Muhammad Yafi Nasrulloh
  const pm4 = availablePMs[3] || DEFAULT_PMS[3]; // Nayara Christony Paul Barriga

  console.log('--- 3. Mengisi data proyek representatif Kelompok D1 (4 Siklus Status) ---');

  const SEED_PROJECTS = [
    // 1. Proyek Kanonis Acuan (Status: REGISTERED, Kode Resmi: 202601)
    {
      projectId: '01924b1e-7f32-7a81-9b12-45e8a1234567', // ID pengujian konsumen
      canonicalCode: '202601',
      projectName: 'Implementasi Sistem ERP Cloud Phase 1',
      clientId: 'PTFIKRI',
      clientName: 'PT Fikri Solusi Mandiri',
      amEmployeeId: DEFAULT_AM.akunId,
      amName: DEFAULT_AM.namaLengkap,
      pmEmployeeId: pm1.employeeId,
      pmName: pm1.namaLengkap,
      startDate: '2026-03-01',
      targetEndDate: '2026-08-31',
      indicativeValue: 950000000,
      documentsComplete: true,
      poReceived: true,
      status: 'REGISTERED',
      rejectionNotes: null,
      createdAt: new Date('2026-02-15T08:30:00+07:00'),
      updatedAt: new Date('2026-02-18T10:00:00+07:00'),
      logs: [
        {
          auditLogId: 'LOG-202601-01',
          actorUserId: DEFAULT_AM.akunId,
          action: 'CREATE_DRAFT',
          details: `Draf proyek dibuat oleh AM (${DEFAULT_AM.namaLengkap})`,
          timestamp: new Date('2026-02-15T08:30:00+07:00')
        },
        {
          auditLogId: 'LOG-202601-02',
          actorUserId: DEFAULT_AM.akunId,
          action: 'HANDOVER',
          details: `AM mengajukan berkas handover ke PM (${pm1.namaLengkap})`,
          timestamp: new Date('2026-02-16T09:15:00+07:00')
        },
        {
          auditLogId: 'LOG-202601-03',
          actorUserId: pm1.employeeId,
          action: 'APPROVE',
          details: `PM (${pm1.namaLengkap}) menyetujui handover. Kode resmi 202601 diterbitkan.`,
          timestamp: new Date('2026-02-18T10:00:00+07:00')
        }
      ]
    },

    // 2. Status UNDER_REVIEW (Dalam Pemeriksaan PM, Kode Masih null/—)
    {
      projectId: '01924b1e-7f32-7a81-9b12-45e8a1234002',
      canonicalCode: null,
      projectName: 'Integrasi Sistem Gudang & Otomasi Logistik',
      clientId: 'PTHAEKAL',
      clientName: 'PT Haekal Kreasi Nusantara',
      amEmployeeId: DEFAULT_AM.akunId,
      amName: DEFAULT_AM.namaLengkap,
      pmEmployeeId: pm2.employeeId,
      pmName: pm2.namaLengkap,
      startDate: '2026-11-01',
      targetEndDate: '2027-05-30',
      indicativeValue: 1250000000,
      documentsComplete: true,
      poReceived: false,
      status: 'UNDER_REVIEW',
      rejectionNotes: null,
      createdAt: new Date('2026-10-18T09:15:00+07:00'),
      updatedAt: new Date('2026-10-18T09:15:00+07:00'),
      logs: [
        {
          auditLogId: 'LOG-202602-01',
          actorUserId: DEFAULT_AM.akunId,
          action: 'CREATE_DRAFT',
          details: `Draf proyek dibuat oleh AM (${DEFAULT_AM.namaLengkap})`,
          timestamp: new Date('2026-10-18T08:00:00+07:00')
        },
        {
          auditLogId: 'LOG-202602-02',
          actorUserId: DEFAULT_AM.akunId,
          action: 'HANDOVER',
          details: `Diajukan ke PM (${pm2.namaLengkap}) untuk verifikasi dokumen`,
          timestamp: new Date('2026-10-18T09:15:00+07:00')
        }
      ]
    },

    // 3. Status REVISI_HANDOVER (Ditolak PM dengan Catatan Wajib)
    {
      projectId: '01924b1e-7f32-7a81-9b12-45e8a1234003',
      canonicalCode: null,
      projectName: 'Revitalisasi Infrastruktur Jaringan Kantor Pusat',
      clientId: 'PTYAFI',
      clientName: 'PT Yafi Digital Dinamika',
      amEmployeeId: DEFAULT_AM.akunId,
      amName: DEFAULT_AM.namaLengkap,
      pmEmployeeId: pm3.employeeId,
      pmName: pm3.namaLengkap,
      startDate: '2026-11-10',
      targetEndDate: '2027-03-31',
      indicativeValue: 320000000,
      documentsComplete: false,
      poReceived: false,
      status: 'REVISI_HANDOVER',
      rejectionNotes: 'Mohon lengkapi berkas rincian spesifikasi teknis pada dokumen KAK dan konfirmasi ulang jadwal pelaksanaan dengan pihak klien.',
      createdAt: new Date('2026-10-19T10:00:00+07:00'),
      updatedAt: new Date('2026-10-20T16:00:00+07:00'),
      logs: [
        {
          auditLogId: 'LOG-202603-01',
          actorUserId: DEFAULT_AM.akunId,
          action: 'CREATE_DRAFT',
          details: `Draf proyek dibuat oleh AM (${DEFAULT_AM.namaLengkap})`,
          timestamp: new Date('2026-10-19T10:00:00+07:00')
        },
        {
          auditLogId: 'LOG-202603-02',
          actorUserId: DEFAULT_AM.akunId,
          action: 'HANDOVER',
          details: `Diajukan ke PM (${pm3.namaLengkap})`,
          timestamp: new Date('2026-10-20T11:00:00+07:00')
        },
        {
          auditLogId: 'LOG-202603-03',
          actorUserId: pm3.employeeId,
          action: 'REJECT',
          details: 'Mohon lengkapi berkas rincian spesifikasi teknis pada dokumen KAK dan konfirmasi ulang jadwal pelaksanaan dengan pihak klien.',
          timestamp: new Date('2026-10-20T16:00:00+07:00')
        }
      ]
    },

    // 4. Status DRAFT (Baru Diinisiasi, Belum Ada Nomor Kode)
    {
      projectId: '01924b1e-7f32-7a81-9b12-45e8a1234004',
      canonicalCode: null,
      projectName: 'Pengadaan Jaringan Cabang Regional Jawa Barat',
      clientId: 'PTRAMA',
      clientName: 'PT Rama Teknologi Terpadu',
      amEmployeeId: DEFAULT_AM.akunId,
      amName: DEFAULT_AM.namaLengkap,
      pmEmployeeId: pm4.employeeId,
      pmName: pm4.namaLengkap,
      startDate: '2026-12-01',
      targetEndDate: '2027-06-30',
      indicativeValue: 850000000,
      documentsComplete: false,
      poReceived: false,
      status: 'DRAFT',
      rejectionNotes: null,
      createdAt: new Date('2026-10-21T08:00:00+07:00'),
      updatedAt: new Date('2026-10-21T08:00:00+07:00'),
      logs: [
        {
          auditLogId: 'LOG-202604-01',
          actorUserId: DEFAULT_AM.akunId,
          action: 'CREATE_DRAFT',
          details: `Inisiasi draf proyek baru oleh AM (${DEFAULT_AM.namaLengkap})`,
          timestamp: new Date('2026-10-21T08:00:00+07:00')
        }
      ]
    }
  ];

  for (const item of SEED_PROJECTS) {
    const { logs, ...projectData } = item;

    // Simpan entitas Project ke SQLite
    await prisma.project.create({
      data: projectData
    });

    // Simpan relasi log audit
    if (logs && logs.length > 0) {
      for (const log of logs) {
        await prisma.projectAuditLog.create({
          data: {
            auditLogId: log.auditLogId,
            projectId: item.projectId,
            actorUserId: log.actorUserId,
            action: log.action,
            details: log.details,
            timestamp: log.timestamp
          }
        });
      }
    }
  }

  console.log('Seeding basis data berhasil: 4 status siklus proyek menggunakan data nama anggota Kelompok D1.');
}

main()
  .catch((err) => {
    console.error('Galat saat mengeksekusi seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });