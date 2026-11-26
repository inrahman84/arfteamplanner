# ARF Media Hub v1.8 — review and rollout

This branch implements the first functional release (foundation, content workflow, weekly publication compliance, basic manual analytics). Existing Planner roles, tables and data are unchanged.

## Staging checklist
1. Back up existing database; provision a separate Supabase staging project with existing schema and test accounts; do not point preview tests at production.
2. Apply `sql/arf_media_hub_v18.sql` followed by `sql/arf_media_hub_v18_pic_scope.sql` to staging only. This is additive and enables RLS on every new exposed table. Confirm tables, grants, policies, triggers and security advisor results.
3. Identify the confirmed Manager account UUID in staging. Bootstrap exactly that user with the commented INSERT in the migration. Do not grant access based on Planner Super Admin or self-registration.
4. Open the same Workflow Planner app. Manager sees ARF Media Hub in sidebar and top bar; Media-only accounts skip Planner onboarding. Manager adds schools and account handles (include one optional foundation account), then grants or revokes the two coordinator roles using existing Auth UUIDs.
5. School coordinator creates one publication record per platform, moves Idea → Planned → In Production → Ready → Scheduled → Submitted, sets actual WIB date, full post URL, consent/rights confirmation. Central reviewer checks real public URL, matching school account, date, format, content eligibility; verifies or requests revision. No automatic external platform checking yet.
6. Manager and ARF coordinator monitor verified counts and pending verification. Instagram and TikTok targets are separately capped at 2/week; Monday–Sunday WIB; no regional coordinator. Foundation account excluded from school KPI. Verified records are locked except manual metrics. CSV weekly report.
7. Test using four distinct accounts: ordinary Planner user, Manager, central coordinator, school A and school B (five accounts total). Confirm ordinary user cannot query any media data; school A cannot read/write school B; school coordinator cannot set Verified or change feedback; reviewer cannot self-verify; duplicate post IDs fail; revoked membership fails; verified record core fields locked; Planner task CRUD, approvals, filters, exports, login still work.
8. Run `npm test`, `npm run build`, browser smoke test, regression and RLS tests before merging/deploying. A preview build alone is NOT proof of working RLS.
9. Apply reviewed migration to production only after successful staging tests. Confirm the exact real ARF Manager account; grant explicit access and test. Deploy from reviewed main branch, verify Vercel production and monitor. Roll back frontend to prior deployment if needed; keep additive data tables and revoke membership rather than deleting data.

## Scope limitations / follow-up
- Separate per-platform content records (not yet linked to shared campaign/parent content), fixed 2+2 standard, active school filter; historical active/assignment snapshots and configurable target periods not yet implemented.
- Manual posting and URL verification; no Instagram/TikTok API integration, automated reminders, audience growth, KPI quality rubric, formal strategic approval workflow, monthly matrix or Excel/PDF export. CSV available.
- No automatic integration with external asset library; HTTPS links only. No passwords or platform tokens stored. Verified corrections require controlled administrator process.
- Manager can administer users by Auth UUID; friendly user search/invites and unified Planner Settings integration are follow-up. Bootstrap manager requires human account confirmation.
- Existing app has no npm dependencies. No schema migration applied to production by this PR.

## Update: official ARF production and PIC
The ARF coordinator defaults to Konten Resmi ARF (official Instagram/TikTok), with the same content workflow as school coordinators. Monitoring Sekolah provides read/review access to school records; the coordinator cannot overwrite school production fields. The Manager reviews official ARF submissions. PIC/Pelaksana is required for new content and submission, stored separately from the authenticated creator, and displayed across cards, calendar, lists and analytics. Legacy records may show Belum diisi; verified legacy records stay locked. PIC is a descriptive text field, not an authorization assignment. No official ARF quota is assumed.
