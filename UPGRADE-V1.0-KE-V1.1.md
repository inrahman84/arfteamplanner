# WorkFlow Planner — Update dari V1.0 ke V1.1

**Tujuan:** meningkatkan aplikasi V1.0 yang SUDAH berjalan di Vercel tanpa mengganti URL Vercel, Supabase Project, akun, atau menghapus tugas.

> **Penting:** jangan menjalankan kembali `sql/001_initial.sql` pada database produksi. Jalankan **hanya** migrasi `sql/002_upgrade_v1_1.sql`. Cadangkan data terlebih dahulu. Migrasi ini tidak memakai `DROP TABLE`, `TRUNCATE`, atau `DELETE` pada data tugas.

## A. Checklist sebelum update

1. Pastikan aplikasi V1.0 tersambung ke **Supabase**, bukan *Demo Mode*. Data demo V1.0 ada di `localStorage` tiap browser dan bukan di Supabase.
2. Di Supabase, buat backup/ekspor tabel `profiles`, `workspaces`, `workspace_members`, `projects`, `categories`, dan `tasks`. Bila tersedia gunakan backup native; jika tidak, ekspor tabel CSV dari Table Editor. Simpan backup di tempat privat.
3. Simpan nilai Vercel environment yang sudah ada (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Jangan pernah menyalin nilai secret key ke percakapan, repo GitHub, file `.env` yang di-commit, atau browser.
4. Catat alamat Vercel saat ini dan repositori GitHub yang dihubungkan.

## B. Migrasi Supabase (wajib, lakukan SEBELUM redeploy kode)

1. Buka **Supabase → SQL Editor** pada **project yang sama dengan V1.0**.
2. Salin isi lengkap file `sql/002_upgrade_v1_1.sql` dan klik **Run**.
3. Periksa hasil: tabel `tasks` memiliki `attachment_url`, `completion_requested_at`, `completion_requested_by`, `completion_approved_by`, `completion_feedback`; `profiles` memiliki `username`; `workspace_members` memiliki `team_name`.
4. Peran lama otomatis dimigrasikan:

   | Peran V1.0 | Peran V1.1 |
   | --- | --- |
   | owner | Super Admin |
   | admin | Manager |
   | member | Officer |
   | viewer | Officer |

   Perubahan `viewer` menjadi `officer` meningkatkan izin tugas (dari lihat-saja ke mengerjakan tugas sendiri). Jika sebelumnya ada akun Viewer, evaluasi ulang aksesnya setelah migrasi.

5. **Tidak perlu membuat project Supabase baru.** Migrasi memakai `ALTER TABLE`, penggantian trigger, fungsi, dan policy untuk menambah fitur serta mempertahankan record yang ada.
6. Pastikan hasil migrasi sukses sebelum melanjutkan. **Jangan deploy kode V1.1 pada schema V1.0** karena dapat menghasilkan kegagalan query/RLS.

## C. Konfigurasi username login

Supabase Auth memakai email/password. V1.1 menambahkan *Vercel serverless function* `api/username-login.js` agar pengguna login dengan username tanpa membocorkan pemetaan username → email ke browser.

Buka **Vercel → Project → Settings → Environment Variables**, tambahkan/pertahankan variabel:

| Variable | Nilai | Lingkup |
| --- | --- | --- |
| `SUPABASE_URL` | URL Supabase yang sama seperti V1.0 | Build + server |
| `SUPABASE_ANON_KEY` | Publishable/anon key yang sama | Build + server |
| `SUPABASE_SERVICE_ROLE_KEY` | **Legacy service_role key**, dari Supabase Project Settings → API | **Server only — SECRET** |

**Peringatan keamanan:** `SUPABASE_SERVICE_ROLE_KEY` memiliki akses istimewa dan melewati RLS. Pastikan hanya ada di environment Vercel, *never* di `public/`, `.env` yang masuk Git, atau `dist/config.js`. Bila secret key tidak disetel, login email tetap dapat berjalan, tetapi login **username belum bisa digunakan** (endpoint memberi HTTP 503).

Pengguna V1.0: login sekali menggunakan **email lama**, buka **Settings → Edit Profile**, lalu tentukan username baru yang unik. Sesudah itu, login dengan username dapat digunakan. Format username: 3–30 karakter, diawali huruf kecil, hanya huruf kecil, angka, dan underscore (`_`). Pengguna baru mendaftar dengan nama, username, email, password; verifikasi email bila disyaratkan oleh pengaturan Supabase.

**Operasional:** fungsi username login melakukan satu query profile terbatas pada server kemudian password grant lewat Supabase Auth. Aktifkan proteksi brute-force dan pemantauan autentikasi untuk akses publik; jangan menggunakan Vercel Hobby sebagai solusi produksi organisasi tanpa memeriksa ketentuan komersial.

## D. Update GitHub / Vercel tanpa ganti project

1. Ekstrak ZIP V1.1.
2. Di repositori **GitHub lama** yang dihubungkan ke Vercel, **ganti file-file V1.0 dengan isi folder proyek V1.1** (`public/`, `api/`, `scripts/`, `sql/`, `package.json`, `vercel.json`, `tests/`, dokumentasi). Jangan membuat repo baru bila ingin mempertahankan auto-deploy dan URL.
3. Commit dan push ke branch production (`main`/branch terkait).
4. Vercel akan mengeluarkan deployment baru otomatis, atau buka **Deployments → Redeploy** setelah environment variables disimpan.
5. Pastikan konfigurasi build lama tetap:
   - Framework Preset: **Other**
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Node.js: 20 atau lebih baru
6. Pastikan file `api/username-login.js` ikut berada di **root repository** (`api/`, bukan di `public/api/`); inilah serverless function pada Vercel.
7. Setelah deploy, refresh tab aplikasi. Service worker sudah diganti versinya agar shell terbaru dimuat. Bila tampilan tidak berubah, tutup dan buka kembali tab atau hard refresh.

## E. Uji operasional setelah deploy

1. **Akun lama:** email login → profil → isi username → logout → login username.
2. **Role:** Super Admin mengubah role anggota ke Manager / Asisten Manager / Specialist / Admin / Officer. Manager dapat mengubah role anggota lain, tetapi tidak dapat menjadikan seseorang Super Admin atau mengubah role Super Admin.
3. **Work Item:** buat tugas, pindahkan status **In Progress**, masukkan tautan HTTPS. Pada status lain, field dan tautan tidak ditampilkan. URL disimpan tanpa mengunggah isi file.
4. **Completed:** login sebagai Specialist/Officer dengan tugas sendiri → pilih Completed atau Request Completed → status tetap **In Progress, Pending Approval**. Login Manager → buka kartu → pilih **Approve Completed** atau **Reject**. Manager dapat menandai tugas sendiri langsung **Completed**.
5. **Dashboard:** filter Team/User, klik workload per anggota, mini kalender, pending approval.
6. **Calendar:** ganti **Week / Month / Year**, navigasi tanggal.
7. **Gantt:** filter Team/User dan cek tanggal task.
8. Verifikasi tugas lama, proyek, anggota, dan kategori masih ada.

## F. Keterbatasan dan pengamanan

- Implementasi V1.1 memuat **link HTTPS**, bukan upload file fisik ke Supabase Storage.
- Team ialah **label** (`team_name`) yang diatur Manager pada menu Team; bukan hierarki tim bersarang.
- Data bersama memerlukan Supabase; *Demo Mode* lokal tidak menyinkronkan antar pengguna/perangkat.
- Tidak ada realtime push: reload untuk melihat perubahan rekan kerja terbaru.
- Pembatasan role dan transisi Completed diverifikasi di PostgreSQL **hanya setelah migrasi SQL berhasil diterapkan**.
- Deploy produksi Supabase, email confirmation, login username Vercel Function, dan RLS lintas akun **harus diuji dengan akun sungguhan**; paket ini diuji melalui test otomatis lokal dan build, bukan melalui project Supabase pengguna.
- **Vercel Hobby** ditujukan untuk penggunaan personal nonkomersial; untuk operasi yayasan/organisasi tinjau syarat layanan dan paket yang sesuai.

## G. Uji lokal

```bash
npm test
npm run build
npm run start
```

Gunakan `npm run dev` untuk development. Tanpa variabel Supabase, aplikasi otomatis memakai Demo Mode. Untuk login username lokal, tambahkan variabel `.env` ke project (jangan commit), yang berisi tiga environment variables seperti tabel di atas.
