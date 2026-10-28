// scripts/seed.js - Mengisi Data Awal Bersih ke Basis Data SQLite Prisma
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const SEED_PROJECTS = [
  // 1. Proyek REGISTERED (Resmi Terdaftar)
  {
    projectId: '01924b1e-7f32-7a81-9b12-45e8a1234567',
    canonicalCode: '202601',
    projectName: 'Modernisasi Gedung Operasional',
    clientId: 'CL-001',
    clientName: 'PT Cakra Infrastruktur',
    amEmployeeId: 'SDM-0012',
    amName: 'Andi Maulana',
    pmEmployeeId: 'SDM-0004',
    pmName: 'Budi Santoso',
    startDate: '2026-03-01',
    targetEndDate: '2026-08-31',
    indicativeValue: 950000000,
    documentsComplete: true,
    poReceived: true,
    status: 'REGISTERED',
    rejectionNotes: null,
    createdAt: new Date('2026-02-15T08:30:00Z'),
    updatedAt: new Date('2026-02-18T10:00:00Z'),
    logs: [
      {
        auditLogId: 'LOG-202601-01',
        actorUserId: 'SDM-0012',
        action: 'CREATE_DRAFT',
        details: 'Draf proyek dibuat oleh Account Manager (AM)',
        timestamp: new Date('2026-02-15T08:30:00Z')
      },
      {
        auditLogId: 'LOG-202601-02',
        actorUserId: 'SDM-0012',
        action: 'HANDOVER',
        details: 'AM mengajukan berkas handover untuk peninjauan PM',
        timestamp: new Date('2026-02-16T09:15:00Z')
      },
      {
        auditLogId: 'LOG-202601-03',
        actorUserId: 'SDM-0004',
        action: 'APPROVE',
        details: 'PM menyetujui handover. Kode resmi 202601 diterbitkan.',
        timestamp: new Date('2026-02-18T10:00:00Z')
      }
    ]
  },
  // 2. Proyek UNDER_REVIEW (Dalam Pemeriksaan PM)
  {
    projectId: '01924b1e-7f32-7a81-9b12-45e8a7654321',
    canonicalCode: '202602',
    projectName: 'Integrasi Sistem Gudang',
    clientId: 'CL-002',
    clientName: 'PT Sinar Logistik',
    amEmployeeId: 'SDM-0012',
    amName: 'Andi Maulana',
    pmEmployeeId: 'SDM-0004',
    pmName: 'Budi Santoso',
    startDate: '2026-03-02',
    targetEndDate: '2026-05-29',
    indicativeValue: 1250000000,
    documentsComplete: true,
    poReceived: false, // Mengetes banner penagihan E-2 terblokir
    status: 'UNDER_REVIEW',
    rejectionNotes: null,
    createdAt: new Date('2026-02-17T14:30:00Z'),
    updatedAt: new Date('2026-02-18T09:15:00Z'),
    logs: [
      {
        auditLogId: 'LOG-202602-01',
        actorUserId: 'SDM-0012',
        action: 'CREATE_DRAFT',
        details: 'Draf proyek dibuat oleh Account Manager (AM)',
        timestamp: new Date('2026-02-17T14:30:00Z')
      },
      {
        auditLogId: 'LOG-202602-02',
        actorUserId: 'SDM-0012',
        action: 'HANDOVER',
        details: 'Dikirim untuk review PM',
        timestamp: new Date('2026-02-18T09:15:00Z')
      }
    ]
  },
  // 3. Proyek REVISI_HANDOVER (Ditolak PM dengan Catatan Wajib)
  {
    projectId: '01924b1e-7f32-7a81-9b12-45e8a1122334',
    canonicalCode: '202603',
    projectName: 'Revitalisasi Kantor Pusat',
    clientId: 'CL-003',
    clientName: 'PT Aruna Properti',
    amEmployeeId: 'SDM-0015',
    amName: 'Dewi Lestari',
    pmEmployeeId: 'SDM-0008',
    pmName: 'Rina Prasetyo',
    startDate: '2026-04-01',
    targetEndDate: '2026-09-30',
    indicativeValue: 600000000,
    documentsComplete: false,
    poReceived: false,
    status: 'REVISI_HANDOVER',
    rejectionNotes: 'Mohon lengkapi berkas KAK fisik dan konfirmasi ulang tanggal mulai pelaksanaan pekerjaan dengan pihak klien.',
    createdAt: new Date('2026-02-16T11:00:00Z'),
    updatedAt: new Date('2026-02-17T16:45:00Z'),
    logs: [
      {
        auditLogId: 'LOG-202603-01',
        actorUserId: 'SDM-0015',
        action: 'CREATE_DRAFT',
        details: 'Draf proyek dibuat oleh Dewi Lestari',
        timestamp: new Date('2026-02-16T11:00:00Z')
      },
      {
        auditLogId: 'LOG-202603-02',
        actorUserId: 'SDM-0015',
        action: 'HANDOVER',
        details: 'Diajukan ke PM Rina Prasetyo',
        timestamp: new Date('2026-02-17T10:00:00Z')
      },
      {
        auditLogId: 'LOG-202603-03',
        actorUserId: 'SDM-0008',
        action: 'REJECT',
        details: 'Mohon lengkapi berkas KAK fisik dan konfirmasi ulang tanggal mulai pelaksanaan pekerjaan dengan pihak klien.',
        timestamp: new Date('2026-02-17T16:45:00Z')
      }
    ]
  },
  // 4. Proyek DRAFT (Belum Dikirim ke PM)
  {
    projectId: '01924b1e-7f32-7a81-9b12-45e8a9988776',
    canonicalCode: null, // Masih belum terbit kode kanonis
    projectName: 'Pengadaan Jaringan Cabang',
    clientId: 'CL-004',
    clientName: 'PT Nusa Digital Solusi',
    amEmployeeId: 'SDM-0012',
    amName: 'Andi Maulana',
    pmEmployeeId: 'SDM-0008',
    pmName: 'Rina Prasetyo',
    startDate: '2026-03-15',
    targetEndDate: '2026-06-30',
    indicativeValue: 450000000,
    documentsComplete: false,
    poReceived: false,
    status: 'DRAFT',
    rejectionNotes: null,
    createdAt: new Date('2026-02-18T07:00:00Z'),
    updatedAt: new Date('2026-02-18T07:00:00Z'),
    logs: [
      {
        auditLogId: 'LOG-202604-01',
        actorUserId: 'SDM-0012',
        action: 'CREATE_DRAFT',
        details: 'Draf proyek baru dibuat oleh Andi Maulana',
        timestamp: new Date('2026-02-18T07:00:00Z')
      }
    ]
  }
];

async function main() {
  console.log('--- Membersihkan data tabel lama ---');
  await prisma.projectAuditLog.deleteMany({});
  await prisma.projectDocument.deleteMany({});
  await prisma.temporaryClient.deleteMany({});
  await prisma.project.deleteMany({});

  console.log('--- Mengisi 4 data proyek representatif ---');
  for (const item of SEED_PROJECTS) {
    const { logs, ...projectData } = item;
    
    // Simpan entitas Project
    await prisma.project.create({
      data: projectData
    });

    // Simpan relasi ProjectAuditLog sesuai atribut model Prisma
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

  console.log('✓ Seeding database berhasil: 4 status terisi lengkap.');
}

main()
  .catch((e) => {
    console.error('Galat seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });