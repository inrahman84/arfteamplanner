# ARF WorkFlow Planner

Repository untuk aplikasi **WorkFlow Planner V1.1.1** — Dashboard, Board/Kanban, Grid, Gantt, Calendar, user management, status On Hold, attachment links, dan persetujuan Completed oleh Manager.

**Status:** repository dibuat; proses publikasi source code dan konfigurasi deployment sedang disiapkan.

## Teknologi
- Frontend: HTML, CSS, JavaScript responsif + PWA.
- Hosting: Vercel (framework Other).
- Backend multi-user: Supabase (PostgreSQL/Auth/RLS).
- Build: Node.js 20+, `npm run build` menghasilkan folder `dist`.

Jangan mengunggah Supabase secret/service_role key ke repository publik. Gunakan Environment Variables server di Vercel.

> Migrasi database hanya dapat diterapkan setelah project Supabase yang benar diverifikasi. Data demo dalam browser tidak otomatis menjadi data bersama di Supabase.
