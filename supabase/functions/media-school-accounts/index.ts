// ARF Media Hub: centrally managed username/password school accounts.
// All admin credentials stay in the Supabase Edge Function environment.
// Uses the same Supabase Auth users and profiles as WorkFlow Planner.
// New school users do NOT receive Planner workspace membership.
const ALLOWED_ORIGINS=new Set(['https://arfteamplanner.vercel.app','http://localhost:3000']);
const originFor=(req:Request)=>{const value=req.headers.get('origin');return value&&ALLOWED_ORIGINS.has(value)?value:'https://arfteamplanner.vercel.app'};
const json=(value:unknown,status:number,origin:string)=>new Response(JSON.stringify(value),{status,headers:{
 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin',
 'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info',
 'Access-Control-Allow-Methods':'POST,OPTIONS'
}});
const envKeys=()=>{
 let secret=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',pub=Deno.env.get('SUPABASE_ANON_KEY')||'';
 try{const data=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}');if(data.default)secret=data.default;}catch{}
 try{const data=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}');if(data.default)pub=data.default;}catch{}
 return {root:(Deno.env.get('SUPABASE_URL')||'').replace(/\/$/,''),secret,pub};
};
const adminHeaders=(secret:string)=>{
 const h:Record<string,string>={'apikey':secret,'Content-Type':'application/json'};
 if(!secret.startsWith('sb_secret_'))h.Authorization='Bearer '+secret;
 return h;
};
const responseBody=async(r:Response)=>r.json().catch(()=>({}));
Deno.serve(async req=>{
 const origin=originFor(req),sent=req.headers.get('origin');
 if(sent&&!ALLOWED_ORIGINS.has(sent))return json({message:'Origin tidak diizinkan'},403,origin);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{
  'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Vary':'Origin'
 }});
 if(req.method!=='POST')return json({message:'Method not allowed'},405,origin);
 if(Number(req.headers.get('content-length')||0)>8192)return json({message:'Permintaan terlalu besar'},413,origin);
 const bearer=req.headers.get('authorization')||'';
 if(!/^Bearer \S+$/.test(bearer))return json({message:'Autentikasi dibutuhkan'},401,origin);
 const {root,secret,pub}=envKeys();
 if(!root||!secret||!pub)return json({message:'Server belum siap'},503,origin);
 const headers=adminHeaders(secret);
 try{
  const identity=await fetch(root+'/auth/v1/user',{headers:{'apikey':pub,'Authorization':bearer},signal:AbortSignal.timeout(7000)});
  if(!identity.ok)return json({message:'Sesi tidak valid'},401,origin);
  const actor=(await responseBody(identity)).id;
  if(typeof actor!=='string')return json({message:'Sesi tidak valid'},401,origin);
  const memberReq=await fetch(root+'/rest/v1/media_members?select=role,active,assigned_from,assigned_until&user_id=eq.'+encodeURIComponent(actor)+'&limit=1',{headers,signal:AbortSignal.timeout(7000)});
  if(!memberReq.ok)return json({message:'Izin Media Hub gagal diperiksa'},503,origin);
  const members=await responseBody(memberReq),member=members?.[0];
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Pontianak',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  const now=parts.year+'-'+parts.month+'-'+parts.day;
  if(!member?.active||!['ARF_MANAGER','ARF_MEDIA_COORDINATOR'].includes(member.role)||member.assigned_from>now||(member.assigned_until&&member.assigned_until<now))
    return json({message:'Koordinator ARF atau Manager Media Hub diperlukan'},403,origin);
  let data;
  try{data=await req.json();}catch{return json({message:'Payload tidak valid'},400,origin);}
  const password=data.password;
  if(typeof password!=='string'||password.length<12||password.length>128)return json({message:'Password harus 12–128 karakter'},400,origin);
  const api=(path:string,options:RequestInit={})=>fetch(root+path,{...options,headers:{...headers,...((options.headers||{}) as Record<string,string>)},signal:AbortSignal.timeout(10000)});
  if(data.action==='reset'){
   if(!/^[0-9a-f-]{36}$/i.test(String(data.user_id||'')))return json({message:'User tidak valid'},400,origin);
   const target=await api('/rest/v1/media_members?select=role&user_id=eq.'+encodeURIComponent(data.user_id)+'&limit=1');
   if(!target.ok)return json({message:'Tidak dapat memeriksa User'},503,origin);
   const subject=(await responseBody(target))?.[0];
   if(subject?.role!=='SCHOOL_MEDIA_COORDINATOR')return json({message:'Hanya akun sekolah yang dapat direset'},403,origin);
   const result=await api('/auth/v1/admin/users/'+encodeURIComponent(data.user_id),{method:'PUT',body:JSON.stringify({password})});
   if(!result.ok)return json({message:'Gagal memperbarui password'},400,origin);
   await api('/rest/v1/media_audit_logs',{method:'POST',body:JSON.stringify({actor_id:actor,action:'reset_school_password',entity:'media_members',entity_id:data.user_id,detail:{}})});
   return json({ok:true},200,origin);
  }
  if(data.action!=='create')return json({message:'Aksi tidak dikenal'},400,origin);
  const username=String(data.username||'').trim().toLowerCase(),fullName=String(data.full_name||'').trim(),schoolId=String(data.school_id||'');
  if(!/^[a-z][a-z0-9_]{2,29}$/.test(username)||fullName.length<2||fullName.length>100||
     !/^[0-9a-f-]{36}$/i.test(schoolId))return json({message:'Username, nama, atau sekolah tidak valid'},400,origin);
  const school=await api('/rest/v1/media_schools?select=id&active=eq.true&id=eq.'+encodeURIComponent(schoolId)+'&limit=1');
  if(!school.ok||(await responseBody(school))?.length!==1)return json({message:'Sekolah tidak aktif atau tidak ditemukan'},400,origin);
  const usernameCheck=await api('/rest/v1/profiles?select=id&username=eq.'+encodeURIComponent(username)+'&limit=1');
  if(!usernameCheck.ok)return json({message:'Username belum dapat diverifikasi'},503,origin);
  if((await responseBody(usernameCheck))?.length)return json({message:'Username sudah dipakai'},409,origin);
  // Synthetic internal address only for Supabase Auth. Users sign in with username.
  const internalEmail=username+'@arf-media.internal',creation=await api('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({
   email:internalEmail,password,email_confirm:true,user_metadata:{full_name:fullName,username}
  })});
  const created=await responseBody(creation);
  if(!creation.ok||typeof created.id!=='string')return json({message:'Pembuatan akun gagal. Gunakan username lain atau periksa pengaturan Auth.'},400,origin);
  try{
   const profile=await api('/rest/v1/profiles?on_conflict=id',{method:'POST',
    headers:{Prefer:'resolution=merge-duplicates,return=representation'},
    body:JSON.stringify({id:created.id,username,full_name:fullName,email:internalEmail,job_title:'Koordinator Media Sosial Sekolah'})});
   if(!profile.ok)throw Error('profile');
   const assign=await api('/rest/v1/media_members',{method:'POST',
    body:JSON.stringify({user_id:created.id,role:'SCHOOL_MEDIA_COORDINATOR',school_id:schoolId,active:true})});
   if(!assign.ok)throw Error('membership');
  }catch{
   // Compensating rollback; avoid leaving orphan accounts without media permissions.
   await api('/auth/v1/admin/users/'+encodeURIComponent(created.id),{method:'DELETE'}).catch(()=>{});
   return json({message:'Akun tidak dapat diselesaikan. Tidak ada akses Planner yang diberikan.'},500,origin);
  }
  await api('/rest/v1/media_audit_logs',{method:'POST',body:JSON.stringify({
    actor_id:actor,action:'create_school_account',entity:'media_members',entity_id:created.id,detail:{school_id:schoolId,username}
  })}).catch(()=>{});
  return json({ok:true,username,user_id:created.id},201,origin);
 }catch(e){console.error('Media account operation failed:',e instanceof Error?e.message:'unknown');return json({message:'Server akun sekolah tidak tersedia'},500,origin);}
});
