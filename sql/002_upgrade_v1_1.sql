-- WorkFlow Planner V1.1: run AFTER 001_initial.sql in Supabase SQL Editor.
-- Non-destructive upgrade: preserves profiles, memberships, projects and tasks.
BEGIN;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_username_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_format CHECK (username IS NULL OR username ~ '^[a-z][a-z0-9_]{2,29}$');
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique ON public.profiles(lower(username)) WHERE username IS NOT NULL;

-- Existing owners remain Super Admin; former admins become Managers;
-- former members and viewers become Officers. Existing login emails remain valid.
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS workspace_members_role_check;
UPDATE public.workspace_members SET role = CASE role
 WHEN 'owner' THEN 'super_admin' WHEN 'admin' THEN 'manager'
 WHEN 'member' THEN 'officer' WHEN 'viewer' THEN 'officer' ELSE role END
WHERE role IN ('owner','admin','member','viewer');
ALTER TABLE public.workspace_members ALTER COLUMN role SET DEFAULT 'officer';
ALTER TABLE public.workspace_members ADD COLUMN IF NOT EXISTS team_name text NOT NULL DEFAULT 'General';
ALTER TABLE public.workspace_members DROP CONSTRAINT IF EXISTS member_team_name_size;
ALTER TABLE public.workspace_members ADD CONSTRAINT member_team_name_size CHECK (length(trim(team_name)) BETWEEN 1 AND 60);
ALTER TABLE public.workspace_members ADD CONSTRAINT workspace_members_role_check CHECK (role IN ('super_admin','manager','assistant_manager','specialist','admin','officer'));

ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_status_check CHECK (status IN ('Not Started','In Progress','On Hold','Completed'));
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_url text NOT NULL DEFAULT '';
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_requested_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_requested_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_approved_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_reviewed_at timestamptz;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_reviewed_by uuid REFERENCES public.profiles(id);
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS completion_feedback text NOT NULL DEFAULT '';
ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_attachment_format;
ALTER TABLE public.tasks ADD CONSTRAINT tasks_attachment_format CHECK (attachment_url = '' OR (length(attachment_url) <= 2048 AND attachment_url ~ '^https://[^[:space:]]+$'));

CREATE OR REPLACE FUNCTION public.create_user_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE desired text;
BEGIN
 desired := lower(trim(coalesce(new.raw_user_meta_data->>'username','')));
 IF desired = '' THEN desired := NULL; END IF;
 INSERT INTO public.profiles(id,email,full_name,username)
 VALUES(new.id,coalesce(new.email,''),coalesce(new.raw_user_meta_data->>'full_name',split_part(coalesce(new.email,''),'@',1)),desired)
 ON CONFLICT(id) DO NOTHING;
 RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.touch_profile() RETURNS trigger
LANGUAGE plpgsql SET search_path=public, pg_temp AS $$
BEGIN
 IF new.email IS DISTINCT FROM old.email OR new.id IS DISTINCT FROM old.id THEN
  RAISE EXCEPTION 'Email and profile ID cannot be changed here';
 END IF;
 IF new.username IS NOT NULL THEN new.username := lower(trim(new.username)); END IF;
 new.updated_at := now();
 RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.setup_new_workspace() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
BEGIN
 INSERT INTO public.workspace_members(workspace_id,user_id,role) VALUES(new.id,new.created_by,'super_admin');
 INSERT INTO public.projects(workspace_id,name,color) VALUES(new.id,'General','#3f6276');
 INSERT INTO public.categories(workspace_id,name,color) VALUES
 (new.id,'Strategic','#c89b55'),(new.id,'Operations','#3f6276'),
 (new.id,'Development','#009b4c'),(new.id,'Administration','#5f5d5d');
 RETURN new;
END; $$;

