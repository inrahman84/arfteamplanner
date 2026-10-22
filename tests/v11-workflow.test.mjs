import test from 'node:test';
import assert from 'node:assert/strict';
import {metrics,STATUSES,validAttachment,ROLES} from '../public/core.js';

test('V1.1 status, role list, attachment validation and summary',()=>{
 assert.deepEqual(STATUSES,['Not Started','In Progress','On Hold','Completed']);
 assert.deepEqual(ROLES.map(x=>x[1]),['Super Admin','Manager','Asisten Manager','Specialist','Admin','Officer']);
 assert.equal(validAttachment('https://example.com/file?id=2'),true);
 assert.equal(validAttachment('javascript:alert(1)'),false);
 assert.equal(validAttachment('http://example.com'),false);
 assert.equal(metrics([{status:'On Hold'},{status:'In Progress',completion_requested_at:'2026-10-01'}]).onHold,1);
 assert.equal(metrics([{status:'On Hold'},{status:'In Progress',completion_requested_at:'2026-10-01'}]).pending,1);
});

test('Demo: non-manager submits completion; manager reviews; keep old tasks',async()=>{
 const db=new Map();
 globalThis.window={__WORKFLOW_CONFIG__:{supabaseUrl:'',supabaseAnonKey:''}};
 globalThis.location={search:''};
 globalThis.localStorage={getItem:k=>db.get(k)||null,setItem:(k,v)=>db.set(k,v),removeItem:k=>db.delete(k)};
 const {store}=await import('../public/store.js');
 await store.initialize();
 const oldCount=store.demo.tasks.length;
 assert.equal(store.demo.members.find(x=>x.user_id==='u1').role,'super_admin');
 const assigned=store.demo.tasks.find(t=>t.assigned_to==='u3'&&t.status==='In Progress');
 const unassigned=store.demo.tasks.find(t=>t.assigned_to==='u4'&&t.created_by==='u1'&&t.status==='In Progress');
 store.user={id:'u3'};
 await assert.rejects(()=>store.saveTask({...assigned,status:'Completed'}),/Manager/);
 await assert.rejects(()=>store.requestCompletion(unassigned),/owner or assignee/);
 await store.requestCompletion(assigned);
 assert.equal(assigned.status,'In Progress');
 assert.equal(assigned.completion_requested_by,'u3');
 await assert.rejects(()=>store.reviewCompletion(assigned,true),/Manager/);
 store.user={id:'u2'};
 await store.reviewCompletion(assigned,true);
 assert.equal(assigned.status,'Completed');
 assert.equal(assigned.completion_approved_by,'u2');
 assert.equal(assigned.completion_requested_at,null);
 assert.equal(store.demo.tasks.length,oldCount);
 store.user={id:'u3'};
 const another=store.demo.tasks.find(t=>t.assigned_to==='u3'&&t.status==='In Progress'&&!t.completion_requested_at);
 await store.requestCompletion(another);
 store.user={id:'u2'};
 await store.reviewCompletion(another,false,'Bukti belum lengkap');
 assert.equal(another.status,'In Progress');
 assert.equal(another.completion_feedback,'Bukti belum lengkap');
});

test('Migration and endpoint files exist',async()=>{
 const {readFile}=await import('node:fs/promises');
 const sql=await readFile(new URL('../sql/002_upgrade_v1_1.sql',import.meta.url),'utf8');
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.touch_task/);
 assert.match(sql,/Only Manager can update a completed task/);
 assert.match(sql,/Only Super Admin can manage Super Admin roles/);
 assert.match(sql,/ADD COLUMN IF NOT EXISTS team_name/);
 const route=await readFile(new URL('../api/username-login.js',import.meta.url),'utf8');
 assert.match(route,/SUPABASE_SERVICE_ROLE_KEY/);
});

