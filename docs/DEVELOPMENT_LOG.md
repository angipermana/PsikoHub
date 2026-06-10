# PsikoHub - Development Log & Architecture

Dokumen ini adalah rekapitulasi pengembangan fitur MVP untuk Platform Psikotes Online (PsikoHub) menggunakan Node.js, Express, EJS, dan Prisma ORM.

## 🚀 Tech Stack
- **Backend:** Node.js, Express.js
- **Database:** PostgreSQL dengan Prisma ORM
- **Session Management:** `express-session` + `connect-pg-simple` (disimpan di database)
- **Frontend / Templating:** EJS dengan Tailwind CSS (via CDN untuk MVP)
- **Reporting:** `exceljs` untuk export data ke Excel

## 🎯 Fitur yang Telah Diselesaikan (MVP V2)

### A. Manajemen Master Data (Super Admin)
1. **Manajemen Klien (`/admin/clients`)**
   - Pembuatan akun Klien (Client Profile) lengkap dengan *dummy password*.
   - Akun Klien bisa login ke `/client` untuk melihat laporannya sendiri.
2. **Bank Soal (`/admin/questions`)**
   - Mendukung tipe soal: Multiple Choice, True/False, Likert, Short Answer.
   - Dilengkapi fitur **Filter** berdasarkan Tipe Soal.
   - Tersedia fitur **Import CSV** untuk mempercepat input soal massal.
3. **Paket Tes (`/admin/packages`)**
   - Pengelompokan soal dari Bank Soal ke dalam 1 paket ujian.
   - Aturan pengerjaan seperti batas waktu (menit) dan opsi pengacakan urutan soal (*randomize*).

### B. Manajemen Project & Link Akses (`/admin/projects`)
- Admin dapat membuat Project baru untuk Klien tertentu menggunakan Paket Tes yang sudah dibuat.
- Otomatis melakukan *generate* Token (menggunakan `nanoid`) untuk link pendaftaran peserta: `/test/:token`.
- Admin bisa mengaktifkan/menonaktifkan parameter keamanan/proctoring (Fullscreen, Cegah Pindah Tab, Deteksi Kamera).
- Mengatur rentang waktu aktifnya Project (*Active From* & *Active Until*).

### C. Portal Peserta Tes (`/test/:token`)
1. **Validasi & Registrasi**
   - Sistem akan memvalidasi apakah link valid, sesi sedang aktif, dan belum kadaluarsa.
   - Peserta mendaftar dengan Nama dan Email.
2. **Setup Ujian**
   - Halaman persiapan untuk memberikan izin akses kamera, layar penuh, dan penjelasan aturan tes.
3. **Pengerjaan (Run Test)**
   - Fitur **Autosave** via AJAX ke endpoint `/api/answer`: Setiap pilihan jawaban otomatis tersimpan ke DB.
   - *Countdown Timer* di sisi client, jika habis otomatis *submit*.
   - **Proctoring Anti-Cheat:** Mendeteksi `visibilitychange` (pindah tab) dan layar keluar dari *fullscreen*. Setiap pelanggaran dicatat secara *real-time* ke database tabel `ProctoringLog`.
   - Pencegahan klik kanan (*Context Menu*) dan *Copy-Paste* melalui CSS (`user-select: none`).
4. **Selesai (Finish)**
   - Status sesi diubah menjadi `COMPLETED` dengan waktu penyelesaian (`submittedAt`).

### D. Reporting & Dashboard Klien
1. **Dashboard Admin (`/admin/reports`) & Klien (`/client`)**
   - Klien memiliki dashboard khusus untuk melihat daftar project yang ditugaskan ke instansinya.
   - Klien tidak memiliki akses ke pengaturan soal/paket (hanya *read-only* hasil tes).
2. **Kalkulasi Nilai Otomatis (Auto-Scoring)**
   - Menghitung *Total Score* berdasarkan `scoreValue` dari setiap opsi yang dipilih.
   - Menghitung akurasi (Jumlah Jawaban Benar).
   - Menampilkan akumulasi jumlah "Pelanggaran Proctoring".
3. **Export to Excel**
   - Rekap nilai dan data peserta diunduh langsung dalam format `.xlsx` menggunakan `exceljs`.

## 🛠️ Catatan Perbaikan Bug Selama Pengembangan
- **Penambahan Script Dev:** Menambahkan `"dev": "nodemon app.js"` ke `package.json`.
- **Relasi Database ProctoringLogs:** Memperbaiki penamaan relasi pada Prisma dari `proctoringLogs` menjadi `logs` di `clientController.js` dan `reportController.js`.
- **Tipe Data UUID:** Menghapus fungsi `parseInt()` yang keliru dipakai untuk ID Project berformat UUID *String*, yang sebelumnya menyebabkan `500 Server Error`.
- **Waktu Penyelesaian:** Menyesuaikan nama *field* `finishedAt` menjadi `submittedAt` di tahap *submit test* agar sesuai dengan skema Prisma, sehingga hasil ujian berhasil tersimpan.
- **Handling 404:** Menambahkan *view* `partials/404.ejs` untuk mencegah aplikasi *crash* total ketika browser me-*request* rute yang tidak valid atau aset yang hilang (seperti `/favicon.ico`).

## 🔮 Rencana Pengembangan Selanjutnya (Tahap Scale-Up)
1. Mengubah Tailwind CDN ke Tailwind CLI/PostCSS agar lebih optimal di sisi performa (*production ready*).
2. Konversi Raw Score ke Skala/Norma Psikologi spesifik (IQ, Stanine, dsb).
3. Integrasi *Face Recognition* pada modul Proctoring (saat ini MVP baru deteksi tab & fullscreen).
4. Pembuatan UI/UX khusus Peserta yang lebih dinamis dan interaktif.

---
*Log ini di-generate otomatis untuk merangkum seluruh percakapan dan pengerjaan MVP Platform PsikoHub.*
