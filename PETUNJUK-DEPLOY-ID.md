# Petunjuk Deployment WorkFlow Planner V1.1

Panduan instalasi baru dan pembaruan dari V1.0 telah digabungkan dalam dokumen **[UPGRADE-V1.0-KE-V1.1.md](UPGRADE-V1.0-KE-V1.1.md)** serta **[README.md](README.md)**.

**Untuk aplikasi V1.0 yang sudah berjalan di Vercel:** backup terlebih dahulu, jalankan `sql/002_upgrade_v1_1.sql` pada Supabase yang sama, tambahkan `SUPABASE_SERVICE_ROLE_KEY` hanya di Vercel Environment Variables untuk login username, lalu push source code V1.1 ke repositori GitHub lama. Jangan jalankan ulang `sql/001_initial.sql`.
