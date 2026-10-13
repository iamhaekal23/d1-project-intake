# Modul D-1: Registrasi Proyek dan Project Intake
**Enterprise Resource Planning (ERP) PT Anaheim Nimbus Universal**  
*Kelompok 1 / Kelas D*

Repositori ini memuat spesifikasi OpenAPI v0.1, contoh respons JSON, dan panduan pengujian mock server untuk modul Project Intake (D-1).

## Struktur Repositori
- `openapi/openapi.yaml` : Kontrak OpenAPI 3.0.3 untuk endpoint data kanonis proyek.
- `examples/` : Fixture respons JSON fiktif (HTTP 200 OK dan HTTP 404 Not Found).

## Menjalankan Mock Server (Prism)
1. Pastikan runtime Node.js (v18+) terpasang.
2. Jalankan mock server:
   ```bash
   npx @stoplight/prism-cli mock openapi/openapi.yaml
