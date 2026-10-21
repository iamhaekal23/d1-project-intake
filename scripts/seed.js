const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, '../data/db.json');

const initialData = {
  projects: [
    {
      projectId: "01924b1e-7f32-7a81-9b12-45e8a1234001",
      canonicalCode: "202601",
      projectName: "Implementasi Sistem ERP Cloud Anaheim Tahap 1",
      clientId: "PTANTRI",
      clientName: "PT Anaheim Nimbus Universal",
      amEmployeeId: "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
      pmEmployeeId: "SDM-0004",
      pmName: "Siti Aminah, S.Kom",
      startDate: "2026-10-15",
      targetEndDate: "2027-04-15",
      indicativeValue: 450000000,
      status: "DRAFT",
      poReceived: false,
      documentsComplete: false,
      createdAt: "2026-10-13T09:00:00+07:00",
      updatedAt: "2026-10-14T10:30:00+07:00"
    }
  ],
  temporary_clients: [],
  project_documents: [],
  project_audit_logs: [
    {
      logId: "LOG-0001",
      projectId: "01924b1e-7f32-7a81-9b12-45e8a1234001",
      actorId: "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
      action: "CREATE_DRAFT",
      details: "Inisiasi draf proyek awal oleh AM",
      timestamp: "2026-10-13T09:00:00+07:00"
    }
  ]
};

fs.writeFileSync(dbPath, JSON.stringify(initialData, null, 2), 'utf-8');
console.log('✓ Database lokal berhasil di-seed pada data/db.json');
