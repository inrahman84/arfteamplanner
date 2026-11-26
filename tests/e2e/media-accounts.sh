#!/usr/bin/env bash
# Disposable Supabase Auth + Edge integration checks. Never run against production.
set -euo pipefail
: "${API_URL:?Supabase local API URL required}"
: "${ANON_KEY:?Supabase local anon key required}"
: "${SERVICE_ROLE_KEY:?Supabase local service key required}"
: "${PGPASSWORD:?Local DB password required}"
BASE="${API_URL%/}"
if [[ "$BASE" != http://127.0.0.1:* && "$BASE" != http://localhost:* ]]; then
  echo "ERROR: E2E refuses any non-local Supabase API";exit 1
fi
DB=(psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -v ON_ERROR_STOP=1 -At)
sql() { "${DB[@]}" -c "$1"; }
admin() {
 curl -fsS "$BASE$1" -H "apikey: $SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SERVICE_ROLE_KEY" -H "Content-Type: application/json" \
  "${@:2}"
}
auth() {
 curl -fsS "$BASE$1" -H "apikey: $ANON_KEY" \
  -H "Content-Type: application/json" "${@:2}"
}
check_id() { [[ "$1" =~ ^[0-9a-f-]{36}$ ]] || { echo "Invalid Auth user ID";exit 1; }; }
manager_data=$(admin "/auth/v1/admin/users" -X POST -d \
 '{"email":"manager-media-e2e@example.test","password":"CI-manager-S3cure-2026!","email_confirm":true,"user_metadata":{"full_name":"CI ARF Manager","username":"manager_ci"}}')
manager_id=$(jq -r '.id // ""' <<<"$manager_data")
check_id "$manager_id"
sql "insert into public.media_members(user_id,role,active) values ('$manager_id','ARF_MANAGER',true);" >/dev/null
one_school_manager=$(sql "select count(*) from public.arf_school_members where user_id='$manager_id';")
[[ "$one_school_manager" == "1" ]] || { echo "One School trigger fixture failed";exit 1; }
manager_login=$(auth "/auth/v1/token?grant_type=password" -X POST -d \
 '{"email":"manager-media-e2e@example.test","password":"CI-manager-S3cure-2026!"}')
manager_token=$(jq -r '.access_token // ""' <<<"$manager_login")
[[ -n "$manager_token" ]] || { echo "Manager sign-in failed";exit 1; }
echo "Creating coordinator via actual local Media Hub Edge Function..."
payload=$(jq -cn --arg school "30000000-0000-4000-8000-000000000001" --arg pwd "CI-school-S3cure-2026!" \
 '{action:"create",school_id:$school,username:"coord_school_e2e",full_name:"CI School Coordinator",password:$pwd}')
created=$(curl -fsS "$BASE/functions/v1/media-school-accounts" \
 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $manager_token" \
 -H "Content-Type: application/json" -d "$payload")
coord_id=$(jq -r '.user_id // ""' <<<"$created")
check_id "$coord_id"
[[ "$(sql "select count(*) from public.media_members where user_id='$coord_id' and role='SCHOOL_MEDIA_COORDINATOR' and planner_enabled=false;")" == "1" ]] || {
 echo "Media role not created";exit 1;
}
[[ "$(sql "select count(*) from public.arf_school_members where user_id='$coord_id';")" == "0" ]] || {
 echo "One School auto-membership was not removed";exit 1;
}
[[ "$(sql "select count(*) from public.workspace_members where user_id='$coord_id';")" == "0" ]] || {
 echo "Unexpected Planner membership created";exit 1;
}
[[ "$(sql "select count(*) from public.media_audit_logs where entity_id='$coord_id' and action='create_school_account';")" == "1" ]] || {
 echo "Create operation lacked audit";exit 1;
}
echo "Testing school username/password through actual username-login Edge Function..."
coordinator_login=$(curl -fsS "$BASE/functions/v1/username-login" \
 -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
 -d '{"username":"coord_school_e2e","password":"CI-school-S3cure-2026!"}')
[[ "$(jq -r '.user.id // ""' <<<"$coordinator_login")" == "$coord_id" ]] || {
 echo "School username-login returned a different Auth user";exit 1;
}
school_token=$(jq -r '.access_token // ""' <<<"$coordinator_login")
school_rows=$(curl -fsS "$BASE/rest/v1/media_schools?select=id" \
 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $school_token")
[[ "$(jq 'length' <<<"$school_rows")" == "1" ]] || { echo "School RLS did not restrict visible schools";exit 1; }
echo "Resetting coordinator password through central authenticated service..."
reset_payload=$(jq -cn --arg id "$coord_id" --arg pwd "CI-school-New-S3cure-2026!" \
 '{action:"reset",user_id:$id,password:$pwd}')
reset_result=$(curl -fsS "$BASE/functions/v1/media-school-accounts" \
 -H "apikey: $ANON_KEY" -H "Authorization: Bearer $manager_token" \
 -H "Content-Type: application/json" -d "$reset_payload")
[[ "$(jq -r '.ok // false' <<<"$reset_result")" == "true" ]] || { echo "Reset failed";exit 1; }
new_login=$(curl -fsS "$BASE/functions/v1/username-login" \
 -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
 -d '{"username":"coord_school_e2e","password":"CI-school-New-S3cure-2026!"}')
[[ "$(jq -r '.user.id // ""' <<<"$new_login")" == "$coord_id" ]] || {
 echo "New password did not authenticate";exit 1;
}
[[ "$(sql "select count(*) from public.media_audit_logs where entity_id='$coord_id' and action='reset_school_password';")" == "1" ]] || {
 echo "Reset was not audited";exit 1;
}
echo "PASS: local Auth + Media account provisioning + RLS + username login + password reset"
