# Modul D-1: Registrasi Proyek dan Project Intake
**ERP PT Anaheim Nimbus Universal — Kelompok 1-D**

[![OpenAPI Spec](https://img.shields.io/badge/OpenAPI-3.0.3-brightgreen.svg)](openapi/openapi.yaml)

Repositori ini menyediakan aplikasi web manajemen *Project Intake* serta layanan REST API **Single Source of Truth (SSOT)** data proyek kanonis untuk seluruh modul di ekosistem ERP PT Anaheim Nimbus Universal:
- **Konsumen Hilir (Outbound):** Modul **E-1** (Dasbor Manajemen), **E-2** (Kontrak & Penagihan), **E-3** (Perencanaan Teknis/WBS), **E-5** (Pengawasan Risiko), **D-3** (Penutupan Proyek), dan **F-2** (Penugasan SDM).
- **Penyedia Data Master (Inbound):** Terintegrasi melalui *Smart Adapter Proxy* (`src/mockService.js`) ke modul **F-1** (Autentikasi), **F-2** (Master SDM), dan **F-6** (CRM Klien) dengan mekanisme *auto-fallback* lokal.

---

## 1. Cara Menjalankan Aplikasi Web (Lokal)

Pastikan **Node.js (v18+)** dan **npm** telah terpasang di perangkat Anda sebelum menjalankan aplikasi.

1. **Kloning repositori & masuk ke direktori**
   ```bash
   git clone https://github.com/iamhaekal23/d1-project-intake.git
   cd d1-project-intake
   ```

2. **Pasang seluruh dependensi**
   ```bash
   npm install
   ```

3. **Konfigurasi Environment (`.env`)**
   Pastikan berkas `.env` tersedia di akar direktori (salin dari `.env.example` jika belum ada):
   ```env
   PORT=3000
   DATABASE_URL="file:./dev.db"
   F1_API_URL=http://localhost:3001
   F2_API_URL=http://localhost:8080
   F6_API_URL=http://localhost:3006
   ```

4. **Siapkan skema & muat data awal ke database SQLite**
   ```bash
   npx prisma db push
   npm run db:seed
   ```

5. **Jalankan server aplikasi**
   ```bash
   npm start
   ```

6. **Akses aplikasi dan layanan**
   - **Antarmuka Web (UI Dasbor):** `http://localhost:3000`
   - **Base URL REST API:** `http://localhost:3000/api/v1`
   - **Prisma Studio (Eksplorasi Database):** `npm run db:studio`

---

## 2. Panduan Penggunaan dan Pengujian REST API

Server lokal menyediakan REST API resmi untuk mengakses data proyek kanonis yang digunakan oleh kelompok konsumen ERP. Spesifikasi teknis lengkap tersedia pada berkas [`openapi/openapi.yaml`](openapi/openapi.yaml).

### Ringkasan Endpoint Modul D-1

| ID API | Metode & Path | Kegunaan Utama | Konsumen |
| :--- | :--- | :--- | :--- |
| **API-K01-08** | `GET /api/v1/projects` | Mengambil daftar proyek dengan paginasi, pencarian, & filter status | E-1, E-2, Internal D-1 |
| **API-K01-07** | `GET /api/v1/projects/{projectId}` | Mengambil rincian 1 proyek kanonis berdasarkan `canonicalCode` (`202601`) atau UUID `projectId` | E-2, E-3, E-5, D-3, F-2 |
| **API-K01-01** | `POST /api/v1/projects` | Membuat draf proyek baru (`DRAFT`) | Internal D-1 (AM) |
| **API-K01-02** | `PUT /api/v1/projects/{projectId}` | Memperbarui data draf proyek sebelum serah terima | Internal D-1 (AM) |
| **API-K01-04** | `POST /api/v1/projects/{projectId}/handover` | Mengajukan serah terima proyek ke PM (`UNDER_REVIEW`) | Internal D-1 (AM) |
| **API-K01-06** | `POST /api/v1/projects/{projectId}/approve` | Menyetujui proyek & menerbitkan kode kanonis (`REGISTERED`) | Internal D-1 (PM) |
| **API-K01-05** | `POST /api/v1/projects/{projectId}/reject` | Menolak serah terima dengan catatan revisi (`REVISI_HANDOVER`) | Internal D-1 (PM) |
| **API-K01-09** | `GET /api/v1/projects/{projectId}/charter` | Mengunduh dokumen resmi *Project Charter* (`.pdf`) | Internal D-1 (AM, PM, COO) |

---

### A. Mengambil Daftar Semua Proyek (`GET /api/v1/projects`)

Digunakan oleh modul dasbor manajemen (**E-1**) dan penagihan komersial (**E-2**) untuk mengambil daftar proyek dengan dukungan paginasi dan filter.

**Parameter Query (Opsional):**
- `page` *(integer)*: Nomor halaman (default: `1`)
- `limit` *(integer)*: Jumlah data per halaman (default: `3`)
- `status` *(string)*: Filter status (`DRAFT`, `UNDER_REVIEW`, `REVISI_HANDOVER`, `REGISTERED`)
- `q` *(string)*: Kata kunci pencarian nama proyek, klien, atau kode kanonis

**Contoh URL:**
- Paging: `http://localhost:3000/api/v1/projects?page=1&limit=3`
- Filter Status: `http://localhost:3000/api/v1/projects?status=REGISTERED`

**Pengujian menggunakan cURL:**
```bash
curl -X GET "http://localhost:3000/api/v1/projects?page=1&limit=3"
```
```bash
curl -X GET "http://localhost:3000/api/v1/projects?status=REGISTERED"
```

**Contoh Respons Sukses (`200 OK`):**
```json
{
  "data": [
    {
      "projectId": "01924b1e-7f32-7a81-9b12-45e8a1234567",
      "canonicalCode": "202601",
      "projectName": "Implementasi Sistem ERP Cloud Anaheim Tahap 1",
      "clientId": "PTANTRI",
      "clientName": "PT Anaheim Nimbus Universal",
      "amEmployeeId": "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
      "pmEmployeeId": "01929b4a-5f10-7a22-9d44-3c8f1b2e7a90",
      "startDate": "2026-10-15",
      "targetEndDate": "2027-04-15",
      "documentsComplete": true,
      "poReceived": true,
      "status": "REGISTERED",
      "createdAt": "2026-10-13T09:00:00+07:00",
      "updatedAt": "2026-10-13T11:30:00+07:00"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 3,
    "total": 4,
    "totalPages": 2
  }
}
```

---

### B. Mengambil Detail Proyek Tertentu (`GET /api/v1/projects/{projectId}`)

Digunakan oleh modul **E-2, E-3, E-5, D-3,** dan **F-2** untuk membaca detail resmi proyek berdasarkan Kode Kanonis 6 digit (misal: `202601`) maupun UUID v7 (`projectId`). Endpoint ini juga menyediakan atribut `poReceived` untuk memvalidasi ketersediaan PO fisik tanpa membocorkan nilai komersial internal (`indicativeValue`).

**Contoh URL:**
`http://localhost:3000/api/v1/projects/202601`

**Pengujian menggunakan cURL:**
```bash
curl -X GET "http://localhost:3000/api/v1/projects/202601" \
     -H "Authorization: Bearer mock-jwt-token-f1-account-manager-2026"
```

**Contoh Respons Gagal jika ID Tidak Ditemukan (`404 Not Found`):**
```json
{
  "code": "PROJECT_NOT_FOUND",
  "message": "Data proyek dengan ID 999999 tidak ditemukan di sistem intake",
  "details": {
    "requestedProjectId": "999999"
  }
}
```

---

### C. Integrasi Endpoint Referensi Hulu (Inbound)

Backend Modul D-1 menyediakan rute adapter menuju layanan data induk:
- **Referensi SDM (F-2):** `GET http://localhost:3000/api/v1/referensi/sdm` (Terhubung ke server F-2 di `http://localhost:8080/api/v1/sdm` dengan `Bearer token-coo`).
- **Referensi Klien (F-6):** `GET http://localhost:3000/api/v1/clients` & `POST http://localhost:3000/api/v1/temporary-clients` (Fitur Draf Klien Sementara).

---

## 3. Dokumentasi Bukti Pengujian

Tangkapan layar hasil pengujian aplikasi dan REST API disimpan pada direktori berikut:
- **Pertemuan 4 (Demo Alur Lokal Pertama):** [`docs/evidence/pertemuan4demo/`](docs/evidence/pertemuan4demo)
- **Pertemuan 5 (Operasi Data, Validasi, & Integrasi Endpoint):** [`docs/evidence/pertemuan-5/`](docs/evidence/pertemuan-5)

---

## 4. Tim Pengembang (Kelompok 1 / Kelas D)

- **Haekal Khadafy**
- **Fikri Lazuardi Fadilla**
- **Fadhilah Aditya Ahmad**
- **Nayara Christony Paul Barriga**
- **Muhammad Yafi Nasrulloh**
- **Rama Sadea Putra**