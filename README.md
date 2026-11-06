# Modul D1: Registrasi Proyek dan Project Intake
**Enterprise Resource Planning (ERP) PT Anaheim Nimbus Universal**  
*Kelompok 1 / Kelas D*

[![OpenAPI Spec](https://img.shields.io/badge/OpenAPI-3.0.3-brightgreen.svg)](openapi/openapi.yaml)
[![Status](https://img.shields.io/badge/Status-Freeze%20UTS-blue.svg)](openapi/openapi.yaml)

Modul D1 bertindak sebagai **Single Source of Truth (SSOT)** identitas proyek kanonis yang melayani seluruh modul konsumen di ekosistem ERP (E1, E2, E3, E5, dan D3). Repositori ini menyediakan antarmuka web intake serta REST API resmi siap uji.

---

## 1. Cara Menjalankan Aplikasi Web (Lokal)

Pastikan **Node.js (v18+)** dan **npm** telah terpasang di perangkat Anda.

### Langkah Instalasi & Menjalankan Server:
```bash
# 1. Kloning repositori & masuk ke direktori proyek
git clone https://github.com/iamhaekal23/d1-project-intake.git
cd d1-project-intake

# 2. Pasang dependensi
npm install

# 3. Inisialisasi skema basis data & data awal (SQLite)
npx prisma db push
npm run db:seed

# 4. Jalankan peladen aplikasi (Port 3000)
npm start
```

### Akses Layanan:
* **Antarmuka Web (UI Dasbor):** [http://localhost:3000](http://localhost:3000)
* **Base URL REST API:** `http://localhost:3000/api/v1`
* **Prisma Studio (GUI Database):** `npm run db:studio`

---

## 2. Panduan Penggunaan Antarmuka Web

Aplikasi web mengimplementasikan alur verifikasi bertahap dengan kontrol hak akses berbasis peran (*Role-Based Access Control*):

1. **Simulasi Peran via Menu "Ganti Akun" (Bilah Samping Kiri Bawah):**
   * **Account Manager (AM):** Berwenang membuat draf proyek baru (`+ Daftarkan Proyek Baru`), mengunggah berkas acuan WI-01, menandai sakelar kelengkapan dokumen, dan mengajukan serah terima (*Handover*) ke PM.
   * **Project Manager (PM):** Berwenang meninjau draf proyek (`UNDER_REVIEW`), menolak serah terima dengan kewajiban mengisi catatan revisi minimal 20 karakter (`REVISI_HANDOVER`), atau menerima serah terima proyek (`REGISTERED`).
2. **Koneksi Dinamis Hulu (F1, F2, F6):**
   * Saat peladen F-1 & F-2 aktif (*online*), profil pengguna dan daftar pilihan PM di formulir otomatis terisi personil riil dari API hulu (misal: *Sandy Walsh*).
   * Jika peladen hulu luring (*offline*), sistem secara otomatis beralih ke mode *Graceful Fallback* lokal tanpa menghentikan alur aplikasi.

---

## 3. Panduan Penggunaan & Pengujian REST API D1

Peladen D1 menyediakan endpoint REST API kanonis untuk dikonsumsi oleh kelompok hilir maupun internal.

### Ringkasan Endpoint Modul D1

| Metode & Endpoint | Deskripsi & Kegunaan | Konsumen / Aktor |
| :--- | :--- | :--- |
| `GET /api/v1/projects` | Mengambil daftar proyek (paginasi, pencarian, dan filter) | E1, E2, Internal D1 |
| `GET /api/v1/projects/{projectId}` | Mengambil rincian 1 proyek kanonis (via UUID / kode `2026XX`) | E2, E3, E5, D3, F2 |
| `POST /api/v1/projects` | Membuat draf proyek baru (Status: `DRAFT`) | Internal D1 (AM) |
| `PUT /api/v1/projects/{projectId}` | Memperbarui data draf sebelum serah terima | Internal D1 (AM) |
| `POST /api/v1/projects/{projectId}/handover` | Mengajukan draf ke PM (Status: `UNDER_REVIEW`) | Internal D1 (AM) |
| `POST /api/v1/projects/{projectId}/approve` | Menerima & menerbitkan kode kanonis (Status: `REGISTERED`) | Internal D1 (PM) |
| `POST /api/v1/projects/{projectId}/reject` | Menolak handover dengan catatan revisi (`REVISI_HANDOVER`) | Internal D1 (PM) |
| `GET /api/v1/projects/{projectId}/charter` | Mengunduh dokumen resmi Project Charter (`.pdf`) | Internal D1, E1 |

---

### Contoh Pemanggilan API (cURL)

#### A. Mengambil Daftar Proyek Berpaginasi (Konsumen Modul E1 & E2)
Mendukung query `page`, `limit`, dan `status`:
```bash
curl -X GET "http://localhost:3000/api/v1/projects?page=1&limit=3&status=REGISTERED"
```
**Contoh Respons (`200 OK`):**
```json
{
  "data": [
    {
      "projectId": "01929b4a-4444-7a22-9d44-3c8f1b2e7004",
      "canonicalCode": "202601",
      "projectName": "Migrasi Data Center dan Disaster Recovery Plan",
      "clientId": "PTHAEKAL",
      "clientName": "PT Haekal Kreasi Nusantara",
      "amEmployeeId": "01929b4a-6e2a-7b3f-8c71-0ab4e3d9f2a1",
      "pmEmployeeId": "01929b4a-5f10-7a22-9d44-3c8f1b2e7a01",
      "startDate": "2026-11-01",
      "targetEndDate": "2027-05-01",
      "documentsComplete": true,
      "poReceived": true,
      "status": "REGISTERED",
      "active": true
    }
  ],
  "meta": {
    "page": 1,
    "limit": 3,
    "total": 1,
    "totalPages": 1
  }
}
```

#### B. Mengambil Rincian Tunggal Proyek Kanonis (Konsumen E2, E3, E5, D3)
Dapat dipanggil menggunakan UUID `projectId` maupun 6 digit `canonicalCode` (`202601`):
```bash
curl -X GET "http://localhost:3000/api/v1/projects/202601" \
     -H "Authorization: Bearer mock-jwt-token"
```
*Catatan Proteksi E2:* Atribut `poReceived: false` pada respons menandakan PO fisik belum diunggah, sehingga modul E2 wajib memblokir pencairan termin penagihan.

#### C. Pengujian Transisi Status Serah Terima Proyek
* **1. Handover ke PM (AM):**
  ```bash
  curl -X POST "http://localhost:3000/api/v1/projects/{projectId}/handover" \
       -H "Content-Type: application/json" \
       -d '{"notes": "Dokumen WI-01 lengkap dan siap diverifikasi."}'
  ```
* **2. Penolakan PM dengan Catatan Revisi (Minimal 20 Karakter):**
  ```bash
  curl -X POST "http://localhost:3000/api/v1/projects/{projectId}/reject" \
       -H "Content-Type: application/json" \
       -d '{"notes": "Dokumen SPK dan SOW belum mencantumkan klausul SLA teknis."}'
  ```
* **3. Persetujuan PM & Registrasi Kanonis:**
  ```bash
  curl -X POST "http://localhost:3000/api/v1/projects/{projectId}/approve"
  ```

---

## 4. Lokasi Bukti Pengujian & Spesifikasi

* **Spesifikasi Kontrak OpenAPI:** [`openapi/openapi.yaml`](openapi/openapi.yaml)
* **Bukti Pengujian Pertemuan 4 (Demo Alur Lokal):** [`docs/evidence/pertemuan-4/`](docs/evidence/pertemuan-4/)
* **Bukti Pengujian Pertemuan 5 (Operasi & Integrasi API):** [`docs/evidence/pertemuan-5/`](docs/evidence/pertemuan-5/)

---

## 5. Tim Pengembang (Kelompok 1 / Kelas D)

* **Haekal Khadafy**
* **Fikri Lazuardi Fadilla**
* **Fadhilah Aditya Ahmad**
* **Nayara Christony Paul Barriga**
* **Muhammad Yafi Nasrulloh**
* **Rama Sadea Putra**