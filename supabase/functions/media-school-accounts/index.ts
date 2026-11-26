// Server-only school account provisioning. Supabase Auth stores password hashes.
const url=(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,'');
const admin=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
const origins=new Set(['https://arfteamplanner.vercel.app','http://localhost:3000',...(Deno.env.get('MEDIA_ACCOUNT_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean)]);
Deno.serve(async req=>{
 const origin=req.headers.get('origin')||'';
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Origin':origins.has(origin)?origin:'https://arfteamplanner.vercel.app','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info'};
 const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
 if(origin&&!origins.has(origin))return reply({message:'Origin not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({message:'Method not allowed.'},405);
 if(!url||!admin||!anon)return reply({message:'School account service is not configured.'},503);
 const token=req.headers.get('authorization')||'';
 if(!/^Bearer [^\s]+$/.test(token))return reply({message:'Authentication required.'},401);
 const privileged={'apikey':admin,'Authorization':'Bearer '+admin,'Content-Type':'application/json'};
 const get=async(path:string)=>{const res=await fetch(url+path,{headers:privileged,signal:AbortSignal.timeout(8000)});if(!res.ok)throw Error('Database query failed');return await res.json();};
 try{
  const auth=await fetch(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:token},signal:AbortSignal.timeout(8000)});
  if(!auth.ok)return reply({message:'Authentication required.'},401);
  const actor=await auth.json();
  const rows=await get('/rest/v1/media_members?select=role,active&user_id=eq.'+encodeURIComponent(actor.id));
  if(!rows.some((m:{role:string,active:boolean})=>m.active&&['arf_manager','arf_media_coordinator'].includes(m.role)))return reply({message:'Access denied.'},403);
  const raw=await req.text();if(raw.length>4096)return reply({message:'Invalid request.'},400);
  let body;try{body=JSON.parse(raw);}catch{return reply({message:'Invalid request.'},400);}
  const action=body?.action;
  const password=body?.password;
  if(['create','reset'].includes(action)&&(typeof password!=='string'||password.length<12||password.length>72||new TextEncoder().encode(password).length>72||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password)))return reply({message:'Password must be 12–72 characters, including uppercase, lowercase and a number.'},400);
  if(action==='create'){
   const username=String(body.username||'').trim().toLowerCase(),name=String(body.display_name||'').trim(),school=String(body.school_id||'');
   if(!/^[a-z][a-z0-9_]{2,29}$/.test(username)||name.length<2||name.length>100||!/^[0-9a-f-]{36}$/i.test(school))return reply({message:'Enter a valid name, unique username and school.'},400);
   const [existing,schools]=await Promise.all([get('/rest/v1/profiles?select=id&username=eq.'+encodeURIComponent(username)+'&limit=1'),get('/rest/v1/media_schools?select=id&kind=eq.school&active=eq.true&id=eq.'+encodeURIComponent(school))]);
   if(existing.length)return reply({message:'Username is already in use.'},409);
   if(!schools.length)return reply({message:'Select an active school.'},400);
   // Unique internal non-deliverable address, never an input or displayed credential.
   // Auth creation trigger uses trusted app_metadata and creates membership atomically.
   const email='arf-media-'+crypto.randomUUID()+'@media.arf.invalid';
   const res=await fetch(url+'/auth/v1/admin/users',{method:'POST',headers:privileged,body:JSON.stringify({email,password,email_confirm:true,user_metadata:{username,full_name:name},app_metadata:{arf_media_school_account:true,arf_media_created_by:actor.id,arf_media_school_id:school}}),signal:AbortSignal.timeout(12000)});
   if(!res.ok)return reply({message:'Account could not be created. Check username availability and server setup.'},409);
   const user=await res.json();
   const granted=await get('/rest/v1/media_school_accounts?select=user_id&user_id=eq.'+encodeURIComponent(user.id));
   if(!granted.length)return reply({message:'Provisioning migration missing. Contact administrator; do not distribute credentials.'},503);
   return reply({user_id:user.id,username},201);
  }
  if(['reset','revoke','restore'].includes(action)){
   const id=String(body.user_id||'');if(!/^[0-9a-f-]{36}$/i.test(id))return reply({message:'Invalid account.'},400);
   const [managed,members]=await Promise.all([get('/rest/v1/media_school_accounts?select=user_id&user_id=eq.'+encodeURIComponent(id)),get('/rest/v1/media_members?select=role,school_id,active&user_id=eq.'+encodeURIComponent(id))]);
   if(!managed.length||members[0]?.role!=='school_media_coordinator')return reply({message:'Only dedicated school accounts can be managed here.'},403);
   if(action==='restore'){
    const schools=await get('/rest/v1/media_schools?select=id&kind=eq.school&active=eq.true&id=eq.'+encodeURIComponent(members[0].school_id));
    if(!schools.length)return reply({message:'Assigned school is inactive.'},400);
   }
   // Revocation immediately disables RLS access; Auth ban blocks new logins.
   if(action==='revoke'){
    const patch=await fetch(url+'/rest/v1/media_members?user_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:privileged,body:JSON.stringify({active:false})});
    if(!patch.ok)throw Error('Membership update failed');
   }
   const change=action==='reset'?{password}:action==='revoke'?{ban_duration:'876000h'}:{ban_duration:'none'};
   const result=await fetch(url+'/auth/v1/admin/users/'+encodeURIComponent(id),{method:'PUT',headers:privileged,body:JSON.stringify(change),signal:AbortSignal.timeout(10000)});
   if(!result.ok)return reply({message:'Account update incomplete. Contact administrator.'},502);
   if(action==='restore'){
    const patch=await fetch(url+'/rest/v1/media_members?user_id=eq.'+encodeURIComponent(id),{method:'PATCH',headers:privileged,body:JSON.stringify({active:true})});
    if(!patch.ok)throw Error('Membership update failed');
   }
   const audit=await fetch(url+'/rest/v1/media_school_account_events',{method:'POST',headers:privileged,body:JSON.stringify({user_id:id,actor_id:actor.id,event:action==='reset'?'password_reset':action==='revoke'?'revoked':'restored'})});
   if(!audit.ok)return reply({message:'Account updated, but audit recording failed. Contact administrator.'},502);
   return reply({ok:true});
  }
  return reply({message:'Invalid action.'},400);
 }catch{return reply({message:'School account service unavailable. Contact administrator.'},503);}
});
