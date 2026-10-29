import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const store=readFileSync(new URL('../public/store.js',import.meta.url),'utf8');
const sql=readFileSync(new URL('../sql/018_safe_workspace_deletion.sql',import.meta.url),'utf8');

test('Filter controls appear in requested order in every Work Item view',()=>{
 const start=app.indexOf('function commonToolbar(){');
 const end=app.indexOf('function empty(',start);
 assert.ok(start>0&&end>start);
 const controls=app.slice(start,end);
 const order=['assigned_by','assignee','project','category','priority','status'];
 const positions=order.map(key=>controls.indexOf('data-filter="'+key+'"'));
 assert.ok(positions.every(x=>x>=0),'All six filters must be present');
 assert.deepEqual(positions,positions.slice().sort((a,b)=>a-b),'Filter order must be Assigned By, Assigned To, Project, Category, Priority, Status');
 for(const name of ['Dashboard','Board','Grid','Gantt','Calendar']){
   const source=app.slice(app.indexOf('function '+name.toLowerCase()+'(){'));
   const next=source.indexOf('\nfunction ',1);
   const view=next<0?source:source.slice(0,next);
   assert.match(view,/commonToolbar\(\)/,name+' must use shared filter controls');
 }
 assert.match(app,/case 'clear-filters':[^\n]*assigned_by:''/);
});

test('Dashboard filtering and Calendar filtering are based on the shared filter state',()=>{
 assert.match(app,/const base=scopeTasks\(filteredTasks\(\),'dashboard'\)/);
 assert.match(app,/const y=S\.calendarMonth[^\n]*items=filteredTasks\(\)/);
 assert.match(app,/return S\.viewFilters\[S\.view\]\?\?=\( \{[^\n]*assigned_by:''/);
});

test('Workspace deletion is one authenticated RPC operation with confirmation',async()=>{
 const a=store.indexOf(' async deleteWorkspace(workspaceId,confirmationName){');
 const b=store.indexOf(' async joinWorkspace(',a);
 assert.ok(a>0&&b>a);
 const LocalStore=new Function('return class LocalStore {'+store.slice(a,b)+'}')();
 const owner=new LocalStore();
 owner.user={id:'u1'};owner.connected=true;
 owner.listWorkspaces=async()=>[{id:'w1',name:'Ramadhan Camp 2027',created_by:'u1'}];
 const calls=[];
 owner.rpc=async(...args)=>{calls.push(args);return true;};
 await assert.rejects(owner.deleteWorkspace('w1','Incorrect'),/confirmation does not match/);
 assert.equal(calls.length,0);
 assert.equal(await owner.deleteWorkspace('w1','Ramadhan Camp 2027'),true);
 assert.deepEqual(calls,[['delete_workspace_permanently',{p_workspace_id:'w1',p_confirm_name:'Ramadhan Camp 2027'}]]);
 owner.user={id:'u2'};
 await assert.rejects(owner.deleteWorkspace('w1','Ramadhan Camp 2027'),/Only the Workspace creator/);
 assert.equal(calls.length,1);
});

test('Database deletion function validates owner and Super Admin, archives before deleting',()=>{
 assert.match(sql,/security invoker/i);
 assert.match(sql,/v_creator is distinct from auth\.uid\(\)/);
 assert.match(sql,/has_workspace_role\(p_workspace_id,array\['super_admin'\]\)/);
 assert.match(sql,/p_confirm_name is distinct from v_name/);
 const taskArchive=sql.indexOf('update public.tasks');
 const taskDelete=sql.indexOf('delete from public.tasks');
 const projectArchive=sql.indexOf('update public.projects');
 const projectDelete=sql.indexOf('delete from public.projects');
 const workspaceDelete=sql.indexOf('delete from public.workspaces');
 assert.ok(taskArchive<taskDelete&&taskDelete<projectArchive&&projectArchive<projectDelete&&projectDelete<workspaceDelete);
 assert.match(sql,/grant execute on function public\.delete_workspace_permanently\(uuid,text\) to authenticated/);
 assert.doesNotMatch(store,/rest\('workspaces','DELETE'/);
});
