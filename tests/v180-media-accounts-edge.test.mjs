import test from 'node:test';
import assert from 'node:assert/strict';
import {handleRequest} from '../supabase/functions/media-school-accounts/handler.mjs';

const actor='10000000-0000-4000-8000-000000000002';
const school='30000000-0000-4000-8000-000000000001';
const created='10000000-0000-4000-8000-000000000055';
const base={
 SUPABASE_URL:'https://supabase.fixture.invalid',
 SUPABASE_SERVICE_ROLE_KEY:'service_test_key',
 SUPABASE_ANON_KEY:'public_test_key'
};
const makeRequest=(payload,origin='https://arfteamplanner.vercel.app')=>new Request('https://arfteamplanner.vercel.app/functions/v1/media-school-accounts',{
 method:'POST',headers:{'origin':origin,'Content-Type':'application/json','Authorization':'Bearer signed-user-token'},
 body:JSON.stringify(payload)
});
const run=async(payload,{failCleanup=false,who='ARF_MEDIA_COORDINATOR',failAudit=false}={})=>{
 const calls=[];
 const fetchImpl=async(url,opt={})=>{
  const u=new URL(url),path=u.pathname,method=opt.method||'GET';
  const entry={method,path,query:u.search,body:opt.body?JSON.parse(opt.body):null};
  calls.push(entry);
  const reply=(body,status=200)=>Response.json(body,{status});
  if(path==='/auth/v1/user')return reply({id:actor});
  if(path==='/rest/v1/media_members'&&method==='GET'){
   if(u.searchParams.get('select')==='role')return reply([{role:'SCHOOL_MEDIA_COORDINATOR'}]);
   return reply([{role:who,active:true,assigned_from:'2026-01-01',assigned_until:null}]);
  }
  if(path==='/rest/v1/media_schools')return reply([{id:school}]);
  if(path==='/rest/v1/profiles'&&method==='GET')return reply([]);
  if(path==='/auth/v1/admin/users'&&method==='POST')return reply({id:created},201);
  if(path==='/auth/v1/admin/users/'+created&&method==='DELETE')return reply({},200);
  if(path==='/auth/v1/admin/users/'+created&&method==='PUT')return reply({id:created},200);
  if(path==='/rest/v1/profiles'&&method==='POST')return reply([{id:created}],201);
  if(path==='/rest/v1/arf_school_members'&&method==='DELETE')return failCleanup?reply({message:'Blocked'},403):reply([],200);
  if(path==='/rest/v1/arf_school_members'&&method==='GET')return reply([]);
  if(path==='/rest/v1/media_members'&&method==='POST')return reply([{user_id:created}],201);
  if(path==='/rest/v1/media_audit_logs'&&method==='POST')return failAudit?reply({},500):reply({},201);
  throw Error('Unexpected backend request '+method+' '+path);
 };
 const response=await handleRequest(makeRequest(payload),{
  envGet:k=>base[k]||'',fetchImpl,nowDate:new Date('2026-11-26T10:00:00Z')});
 return {status:response.status,body:await response.json(),calls};
};
test('Creates Media-only school user, revokes One School auto-membership and writes audit',async()=>{
 const output=await run({action:'create',school_id:school,username:'sosmed_school_a',full_name:'Koordinator Sekolah A',password:'A-strong-password-123'});
 assert.equal(output.status,201);
 assert.equal(output.body.ok,true);
 const call=(method,path)=>output.calls.findIndex(c=>c.method===method&&c.path===path);
 assert.ok(call('POST','/auth/v1/admin/users')>=0,'Auth account created');
 assert.ok(call('DELETE','/rest/v1/arf_school_members')>call('POST','/auth/v1/admin/users'),'One School membership revoked');
 assert.ok(call('GET','/rest/v1/arf_school_members')>call('DELETE','/rest/v1/arf_school_members'),'Isolation verified');
 assert.ok(call('POST','/rest/v1/media_members')>call('GET','/rest/v1/arf_school_members'),'Media role assigned after cleanup');
 assert.ok(call('POST','/rest/v1/media_audit_logs')>call('POST','/rest/v1/media_members'),'Create action audited');
 assert.ok(output.calls.every(c=>!c.path.includes('workspace_members')),'No Planner membership assigned');
 const data=output.calls.find(c=>c.method==='POST'&&c.path==='/rest/v1/media_members').body;
 assert.equal(data.planner_enabled,false);
 assert.equal(data.role,'SCHOOL_MEDIA_COORDINATOR');
 assert.ok(!JSON.stringify(output.body).includes('A-strong-password-123'));
});
test('Fails closed and deletes newly created Auth account if One School isolation cannot be verified',async()=>{
 const result=await run({action:'create',school_id:school,username:'sosmed_school_a',full_name:'Koordinator Sekolah A',password:'A-strong-password-123'},{failCleanup:true});
 assert.equal(result.status,500);
 assert.equal(result.calls.some(c=>c.method==='DELETE'&&c.path==='/auth/v1/admin/users/'+created),true,'Auth account rolled back');
 assert.equal(result.calls.some(c=>c.method==='POST'&&c.path==='/rest/v1/media_members'),false);
});
test('Cannot create a school user without Media coordinator/Manager role',async()=>{
 const result=await run({action:'create',school_id:school,username:'sosmed_school_a',full_name:'Koordinator Sekolah A',password:'A-strong-password-123'},{who:'SCHOOL_MEDIA_COORDINATOR'});
 assert.equal(result.status,403);
 assert.equal(result.calls.some(c=>c.path==='/auth/v1/admin/users'&&c.method==='POST'),false);
});
test('Rejects weak credential or invalid school username before creating Auth user',async()=>{
 const result=await run({action:'create',school_id:school,username:'not valid',full_name:'Koordinator A',password:'123456789012'});
 assert.equal(result.status,400);
 assert.equal(result.calls.some(c=>c.path==='/auth/v1/admin/users'),false);
});
test('Password reset for school coordinator is authenticated and audited',async()=>{
 const result=await run({action:'reset',user_id:created,password:'A-new-strong-pass-123'});
 assert.equal(result.status,200);
 assert.ok(result.calls.some(c=>c.method==='PUT'&&c.path==='/auth/v1/admin/users/'+created));
 assert.ok(result.calls.some(c=>c.path==='/rest/v1/media_audit_logs'));
 assert.ok(!JSON.stringify(result.body).includes('A-new-strong-pass-123'));
});
test('Create operation fails closed when required audit cannot be written',async()=>{
 const result=await run({action:'create',school_id:school,username:'sosmed_school_a',full_name:'Koordinator A',password:'A-strong-password-123'},{failAudit:true});
 assert.equal(result.status,500);
 assert.ok(result.calls.some(c=>c.method==='DELETE'&&c.path==='/auth/v1/admin/users/'+created));
});
test('Cross-origin requests are rejected before any privileged network request',async()=>{
 let invoked=false;
 const response=await handleRequest(makeRequest({action:'create'},'https://unknown.example'),{
  envGet:k=>base[k]||'',fetchImpl:async()=>{invoked=true;throw Error('unexpected')},
  nowDate:new Date('2026-11-26T10:00:00Z')
 });
 assert.equal(response.status,403);assert.equal(invoked,false);
});
