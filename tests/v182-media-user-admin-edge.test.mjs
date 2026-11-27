import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../supabase/functions/media-school-accounts/handler.mjs';

const ACTOR='10000000-0000-4000-8000-000000000002';
const TARGET='10000000-0000-4000-8000-000000000077';
const base={SUPABASE_URL:'https://supabase.fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'service-role-fixture',SUPABASE_ANON_KEY:'anon-fixture'};
const mkRequest=body=>new Request('https://arfteamplanner.vercel.app/functions/v1/media-school-accounts',{method:'POST',
 headers:{Authorization:'Bearer valid-session-token','Content-Type':'application/json','Origin':'https://arfteamplanner.vercel.app'},body:JSON.stringify(body)});
const run=async(payload,{role='ARF_MEDIA_COORDINATOR',targetRole='SCHOOL_MEDIA_COORDINATOR',conflict=false,profileFailure=false}={})=>{
 const calls=[];
 const fetchImpl=async(url,init={})=>{
  const u=new URL(url),method=init.method||'GET',path=u.pathname;
  const body=init.body?JSON.parse(init.body):null;
  calls.push({path,method,body,url:u.href});
  const reply=(v,status=200)=>Response.json(v,{status});
  if(path==='/auth/v1/user')return reply({id:ACTOR});
  if(path==='/rest/v1/media_members'){
   if(u.searchParams.get('select')==='role')return reply([{role:targetRole}]);
   return reply([{role,active:true,assigned_from:'2026-01-01',assigned_until:null}]);
  }
  if(path==='/rest/v1/profiles'){
   if(method==='GET')return reply(conflict?[{id:'another-user'}]:[]);
   if(method==='PATCH')return profileFailure?reply({message:'Profile blocked'},403):reply([{id:TARGET}]);
  }
  if(path==='/auth/v1/admin/users/'+TARGET){
   if(method==='GET')return reply({user:{id:TARGET,user_metadata:{department:'School',username:'old_user',full_name:'Old User'}}});
   if(method==='PUT')return reply({id:TARGET});
  }
  if(path==='/rest/v1/media_audit_logs'&&method==='POST')return reply([],201);
  throw Error('Unmocked request: '+method+' '+path);
 };
 const response=await handleRequest(mkRequest(payload),{fetchImpl,envGet:k=>base[k]||'',nowDate:new Date('2026-11-27T03:00:00Z')});
 return {status:response.status,result:await response.json(),calls};
};
test('Coordinator ARF may update existing Media username and name; preserve Auth metadata and audit',async()=>{
 const x=await run({action:'update',user_id:TARGET,username:'new_username',full_name:'Nama Koordinator Baru'});
 assert.equal(x.status,200);
 assert.equal(x.result.username,'new_username');
 const meta=x.calls.find(c=>c.path==='/auth/v1/admin/users/'+TARGET&&c.method==='PUT');
 assert.equal(meta.body.user_metadata.department,'School');
 assert.equal(meta.body.user_metadata.username,'new_username');
 assert.equal(meta.body.user_metadata.full_name,'Nama Koordinator Baru');
 const profile=x.calls.find(c=>c.path==='/rest/v1/profiles'&&c.method==='PATCH');
 assert.deepEqual(profile.body,{username:'new_username',full_name:'Nama Koordinator Baru'});
 assert.ok(x.calls.some(c=>c.path==='/rest/v1/media_audit_logs'&&c.body.action==='update_media_user_identity'));
 assert.ok(x.calls.every(c=>!c.body?.password));
});
test('Cannot overwrite an existing username',async()=>{
 const x=await run({action:'update',user_id:TARGET,username:'existing_login',full_name:'User Name'},{conflict:true});
 assert.equal(x.status,409);
 assert.ok(!x.calls.some(c=>c.method==='PUT'||c.method==='PATCH'));
});
test('Media school coordinator cannot edit other users',async()=>{
 const x=await run({action:'update',user_id:TARGET,username:'new_username',full_name:'New User'},{role:'SCHOOL_MEDIA_COORDINATOR'});
 assert.equal(x.status,403);
 assert.ok(!x.calls.some(c=>c.path.includes('/admin/users')));
});
test('User identity metadata is compensated on failure to update Planner profile',async()=>{
 const x=await run({action:'update',user_id:TARGET,username:'new_username',full_name:'New User'},{profileFailure:true});
 assert.equal(x.status,409);
 const puts=x.calls.filter(c=>c.path==='/auth/v1/admin/users/'+TARGET&&c.method==='PUT');
 assert.equal(puts.length,2);
 assert.equal(puts[1].body.user_metadata.username,'old_user');
});
test('Coordinator ARF can reset school/ARF coordinator, never an ARF Manager password',async()=>{
 const pass='Secure-New-Password-123';
 const ok=await run({action:'reset',user_id:TARGET,password:pass},{targetRole:'ARF_MEDIA_COORDINATOR'});
 assert.equal(ok.status,200);
 assert.ok(ok.calls.some(c=>c.method==='PUT'&&c.body.password===pass));
 const blocked=await run({action:'reset',user_id:TARGET,password:pass},{targetRole:'ARF_MANAGER'});
 assert.equal(blocked.status,403);
 assert.ok(!blocked.calls.some(c=>c.method==='PUT'));
});
test('Manager has the same name/username management route',async()=>{
 const x=await run({action:'update',user_id:TARGET,username:'username_arf',full_name:'ARF User'},{role:'ARF_MANAGER'});
 assert.equal(x.status,200);
});
