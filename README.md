# Modul D-1: Registrasi Proyek dan Project Intake

**ERP PT Anaheim Nimbus Universal — Kelompok 1-D**

Repositori ini menyediakan data proyek terpusat (*Single Source of Truth*) untuk seluruh kelompok atau modul ERP yang membutuhkan data proyek kanonis, yaitu E-1, E-2, E-3, E-5, D-3, dan F-2.

---

## 1. Cara Menjalankan Aplikasi Web

Pastikan Node.js dan npm telah terpasang pada perangkat sebelum menjalankan aplikasi.
Pastikan `.env` berisi `DATABASE_URL="file:./dev.db"`; jika belum ada, salin `.env.example` menjadi `.env`.

1. **Pasang dependensi**
   ```bash
   npm install
   ```

2. **Buat atau terapkan skema database SQLite**
   ```bash
   npx prisma migrate deploy
   ```

3. **Muat data awal ke database SQLite**
   ```bash
   npm run db:seed
   ```

4. **Jalankan server aplikasi**
   ```bash
   npm start
   ```

5. **Buka aplikasi melalui browser**

   Akses alamat berikut:

   `http://localhost:3000`

Data proyek disimpan secara lokal di SQLite melalui Prisma ORM. Jalankan `npm run db:studio`
untuk membuka Prisma Studio dan menjelajahi data database.

---

## 2. Cara Menggunakan dan Menguji REST API

Server lokal menyediakan REST API resmi untuk mengakses data proyek kanonis yang digunakan oleh kelompok konsumen ERP.

### A. Mengambil Daftar Semua Proyek (Paging dan Filter)

Endpoint ini digunakan oleh modul dasbor manajemen (E-1) dan penagihan komersial (E-2) untuk mengambil daftar proyek dengan dukungan paginasi dan filter.

**Endpoint:**

`GET /api/v1/projects`

**Contoh URL — Paging:**

`http://localhost:3000/api/v1/projects?page=1&limit=3`

**Contoh URL — Filter Status:**

`http://localhost:3000/api/v1/projects?status=REGISTERED`

**Pengujian menggunakan cURL:**

```bash
curl -X GET "http://localhost:3000/api/v1/projects?page=1&limit=3"
```

```bash
curl -X GET "http://localhost:3000/api/v1/projects?status=REGISTERED"
```

**Tujuan pengujian:**
- Memastikan daftar proyek berhasil ditampilkan.
- Memastikan paginasi berdasarkan parameter `page` dan `limit` berjalan.
- Memastikan filter `status=REGISTERED` menampilkan proyek dengan status yang sesuai.

### B. Mengambil Detail Proyek Tertentu (API-K01-07)

Endpoint ini digunakan oleh modul E-2, E-3, E-5, D-3, dan F-2 untuk membaca detail resmi proyek berdasarkan ID proyek.

**Endpoint:**

`GET /api/v1/projects/{projectId}`

**Contoh URL:**

`http://localhost:3000/api/v1/projects/202601`

**Pengujian menggunakan cURL:**

```bash
curl -X GET "http://localhost:3000/api/v1/projects/202601"
```

**Tujuan pengujian:**
- Memastikan detail proyek dengan ID `202601` dapat diakses.
- Memastikan data yang dikembalikan sesuai dengan data proyek kanonis.
- Memastikan endpoint memberikan respons yang sesuai apabila proyek tidak ditemukan.

---

## 3. Bukti Demo Pertemuan 4

Tangkapan layar hasil pengujian aplikasi dan REST API disimpan pada direktori berikut:

```text
docs/evidence/pertemuan4demo
```

Direktori tersebut digunakan untuk mendokumentasikan bukti pengujian alur aplikasi lokal pada Pertemuan 4.