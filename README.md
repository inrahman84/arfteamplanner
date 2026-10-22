# WorkFlow Planner V1.1 — Vercel + Supabase

Aplikasi planner untuk desktop dan mobile PWA, dengan source code HTML/CSS/JavaScript vanilla dan database Supabase PostgreSQL. Proyek tetap mendukung deployment Vercel dengan preset **Other**, `npm run build`, dan output `dist`. V1.1 tidak memerlukan npm dependencies. Node.js >=20.

## Mulai dari proyek V1.0 di Vercel

**Baca [UPGRADE-V1.0-KE-V1.1.md](UPGRADE-V1.0-KE-V1.1.md) sebelum men-deploy**. Migrasi SQL `sql/002_upgrade_v1_1.sql` wajib dijalankan lebih dulu pada project Supabase yang sama. Data lama tidak dihapus oleh migration script; tetap lakukan backup sebelum upgrade.

## Fitur

1. **Work Item:** Work Item, Assigned To, Category, Priority, Start Date, Due Date, Notes, Key Stakeholders, Attachment URL.
2. **Status:** Not Started, In Progress, On Hold, Completed. Attachment link HTTPS hanya ditampilkan ketika In Progress.
3. **Completion approval:** pengguna mengajukan penyelesaian, Manager/Super Admin menyetujui atau menolak. Pengguna non-manager tidak bisa mengubah Completed langsung (trigger database); Manager dapat menandai tugas sendiri Completed.
4. **Dashboard:** overview KPI, mini calendar, workload per member, pending approvals, filter Team/User.
5. **Board:** drag-and-drop ke empat status (Completed bagi non-manager berubah menjadi pengajuan approval).
6. **Grid:** task list dengan filter, urutan, ekspor CSV.
7. **Gantt:** timeline dan filter Team/User.
8. **Calendar:** Week/Month/Year.
9. **Account:** username login, email login backward-compatible, registration, profile, roles dan team grouping.
10. **Roles:** Super Admin, Manager, Asisten Manager, Specialist, Admin, Officer. Hanya Manager/Super Admin dapat mengubah role orang lain; Manager tidak bisa mengangkat/mengubah Super Admin.

## Jalankan demo secara lokal

```bash
npm run dev
```

Buka http://localhost:3000. Tidak memerlukan database untuk Demo Mode, tetapi penyimpanan hanya lokal di browser. Gunakan `npm test` (12 test) dan `npm run build` untuk validasi source.

## Deploy Vercel Hobby untuk prototipe personal

1. Impor repository GitHub yang memuat `package.json`, `public/`, `api/`, `scripts/`, `sql/` dan `vercel.json` di root.
2. Framework Preset **Other**, build `npm run build`, output `dist`.
3. Environment: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` yang biasanya sudah disediakan integrasi Supabase di Vercel. Nama variabel lama (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) juga tetap didukung. Key rahasia **server only**.
4. Untuk database Supabase yang benar-benar **baru/kosong**, cukup jalankan **SATU FILE** `sql/000_setup_database_baru.sql` di SQL Editor. Untuk project **V1.0 berjalan**, jalankan **hanya** `002_upgrade_v1_1.sql`.
5. Deploy atau redeploy project Vercel semula. Fungsi login username berada di `/api/username-login`.

**Catatan lisensi:** Vercel Hobby diatur untuk penggunaan personal nonkomersial. Untuk operasional organisasi/yayasan/bisnis, evaluasi syarat Vercel dan alternatif paket hosting yang sesuai.

## Folder

- `public/app.js`: UI semua tampilan, form task, approval, filter, kalender.
- `public/store.js`: demo localStorage, Supabase auth dan REST, CRUD.
- `public/core.js`: shared date utils, metrics, CSV, roles.
- `public/app.css`: tema responsive, palet warna yang diminta.
- `api/username-login.js`: serverless login username/password secara aman.
- `sql/000_setup_database_baru.sql`: satu query setup lengkap V1.1 untuk database baru dan kosong.
- `sql/001_initial.sql`: schema V1.0 untuk project baru (opsi manual).
- `sql/002_upgrade_v1_1.sql`: incremental database migration untuk role, user, completion approval, attachment.
- `scripts/build.mjs`: build statis tanpa dependensi (jangan mengirim service-role secret ke client).
- `tests/`: regression unit, demo CRUD, UI smoke, workflow approval.

## Batasan

- Link attachment bukan file upload; https URL hanya tampil pada In Progress.
- Team grouping adalah label, bukan unit hierarki.
- Supabase Free dan Vercel Hobby memiliki kebijakan/limit penggunaan; tidak ada jaminan produksi gratis.
- End-to-end Supabase Auth/RLS dan fungsi di akun Vercel nyata belum divalidasi dalam sesi ini; wajib tes staging dengan akun Manager dan Officer setelah migrasi.

## Cara paling singkat

Jika Vercel Anda sudah menunjukkan `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, dan `SUPABASE_SECRET_KEY`, **tidak perlu menambahkan variabel lain**. Pastikan ketiganya untuk project Supabase yang sama. Buat tabel pertama kali dengan `sql/000_setup_database_baru.sql` (khusus database kosong); push source ke GitHub, lalu deploy pada project Vercel yang dihubungkan. Jangan pernah menempel API key rahasia ke chat atau GitHub.
