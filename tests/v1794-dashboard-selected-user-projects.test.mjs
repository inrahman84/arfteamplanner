import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectProgressForUser,safe} from '../public/core.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const from=app.indexOf('function dashboardProgressUserId(){');
const to=app.indexOf('function dashboard(){',from);
assert.ok(from>=0&&to>from);
const snippet=app.slice(from,to);
const projects=[{id:'p1',name:'Literasi',color:'#073b2d'}, {id:'p2',name:'Numerasi',color:'#009b4c'}, {id:'p3',name:'Sarana',color:'#3f6276'}];
const tasks=[
 {id:'t1',assigned_to:'u1',created_by:'u2',project_ids:['p1','p2'],status:'Completed'},
 {id:'t2',assigned_to:'u1',project_ids:['p1'],status:'In Progress'},
 {id:'t3',assigned_to:'u2',created_by:'u1',project_ids:['p3'],status:'Completed'},
 {id:'t4',assigned_to:'u2',project_ids:['p3'],status:'Not Started'}
];
const S={dashboardUser:'',people:[{id:'u1',full_name:'Manager ARF'},{id:'u2',full_name:'Guru Regional'}],tasks,projects};
const store={user:{id:'u1'}};
let manager=true;
const {dashboardProgressUserId,projectProgressPanels}=new Function('S','store','managerScope','projectProgressForUser','safe',snippet+';return {dashboardProgressUserId,projectProgressPanels}')(
 S,store,()=>manager,projectProgressForUser,safe);

test('Dashboard Project Performance responds to selected User filter with no other users projects',()=>{
 assert.equal(dashboardProgressUserId(),'u1');
 let html=projectProgressPanels();
 assert.match(html,/Manager ARF/);
 assert.match(html,/Literasi/);
 assert.match(html,/Numerasi/);
 assert.doesNotMatch(html,/Sarana/);
 assert.match(html,/2 Project/);
 assert.match(html,/1<\/b> Completed/);
 S.dashboardUser='u2';
 assert.equal(dashboardProgressUserId(),'u2');
 html=projectProgressPanels();
 assert.match(html,/Guru Regional/);
 assert.match(html,/Sarana/);
 assert.doesNotMatch(html,/Literasi/);
 assert.doesNotMatch(html,/Numerasi/);
 assert.match(html,/1 Project/);
 assert.match(html,/1<\/b> Completed/);
 assert.match(html,/2<\/b> Unique Work Items/);
});

test('Switching back to All Users restores signed-in user portfolio, not all users',()=>{
 S.dashboardUser='';
 assert.equal(dashboardProgressUserId(),'u1');
 const html=projectProgressPanels();
 assert.match(html,/Manager ARF/);
 assert.match(html,/Numerasi/);
 assert.doesNotMatch(html,/Sarana/);
});

test('Non-manager cannot select someone else as Project Performance target',()=>{
 manager=false;S.dashboardUser='u2';
 assert.equal(dashboardProgressUserId(),'u1');
 const html=projectProgressPanels();
 assert.match(html,/Manager ARF/);
 assert.doesNotMatch(html,/Sarana/);
 manager=true;S.dashboardUser='';
});

test('Existing User dropdown and workload click trigger Dashboard rerender',()=>{
 assert.match(app,/data-scope="\$\{prefix\}User"/);
 assert.match(app,/if\(target.dataset.scope\)\{S\[target.dataset.scope\]=target.value/);
 assert.match(app,/case 'dashboard-user':[^\n]*S.dashboardUser=node.dataset.id;renderContent\(\)/);
});
