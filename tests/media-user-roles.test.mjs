import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaDemoStore,resetMediaDemo,demoMembership,mediaDemoRoles} from '../public/media-demo.js';
import {plannerUserDirectory} from '../public/media-hub.js';

test('existing Planner users gain, change, revoke and restore independent Media Hub access',async()=>{
 resetMediaDemo();
 const directory=[{id:'u1',name:'Alex Morgan',username:'alex_morgan',planner_roles:[{workspace:'My Workspace',role:'super_admin'}]},{id:'u2',name:'Sarah Wijaya',username:'sarah_wijaya',planner_roles:[{workspace:'My Workspace',role:'manager'}]}];
 const original=structuredClone(directory);
 const manager=createMediaDemoStore('demo-manager',directory);
 assert.deepEqual(await plannerUserDirectory(manager),original);
 const grant={user_id:'u2',display_name:'Sarah Wijaya',role:'school_media_coordinator',school_id:'school-a',active:true};
 await manager.rest('media_members','POST','',grant);
 assert.equal(demoMembership('u2').school_id,'school-a');
 assert.ok(mediaDemoRoles().some(m=>m.id==='u2'));
 const school=createMediaDemoStore('u2',directory);
 assert.ok((await school.rest('media_contents')).every(c=>c.school_id==='school-a'));
 await assert.rejects(school.rest('media_members','POST','',{...grant,user_id:'u1'}));
 await assert.rejects(plannerUserDirectory(school));
 await assert.rejects(manager.rest('media_members','POST','',{...grant,user_id:'not-in-planner'}));
 await assert.rejects(manager.rest('media_members','POST','',{...grant,user_id:'u1',role:'arf_manager',school_id:null}));
 await assert.rejects(manager.rest('media_members','PATCH','?user_id=eq.u2',{user_id:'u1'}));
 await manager.rest('media_members','PATCH','?user_id=eq.u2',{role:'arf_media_coordinator',school_id:null});
 assert.equal(demoMembership('u2').role,'arf_media_coordinator');
 await manager.rest('media_members','PATCH','?user_id=eq.u2',{active:false});
 assert.equal(demoMembership('u2'),null);
 assert.equal((await school.rest('media_contents')).length,0);
 assert.ok(!mediaDemoRoles().some(m=>m.id==='u2'));
 await manager.rest('media_members','PATCH','?user_id=eq.u2',{active:true});
 assert.equal(demoMembership('u2').active,true);
 assert.deepEqual(directory,original);
 assert.deepEqual(await plannerUserDirectory(manager),original);
 await assert.rejects(manager.rest('media_members','PATCH','?user_id=eq.demo-manager',{active:false}));
});

test('directory includes only managed Planner workspaces, merges duplicate users and never requests emails',async()=>{
 const requests=[];
 const store={user:{id:'actor'},async listWorkspaces(){return [{id:'a',name:'ARF'},{id:'b',name:'Other'},{id:'c',name:'PMO'}]},async rest(t,m,q){
 requests.push([t,q]);
 if(t==='workspace_members'&&q.includes('select=role&'))return [{role:q.includes('workspace_id=eq.b')?'officer':'manager'}];
 if(t==='workspace_members')return [{user_id:'u1',role:'officer',display_name:'Person'}];
 if(t==='profiles')return [{id:'u1',full_name:'Person',username:'person'}];
 throw Error('Unexpected query');
 }};
 const rows=await plannerUserDirectory(store);
 assert.equal(rows.length,1);
 assert.deepEqual(rows[0].planner_roles,[{workspace:'ARF',role:'officer'},{workspace:'PMO',role:'officer'}]);
 assert.equal(requests.filter(([t,q])=>t==='workspace_members'&&q.includes('workspace_id=eq.b')).length,1);
 assert.ok(requests.every(([t,q])=>!q.includes('email')));
});
