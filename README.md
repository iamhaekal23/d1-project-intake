# Modul D-1: Registrasi Proyek dan Project Intake
ERP PT Anaheim Nimbus Universal - Kelompok 1-D

Repositori ini menyediakan data proyek terpusat (Single Source of Truth) untuk seluruh kelompok/modul di ERP (E-1, E-2, E-3, E-5, D-3, F-2).

---

## 1. Cara Menjalankan Aplikasi Web
1. Pasang dependensi: `npm install`
2. Muat data awal: `npm run db:seed`
3. Jalankan server: `npm start`
4. Buka di browser: `http://localhost:3000`

---

## 2. Cara Menggunakan & Menguji REST API

Server lokal menyediakan REST API untuk seluruh kelompok yang membutuhkan data proyek:

### A. Ambil Daftar Semua Proyek (Paging & Filter)
Bisa digunakan oleh semua kelompok (misal modul E-1, E-2, pelaporan):
* **URL Browser / GET**:  
  `http://localhost:3000/api/v1/projects?page=1&limit=3`
* **Filter Proyek Terdaftar**:  
  `http://localhost:3000/api/v1/projects?status=REGISTERED`
* **Contoh cURL**:
  ```bash
  curl -X GET "http://localhost:3000/api/v1/projects?page=1&limit=3"