CREATE OR REPLACE FUNCTION public.join_workspace_by_code(invite_code text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE w uuid; caller uuid;
BEGIN
 caller := auth.uid();
 IF caller IS NULL THEN RAISE EXCEPTION 'Login required'; END IF;
 IF length(trim(coalesce(invite_code,''))) <> 12 THEN RAISE EXCEPTION 'Invalid invite code'; END IF;
 SELECT id INTO w FROM public.workspaces WHERE join_code=upper(trim(invite_code));
 IF w IS NULL THEN RAISE EXCEPTION 'Code not found'; END IF;
 INSERT INTO public.workspace_members(workspace_id,user_id,role)
 VALUES(w,caller,'officer') ON CONFLICT DO NOTHING;
 RETURN w;
END; $$;

CREATE OR REPLACE FUNCTION public.rotate_workspace_code(target_workspace uuid) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE code text;
BEGIN
 IF NOT public.has_workspace_role(target_workspace,array['super_admin','manager']) THEN
  RAISE EXCEPTION 'Permission denied';
 END IF;
 code := upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 UPDATE public.workspaces SET join_code=code WHERE id=target_workspace;
 RETURN code;
END; $$;

-- Enforces member roles even if PostgREST is called without using the frontend.
CREATE OR REPLACE FUNCTION public.enforce_member_role_change() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE actor uuid := auth.uid();
BEGIN
 IF new.workspace_id IS DISTINCT FROM old.workspace_id OR new.user_id IS DISTINCT FROM old.user_id THEN
  RAISE EXCEPTION 'Membership identity is immutable';
 END IF;
 IF actor = old.user_id THEN RAISE EXCEPTION 'You cannot change your own workspace membership'; END IF;
 IF NOT public.has_workspace_role(old.workspace_id,array['super_admin','manager']) THEN
  RAISE EXCEPTION 'Role change requires Manager or Super Admin';
 END IF;
 IF (old.role='super_admin' OR new.role='super_admin')
   AND NOT public.has_workspace_role(old.workspace_id,array['super_admin']) THEN
  RAISE EXCEPTION 'Only Super Admin can manage Super Admin roles';
 END IF;
 RETURN new;
END; $$;
DROP TRIGGER IF EXISTS enforce_member_role ON public.workspace_members;
CREATE TRIGGER enforce_member_role BEFORE UPDATE ON public.workspace_members
FOR EACH ROW EXECUTE FUNCTION public.enforce_member_role_change();

-- Task status and completion approval are validated at the database level.
CREATE OR REPLACE FUNCTION public.touch_task() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public, pg_temp AS $$
DECLARE actor uuid := auth.uid(); manager_role boolean;
BEGIN
 manager_role := public.has_workspace_role(new.workspace_id,array['super_admin','manager']);
 new.updated_at := now();
 IF tg_op='INSERT' THEN
  IF new.status='Completed' AND NOT manager_role THEN
   RAISE EXCEPTION 'Completed requires Manager approval';
  END IF;
  IF new.completion_requested_at IS NOT NULL THEN
   RAISE EXCEPTION 'Create the task before requesting completion';
  END IF;
  new.completed_at := CASE WHEN new.status='Completed' THEN now() ELSE NULL END;
  new.completion_approved_by := CASE WHEN new.status='Completed' THEN actor ELSE NULL END;
  new.completion_requested_by := NULL;
  RETURN new;
 END IF;
 IF new.workspace_id IS DISTINCT FROM old.workspace_id OR new.created_by IS DISTINCT FROM old.created_by OR new.created_at IS DISTINCT FROM old.created_at THEN
  RAISE EXCEPTION 'Task identity cannot be modified';
 END IF;
 IF old.status='Completed' AND NOT manager_role THEN
  RAISE EXCEPTION 'Only Manager can update a completed task';
 END IF;
 IF new.status='Completed' AND old.status IS DISTINCT FROM 'Completed' AND NOT manager_role THEN
  RAISE EXCEPTION 'Use Request Completion; only Manager can approve Completed';
 END IF;
 IF (new.completion_requested_at IS DISTINCT FROM old.completion_requested_at OR
     new.completion_requested_by IS DISTINCT FROM old.completion_requested_by) AND new.status <> 'Completed' THEN
  IF new.completion_requested_at IS NOT NULL THEN
   IF actor IS DISTINCT FROM old.assigned_to AND actor IS DISTINCT FROM old.created_by AND NOT manager_role THEN
    RAISE EXCEPTION 'Only assignee or creator can request completion';
   END IF;
   IF new.status <> 'In Progress' THEN RAISE EXCEPTION 'Set status In Progress to request completion'; END IF;
   IF old.completion_requested_at IS NOT NULL THEN
    RAISE EXCEPTION 'Completion request is already pending';
   END IF;
   new.completion_requested_at := now();
   new.completion_requested_by := actor;
  ELSIF old.completion_requested_at IS NOT NULL THEN
   IF NOT manager_role THEN RAISE EXCEPTION 'Only Manager can reject a completion request'; END IF;
   new.completion_requested_by := NULL;
   new.completion_reviewed_at := now();
   new.completion_reviewed_by := actor;
  END IF;
 END IF;
 IF (new.completion_reviewed_at IS DISTINCT FROM old.completion_reviewed_at OR new.completion_reviewed_by IS DISTINCT FROM old.completion_reviewed_by) AND NOT manager_role THEN
  RAISE EXCEPTION 'Only Manager can review completion';
 END IF;
 IF new.completion_requested_at IS NULL THEN new.completion_requested_by := NULL; END IF;
 IF new.completion_feedback IS DISTINCT FROM old.completion_feedback AND NOT manager_role THEN
  RAISE EXCEPTION 'Only Manager can write completion feedback';
 END IF;
 IF new.status='Completed' THEN
  IF old.status IS DISTINCT FROM 'Completed' THEN
   new.completed_at := now();
   new.completion_approved_by := actor;
   new.completion_reviewed_at := now();
   new.completion_reviewed_by := actor;
   new.completion_feedback := '';
  ELSE
   new.completed_at := old.completed_at;
   new.completion_approved_by := old.completion_approved_by;
  END IF;
  new.completion_requested_at := NULL;
  new.completion_requested_by := NULL;
 ELSE
  new.completed_at := NULL;
  new.completion_approved_by := NULL;
  -- A status change invalidates an outstanding request.
  IF new.status IS DISTINCT FROM old.status THEN
   new.completion_requested_at := NULL;
   new.completion_requested_by := NULL;
  END IF;
 END IF;
 RETURN new;
END; $$;

DROP POLICY IF EXISTS workspace_update ON public.workspaces;
CREATE POLICY workspace_update ON public.workspaces FOR UPDATE TO authenticated
 USING(public.has_workspace_role(id,array['super_admin','manager']))
 WITH CHECK(public.has_workspace_role(id,array['super_admin','manager']));
DROP POLICY IF EXISTS member_update ON public.workspace_members;
CREATE POLICY member_update ON public.workspace_members FOR UPDATE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin','manager']))
 WITH CHECK(public.has_workspace_role(workspace_id,array['super_admin','manager']));
DROP POLICY IF EXISTS member_delete ON public.workspace_members;
CREATE POLICY member_delete ON public.workspace_members FOR DELETE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin']) AND user_id<>(select auth.uid()) AND role<>'super_admin');
DROP POLICY IF EXISTS project_insert ON public.projects;
CREATE POLICY project_insert ON public.projects FOR INSERT TO authenticated
 WITH CHECK(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']));
DROP POLICY IF EXISTS project_update ON public.projects;
CREATE POLICY project_update ON public.projects FOR UPDATE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']))
 WITH CHECK(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']));
DROP POLICY IF EXISTS project_delete ON public.projects;
CREATE POLICY project_delete ON public.projects FOR DELETE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin','manager']));
DROP POLICY IF EXISTS category_insert ON public.categories;
CREATE POLICY category_insert ON public.categories FOR INSERT TO authenticated
 WITH CHECK(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']));
DROP POLICY IF EXISTS category_update ON public.categories;
CREATE POLICY category_update ON public.categories FOR UPDATE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']))
 WITH CHECK(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']));
DROP POLICY IF EXISTS category_delete ON public.categories;
CREATE POLICY category_delete ON public.categories FOR DELETE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin','manager']));
DROP POLICY IF EXISTS task_insert ON public.tasks;
CREATE POLICY task_insert ON public.tasks FOR INSERT TO authenticated
 WITH CHECK(public.has_workspace_role(workspace_id,array['super_admin','manager','assistant_manager','specialist','admin','officer']) AND created_by=(select auth.uid()));
DROP POLICY IF EXISTS task_update ON public.tasks;
CREATE POLICY task_update ON public.tasks FOR UPDATE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin','manager']) OR
  ((created_by=(select auth.uid()) OR assigned_to=(select auth.uid())) AND
  public.has_workspace_role(workspace_id,array['assistant_manager','specialist','admin','officer'])))
 WITH CHECK(public.has_workspace_role(workspace_id,array['super_admin','manager']) OR
  ((created_by=(select auth.uid()) OR assigned_to=(select auth.uid())) AND
  public.has_workspace_role(workspace_id,array['assistant_manager','specialist','admin','officer'])));
DROP POLICY IF EXISTS task_delete ON public.tasks;
CREATE POLICY task_delete ON public.tasks FOR DELETE TO authenticated
 USING(public.has_workspace_role(workspace_id,array['super_admin','manager']) OR
  (created_by=(select auth.uid()) AND public.has_workspace_role(workspace_id,array['assistant_manager','specialist','admin','officer'])));
COMMIT;
