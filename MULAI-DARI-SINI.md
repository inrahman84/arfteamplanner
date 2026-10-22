# WorkFlow Planner V1.1.1 — Setup lebih mudah

Versi ini mendukung langsung Environment Variables yang sudah tampak di screenshot Vercel Anda:

- `NEXT_PUBLIC_SUPABASE_URL` (public URL)
- `SUPABASE_PUBLISHABLE_KEY` (public)
- `SUPABASE_SECRET_KEY` (server-only)

**Tidak perlu menambah `SUPABASE_URL` atau `SUPABASE_ANON_KEY` jika ketiga variabel itu sudah benar untuk project Supabase Anda.** Nama legacy juga tetap didukung.

## Untuk database Supabase yang baru dan benar-benar masih kosong

Buka Supabase > SQL Editor > New Query > tempel **seluruh isi** `sql/000_setup_database_baru.sql` > Run. Hanya satu file SQL.

**JANGAN menjalankan file ini pada database yang sudah digunakan WorkFlow Planner V1.0.** Untuk database V1.0 yang sudah dibuat, cukup gunakan migrasi `sql/002_upgrade_v1_1.sql` setelah backup.

## Untuk mengupdate aplikasi Vercel yang sudah online

Tentukan dulu repository GitHub yang benar dengan memeriksa Vercel > project `arfteamplanner` > Settings > Git. Jika Vercel menampilkan sumber Git repository, sinkronkan source code ke repository tersebut, bukan ke repository aplikasi lainnya. Vercel otomatis deploy pada push branch Production bila Git integration aktif.

Jika belum ada Git repository, hubungkan repository WorkFlow Planner khusus terlebih dahulu. Jangan menimpa repository `mahamera-course-scheduler`.

Setelah source ter-push dan build menjadi Ready, baru uji login dan data Supabase. Secret key harus tetap pada Vercel, **jangan dimasukkan GitHub atau dibagikan lewat screenshot**.

## Verifikasi

`npm test` untuk pengujian (14 tests), `npm run build` untuk build. Pengujian nyata terhadap account Supabase dan Vercel belum dilakukan.
