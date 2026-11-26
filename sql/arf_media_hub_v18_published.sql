-- Apply after arf_media_hub_v18_pic_scope.sql, in staging first.
begin;
lock table public.media_contents in access exclusive mode;
alter table public.media_contents drop constraint media_contents_status_check;
-- One-time legacy status rename. Keep existing audit rows, timestamps and post keys.
alter table public.media_contents disable trigger media_validate_content;
alter table public.media_contents disable trigger media_audit_content;
update public.media_contents set status='Published' where status='Submitted';
alter table public.media_contents enable trigger media_validate_content;
alter table public.media_contents enable trigger media_audit_content;
alter table public.media_contents add constraint media_contents_status_check check(status in ('Idea','Planned','In Production','Ready','Scheduled','Published','Revision','Verified'));
create or replace function arf_media_private.validate_content() returns trigger language plpgsql set search_path='' as $$
declare r text:=arf_media_private.current_role(); k text; account_kind text;
begin
 if r is null then raise exception 'Media Hub access required'; end if;
 select kind into account_kind from public.media_schools where id=new.school_id;
 if account_kind is null then raise exception 'Invalid account scope'; end if;
 -- Normal production automatically moves a valid publication to Published.
 -- Independent review outcomes are not overwritten.
 new.published_url:=trim(new.published_url);
 if new.status not in ('Verified','Revision') then
   if new.published_url<>'' then new.status:='Published';
   elsif new.status='Published' then new.status:='Scheduled';
   end if;
 end if;

 if tg_op='INSERT' then
   if r='arf_media_coordinator' and account_kind<>'foundation' then raise exception 'ARF coordinator creates official ARF content only'; end if;
   if length(trim(new.pic_name))=0 then raise exception 'PIC / Pelaksana wajib diisi'; end if;
   if new.created_by is distinct from auth.uid() or new.status in ('Verified','Revision') or new.feedback<>'' then raise exception 'Invalid initial content'; end if;
   new.created_at:=now(); new.verified_by:=null; new.verified_at:=null;
 else
   if new.id is distinct from old.id or new.school_id is distinct from old.school_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then raise exception 'Immutable content identity'; end if;
   if r='arf_media_coordinator' and account_kind='school' then
     if old.status<>'Published' or new.status not in ('Verified','Revision') or (to_jsonb(new)-array['status','feedback','updated_at']) is distinct from (to_jsonb(old)-array['status','feedback','updated_at']) then raise exception 'School content: independent review only'; end if;
   end if;
   if r='arf_media_coordinator' and account_kind='foundation' and ((new.status is distinct from old.status and new.status in ('Verified','Revision')) or new.feedback is distinct from old.feedback) then raise exception 'Official ARF content requires Manager review'; end if;
   if new.pic_name is distinct from old.pic_name and length(trim(new.pic_name))=0 then raise exception 'PIC / Pelaksana wajib diisi'; end if;
   if old.status='Verified' and (new.pic_name,new.title,new.platform,new.format,new.pillar,new.brief,new.caption,new.asset_url,new.planned_date,new.actual_date,new.published_url,new.permission_checked,new.status,new.feedback) is distinct from (old.pic_name,old.title,old.platform,old.format,old.pillar,old.brief,old.caption,old.asset_url,old.planned_date,old.actual_date,old.published_url,old.permission_checked,old.status,old.feedback) then raise exception 'Verified record locked; correction requires controlled admin process'; end if;
   if (new.status is distinct from old.status and new.status in ('Verified','Revision')) or new.feedback is distinct from old.feedback then
     if r not in ('arf_manager','arf_media_coordinator') or old.created_by=auth.uid() then raise exception 'Independent reviewer required'; end if;
   end if;
   if new.status='Verified' and old.status<>'Verified' then
     if old.status<>'Published' then raise exception 'Submit publication before verification'; end if;
     if (new.pic_name,new.platform,new.actual_date,new.published_url,new.permission_checked,new.title,new.format) is distinct from (old.pic_name,old.platform,old.actual_date,old.published_url,old.permission_checked,old.title,old.format) then raise exception 'Review submitted evidence without changing it'; end if;
     new.verified_by:=auth.uid();new.verified_at:=now();
   else
     new.verified_by:=old.verified_by;new.verified_at:=old.verified_at;
   end if;
 end if;
 if new.status in ('Published','Verified') then
   if length(trim(new.pic_name))=0 and not (tg_op='UPDATE' and old.status='Verified') then raise exception 'PIC / Pelaksana wajib diisi'; end if;
   if not new.permission_checked or new.actual_date is null or new.actual_date>(now() at time zone 'Asia/Jakarta')::date then raise exception 'Valid publication date and media permission required'; end if;
   if new.platform='Instagram' then
      k:=substring(new.published_url from '^https://(?:www\.)?instagram\.com/(?:p|reel)/([A-Za-z0-9_-]+)/?(?:[?#].*)?$');
   else
      k:=substring(new.published_url from '^https://(?:www\.)?tiktok\.com/@[A-Za-z0-9._-]+/(?:video|photo)/([0-9]+)/?(?:[?#].*)?$');
   end if;
   if k is null then raise exception 'Use the full Instagram post/Reel or TikTok video/photo URL'; end if;
   new.post_key:=k;
 else new.post_key:=null;
 end if;
 new.updated_at:=now();
 return new;
end $$;
commit;