test('Username login API resolves email server-side and never exposes mapping on error',async()=>{
 const handler=(await import('../api/username-login.js')).default;
 const before={url:process.env.SUPABASE_URL,anon:process.env.SUPABASE_ANON_KEY,secret:process.env.SUPABASE_SERVICE_ROLE_KEY};
 process.env.SUPABASE_URL='https://test-project.supabase.co';process.env.SUPABASE_ANON_KEY='public-test';process.env.SUPABASE_SERVICE_ROLE_KEY='secret-test';
 const oldFetch=globalThis.fetch;
 let lookup=0, grant=0;
 globalThis.fetch=async (url,opts)=>{
  if(String(url).includes('/rest/v1/profiles')){lookup++;assert.equal(opts.headers.apikey,'secret-test');return {ok:true,json:async()=>[{email:'secret@example.org'}]};}
  if(String(url).includes('/auth/v1/token')){grant++;assert.match(opts.body,/secret@example.org/);return {ok:true,json:async()=>({access_token:'jwt-test',refresh_token:'r',expires_in:3600,user:{id:'u77'}})};}
  throw Error('Unexpected API request');
 };
 const response=()=>({code:200,headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.code=code;return this;},json(payload){this.payload=payload;return this;}});
 try{
  const res=response();await handler({method:'POST',body:{username:'demo_user',password:'abc123'}},res);
  assert.equal(res.code,200);assert.equal(res.payload.access_token,'jwt-test');assert.ok(!JSON.stringify(res.payload).includes('secret@example.org'));assert.equal(lookup,1);assert.equal(grant,1);
  const malformed=response();await handler({method:'POST',body:'{'},malformed);assert.equal(malformed.code,400);
  const bad=response();await handler({method:'POST',body:{username:'admin@example.com',password:'abc123'}},bad);assert.equal(bad.code,400);
 }finally{globalThis.fetch=oldFetch;for(const [key,val] of [['SUPABASE_URL',before.url],['SUPABASE_ANON_KEY',before.anon],['SUPABASE_SERVICE_ROLE_KEY',before.secret]]){if(val===undefined)delete process.env[key];else process.env[key]=val;}}
});


test('Build accepts existing Vercel Supabase integration variable names, never embeds secret',async()=>{
 const {spawnSync}=await import('node:child_process');
 const {readFile}=await import('node:fs/promises');
 const env={...process.env, SUPABASE_URL:'',SUPABASE_ANON_KEY:'', NEXT_PUBLIC_SUPABASE_URL:'https://test-project.supabase.co', SUPABASE_PUBLISHABLE_KEY:'sb_publishable_publictest', SUPABASE_SECRET_KEY:'sb_secret_private', SUPABASE_SERVICE_ROLE_KEY:''};
 const result=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:new URL('..',import.meta.url).pathname,env,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const config=await readFile(new URL('../dist/config.js',import.meta.url),'utf8');
 assert.match(config,/sb_publishable_publictest/);
 assert.doesNotMatch(config,/sb_secret_private/);
 const sql=await readFile(new URL('../sql/000_setup_database_baru.sql',import.meta.url),'utf8');
 assert.match(sql,/create table if not exists public.tasks/);
 assert.match(sql,/ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS attachment_url/);
});

test('Username API works using existing Vercel secret/publishable keys',async()=>{
 const handler=(await import('../api/username-login.js')).default;
 const envKeys=['SUPABASE_URL','NEXT_PUBLIC_SUPABASE_URL','SUPABASE_ANON_KEY','SUPABASE_PUBLISHABLE_KEY','SUPABASE_SERVICE_ROLE_KEY','SUPABASE_SECRET_KEY'];
 const originals=Object.fromEntries(envKeys.map(k=>[k,process.env[k]]));
 process.env.SUPABASE_URL='';process.env.SUPABASE_ANON_KEY='';process.env.SUPABASE_SERVICE_ROLE_KEY='';
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://test-project.supabase.co';process.env.SUPABASE_PUBLISHABLE_KEY='sb_publishable_publictest';process.env.SUPABASE_SECRET_KEY='sb_secret_test';
 const oldFetch=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,opts)=>{calls++;if(String(url).includes('/rest/v1/profiles')){assert.equal(opts.headers.apikey,'sb_secret_test');assert.equal(opts.headers.Authorization,undefined);return {ok:true,json:async()=>[{email:'user@example.com'}]};}if(String(url).includes('/auth/v1/token')){assert.equal(opts.headers.apikey,'sb_publishable_publictest');return {ok:true,json:async()=>({access_token:'jwt'})};}throw Error('Unexpected request')};
 const res={status(c){this.code=c;return this},setHeader(){},json(x){this.body=x;return this}};
 try{await handler({method:'POST',body:{username:'testuser',password:'password'}},res);assert.equal(res.code,200);assert.equal(calls,2);}finally{globalThis.fetch=oldFetch;for(const k of envKeys){if(originals[k]===undefined)delete process.env[k];else process.env[k]=originals[k];}}
});
