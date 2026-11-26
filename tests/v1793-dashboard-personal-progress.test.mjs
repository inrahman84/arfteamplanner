import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectProgressForUser} from '../public/core.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const projects=[
 {id:'p1',name:'Literasi',color:'#073b2d'},
 {id:'p2',name:'Guru & Kepala Sekolah',color:'#009b4c'},
 {id:'p3',name:'Sekolah Regional',color:'#3f6276'},
 {id:'p4',name:'Project Belum Dikerjakan',color:'#c89b55'}
];
const tasks=[
 {id:'t1',assigned_to:'u1',created_by:'u2',project_ids:['p1','p2'],status:'Completed'},
 {id:'t2',assigned_to:'u1',created_by:'u1',project_ids:['p1'],status:'In Progress'},
 {id:'t3',assigned_to:'u2',created_by:'u1',project_ids:['p1','p3'],status:'Completed'},
 {id:'t4',assigned_to:'u2',created_by:'u2',project_ids:['p3'],status:'In Progress'},
 {id:'t5',assigned_to:'u1',created_by:'u1',project_ids:[],status:'Completed'}
];

test('Project Performance counts only assigned Work Items for signed-in user',()=>{
 const result=projectProgressForUser(tasks,projects,'u1');
 assert.deepEqual(result.projects.map(p=>[p.id,p.total,p.completed,p.percent]),[
  ['p1',2,1,50],['p2',1,1,100]
 ]);
 assert.equal(result.total,2,'Multi-Project work items count once, and unassigned-to-project work items are excluded from Project achievement');
 assert.equal(result.completed,1);
 assert.equal(result.percent,50);
 assert.ok(!result.projects.some(p=>p.id==='p3'||p.id==='p4'),'Projects only assigned to other people or without assigned work are not shown');
});

test('Created-by without assigned-to does not make a Project personal',()=>{
 const result=projectProgressForUser(tasks,projects,'u2');
 assert.deepEqual(result.projects.map(p=>p.id),['p1','p3']);
 assert.equal(result.total,2);
 assert.equal(result.completed,1);
 assert.equal(projectProgressForUser(tasks,projects,undefined).total,0);
 assert.deepEqual(projectProgressForUser(tasks,projects,null).projects,[]);
});

test('Dashboard Project panels use selected Dashboard User without depending on hidden generic filters',()=>{
 const start=app.indexOf('function dashboardProgressUserId(){');
 const end=app.indexOf('function dashboard(){',start);
 assert.ok(start>=0&&end>start);
 const panel=app.slice(start,end);
 assert.match(panel,/S.dashboardUser\?S.dashboardUser:store.user\?\.id/);
 assert.match(panel,/projectProgressForUser\(S.tasks,S.projects,userId\)/);
 assert.doesNotMatch(panel,/selectedProjectIds\(/);
 assert.doesNotMatch(panel,/taskFilter\(/);
 assert.match(panel,/userName/);
 const dashboard=app.slice(end,app.indexOf('function taskCard(',end));
 assert.match(dashboard,/projectProgressPanels\(\)/);
 assert.match(dashboard,/scopeTasks\(S.tasks,'dashboard'\)/);
 assert.doesNotMatch(dashboard,/commonToolbar\(\)/);
 assert.doesNotMatch(dashboard,/projectCheckboxFilter\(/);
 assert.match(dashboard,/userTeamFilter\('dashboard'\)/);
 assert.match(app,/if\(target\.dataset\.scope\)\{S\[target\.dataset\.scope\]=target\.value/);
});

test('Shared six-filter toolbar is kept on Board, Grid, Gantt, Calendar',()=>{
 for(const name of ['board','grid','gantt','calendar']){
  const from=app.indexOf('function '+name+'(){');
  const next=app.indexOf('\nfunction ',from+1);
  assert.ok(from>=0,name+' available');
  assert.match(app.slice(from,next<0?undefined:next),/commonToolbar\(\)/,name+' keeps its existing filters');
 }
});
