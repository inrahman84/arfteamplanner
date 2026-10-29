import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
const projects=[
 {id:'p1',name:'Education',color:'#009b4c'},
 {id:'p2',name:'Operations',color:'#3f6276'},
 {id:'p3',name:'Management',color:'#c89b55'}
];
const tasks=[
 {id:'a',title:'Shared A',project_ids:['p1','p2'],assigned_to:'u1'},
 {id:'b',title:'Only B',project_ids:['p2'],assigned_to:'u1'},
 {id:'c',title:'Only C',project_ids:['p3'],assigned_to:'u1'},
 {id:'d',title:'Unassigned',project_ids:[],assigned_to:'u1'}
];
const projectIds=t=>t.project_ids||[];
const state={projects,tasks,search:'',viewPreferences:null};

function isolatedFilter(){
 const start=app.indexOf('function selectedProjectIds(');
 const end=app.indexOf('function navLink(',start);
 assert.ok(start>0&&end>start,'Project filter helpers must be available');
 let filter={project:'',projectIds:null,status:'',category:'',priority:'',assignee:'',assigned_by:''};
 const api=new Function('S','taskFilter','inProject','nameOf','projectNames','categoryOf',app.slice(start,end)+';return {selectedProjectIds,filteredTasks,newTaskProject}')(
   state,()=>filter,(t,id)=>projectIds(t).includes(id),id=>id,t=>projectIds(t),()=>null);
 return {api,setFilter(f){filter=f;}};
}
test('Project checklist matches any selected project without duplicates',()=>{
 const {api,setFilter}=isolatedFilter();
 const basic={project:'',projectIds:null,status:'',category:'',priority:'',assignee:'',assigned_by:''};
 assert.deepEqual(api.filteredTasks().map(t=>t.id),['a','b','c','d'],'All projects includes unassigned Work Items');
 setFilter({...basic,projectIds:['p1','p2']});
 assert.deepEqual(api.filteredTasks().map(t=>t.id),['a','b'],'Shared task appears once in flat views');
 setFilter({...basic,projectIds:['p3']});
 assert.deepEqual(api.filteredTasks().map(t=>t.id),['c']);
 assert.equal(api.newTaskProject(),'p3');
 setFilter({...basic,projectIds:[]});
 assert.deepEqual(api.filteredTasks().map(t=>t.id),[],'Clear selection displays no tasks');
 setFilter({...basic,projectIds:['stale-project']});
 assert.deepEqual(api.selectedProjectIds(),[],'Unknown projects are ignored');
});
test('Grid and Gantt group rows only under selected projects',()=>{
 const filter={project:'',projectIds:['p1'],status:'',category:'',priority:'',assignee:'',assigned_by:''};
 const fnSource=app.slice(app.indexOf('function groupTasksByProject('),app.indexOf('const workItemWidth='));
 const fn=new Function('S','selectedProjectIds','activeProjectIds','projectOf','sortProjectWorkItems',fnSource+';return groupTasksByProject')(
  state,()=>filter.projectIds,t=>projectIds(t),id=>projects.find(p=>p.id===id)?.name||'General',(ts)=>ts);
 assert.deepEqual(fn([tasks[0]]).map(g=>({id:g.id,tasks:g.items.map(t=>t.id)})),[{id:'p1',tasks:['a']}]);
 filter.projectIds=['p1','p2'];
 assert.deepEqual(fn([tasks[0],tasks[1]]).map(g=>g.id),['p1','p2']);
 assert.deepEqual(fn([tasks[0],tasks[1]])[1].items.map(t=>t.id),['a','b']);
 filter.projectIds=[];
 assert.deepEqual(fn([]),[]);
});
test('Checklist UI offers Select all, Clear selection and controls in requested filter order',()=>{
 const start=app.indexOf('function projectCheckboxFilter(');
 const end=app.indexOf('function commonToolbar(',start);
 const toolbar=app.slice(end,app.indexOf('function empty(',end));
 assert.ok(start>0&&end>start);
 assert.match(toolbar,/projectCheckboxFilter\(f\)/);
 assert.ok(toolbar.indexOf('data-filter="assignee"')<toolbar.indexOf('projectCheckboxFilter(f)'));
 assert.ok(toolbar.indexOf('projectCheckboxFilter(f)')<toolbar.indexOf('data-filter="category"'));
 assert.match(app,/data-action="project-filter-all"/);
 assert.match(app,/data-action="project-filter-none"/);
 assert.match(app,/data-project-toggle/);
 assert.match(app,/aria-expanded="\$\{S\.projectFilterOpen\}"/);
 assert.match(css,/\.project-filter-panel\[hidden\]\{display:none!important\}/);
 const render=new Function('S','selectedProjectIds','safe','safeColor','ic',app.slice(start,end)+';return projectCheckboxFilter')(
  state,f=>f.projectIds,x=>String(x),x=>x,()=>'<svg></svg>');
 let html=render({projectIds:null});
 assert.equal((html.match(/data-project-toggle/g)||[]).length,3);
 assert.equal((html.match(/checked/g)||[]).length,3);
 html=render({projectIds:['p1','p3']});
 assert.equal((html.match(/checked/g)||[]).length,2);
 assert.match(html,/2 projects selected/);
 html=render({projectIds:[]});
 assert.match(html,/No projects selected/);
 assert.equal((html.match(/checked/g)||[]).length,0);
});
test('All five views share checkbox project filters and Dashboard progress respects selection',()=>{
 for(const name of ['dashboard','board','grid','gantt','calendar']){
  const from=app.indexOf('function '+name+'(){');
  assert.ok(from>=0,name+' must exist');
  const to=app.indexOf('\nfunction ',from+1);
  assert.match(app.slice(from,to<0?undefined:to),/commonToolbar\(\)/,name+' has shared toolbar');
 }
 assert.match(app,/const result=projectProgress\(source,visibleProjects\)/);
 assert.match(app,/const base=scopeTasks\(filteredTasks\(\),'dashboard'\)/);
 assert.match(app,/case 'clear-filters':[^\n]*projectIds:null/);
 assert.match(app,/case 'project-filter-all':case 'project-filter-none'/);
});
