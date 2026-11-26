# ARF Media Hub V1.8.0 — Staged Release Guide

Source: SRS-AMP-001 (26 Nov 2026) and the approved Media Social Workspace decisions.

## Modules and boundaries

The Media Hub is part of the WorkFlow Planner deployment, at `/media-hub` (rewrites to `/media-hub.html`). It uses Supabase Auth for a single identity but independent membership in `media_members`. Planner roles are never inferred as Media roles, and Media-only accounts are blocked from creating or joining Planner until a Manager grants explicit Planner eligibility. An entitlement flag alone is **not** a workspace membership.

Final sidebar order:
Dashboard | Content Workspace | Content Calendar | Content Table | Published Content | Review & Feedback | Performance Analytics | Administration | User & Role Management.

Role hierarchy: ARF_MANAGER → ARF_MEDIA_COORDINATOR → SCHOOL_MEDIA_COORDINATOR. Regional is data only. School roles are restricted to their assigned school in server-side RLS; central roles have cross-school access. Only Manager can approve strategic material and change targets or Media role entitlements. ARF Coordinator can verify school publications but not their own posts.

## Implemented P0 pilot scope

- School/account master (Instagram, TikTok only); no passwords for external social platforms.
- Content brief, caption, assigned PIC, category, planned date, HTTPS asset link, strategic and sensitive flags, four publication eligibility checks and review.
- One content with multiple child publication records, one each per submitted IG/TikTok post; HTTPS proof, post date, account, pending/verified/rejected status.
- Client-side weekly school matrix and KPI: Asia/Pontianak, Monday-Sunday, verified only, Instagram 2 and TikTok 2 by default, capped average, active effective targets, pending separated.
- XLSX/PDF export of weekly school performance using the same calculation as the dashboard.
- Server RLS domain separation, content and publication scope guards, no self-verification, audit of review/verification decisions, last-Manager protection.
- Username/password school account provisioning and password resets via `media-school-accounts` Supabase Edge Function; passwords only passed to Auth and never stored in public app tables.
- The existing production database has an **ARF One School Auth trigger** that automatically creates a `SCHOOL_OPERATOR` membership whenever any Auth user is created. Our Media account provisioner specifically deletes this new user's automatic One School membership using the privileged backend service role, checks the removal and fails closed/rolls back Auth if cleanup fails. No existing One School members are modified. The local E2E fixture mimics this trigger.
- Retains all Planner app source, roles, tasks and navigation.

## Required release gates (NOT YET COMPLETED)

1. **Stage database first — without paid Supabase cloud staging.** GitHub Actions starts a disposable local Supabase Postgres via pinned Supabase CLI, executes `tests/db/media-fixture.sql` (synthetic Planner/Auth objects), applies the real `sql/019_media_hub_p0.sql` migration, and runs `tests/db/media-security.sql` against actual RLS policies. All databases are isolated from production. The job is `media-supabase-local` in `.github/workflows/test-build.yml` and runs on every PR. This uses GitHub Actions runner resources and may count against the repository's Actions minutes; it does not create a billable Supabase cloud branch.
2. Run the exact role matrix from SRS AT-01 to AT-15 with test Manager, ARF Coordinator, School A/B users, Planner-only user and dual-role user.
3. Verify DDL, RLS SELECT/INSERT/UPDATE/DELETE, row ownership, blocked cross-school IDs and exports, last Manager guard and reviewer self-verification denial.
4. Test school accounts with the free local Auth/Edge E2E workflow (`.github/workflows/media-auth-e2e.yml`): create a real local Auth manager, invoke the Media account provisioning function, authenticate through the existing `username-login` Edge Function, confirm school RLS and Planner isolation, then reset the password. This is CI test infrastructure only, not production user creation.
5. Restore and rollback drill, then sign-off from ARF Manager; production migration and function deployment only after approval.
6. Bootstrap first ARF Manager via privileged database operation (below). **No Planner technical admin gets automatic Media access.**
7. Seed verified school roster, regional metadata, eligible accounts, Coordinator memberships and period targets. Do not import an unverified school roster.
8. Confirm links to Google Drive assets respect Google Drive permissions; test media consent/copyright workflow for children.
9. After production migration and user provisioning, deploy/merge PR, test /media-hub, module switch, login, all nine menus and Planner regressions. Keep rollback to prior Vercel deployment available.

## Manager bootstrap template (privileged SQL only)

Do not run as an unauthenticated user or client. Replace `<verified_user_uuid>` with the verified Supabase Auth ID of the ARF Manager and record approval in audit trail:

```sql
-- Run only from a privileged, audited operator session AFTER stage approval.
insert into public.media_members (user_id,role,active,planner_enabled)
values ('<verified_user_uuid>'::uuid,'ARF_MANAGER',true,false);

insert into public.media_audit_logs (actor_id,action,entity,entity_id,detail)
values (null,'initial_manager_bootstrap','media_members',
        '<verified_user_uuid>'::uuid,'{"source":"approved manager bootstrap"}');
```

Existing Planner memberships are preserved even with `planner_enabled=false`. This flag controls whether a Media-only account may join Planner subsequently, not whether a current Planner member is revoked.

## Known limits / planned enhancements

- Automated local migration/RLS tests run in GitHub Actions. These are synthetic user tests, not production database testing or full browser/Edge Function UAT. Do not call this production-ready until all security test jobs pass and a real approved Manager does manual role/UAT checks.
- No publication API, auto-posting, automatic notification, YouTube or storing Instagram/TikTok passwords.
- Audience metrics, school scorecard weights, elaborate quality rubrics, ideas and campaign management are P1/P2.
- Content and weekly Analytics operate on bounded pilot data fetched by the client; server pagination, period closure/snapshots, formal correction approvals and large-scale reporting need implementation/validation before a full rollout.
- The reporting timetable, eligible content formats, target ARF account, school roster and privacy policies require Manager confirmation as documented in SRS.

## Validation status

- `npm test`, `node --check` for public client JS and `npm run build` run in GitHub CI for the draft PR.
- Vercel Preview build is available; its database menus remain access-gated and cannot be considered user-acceptance-tested until Manager bootstrap. CI local database tests replace the paid staging environment.
- Read-only production schema preflight confirmed public `profiles`, `workspaces`, `workspace_members`, the Planner invitation RPC, and the One School Auth trigger are present. Media tables are not yet installed.
- The existing production `service_role` has SELECT/DELETE privileges on `public.arf_school_members` and bypasses RLS, which allows the newly created Media-only user's unintended One School membership to be cleaned up.
- No production Media Hub role grants, database migrations, or school credential creation have been performed.
