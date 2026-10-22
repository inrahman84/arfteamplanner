import {uuid,today,plusDays,validAttachment} from './core.js';
const DEMO_KEY='workflow_planner_demo_v1';
const SESSION_KEY='workflow_planner_session_v1';
const cfg=window.__WORKFLOW_CONFIG__||{};
export const isConnected=Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey && new URLSearchParams(location.search).get('demo')!=='1');
const apiRoot=isConnected?cfg.supabaseUrl.replace(/\/$/,''):'';
const anon=cfg.supabaseAnonKey||'';
function seed(){
 const ws='demo-workspace';
 const people=[
  {id:'u1',full_name:'Alex Morgan',email:'alex@demo.local',job_title:'Project Lead',username:'alex_morgan'},
  {id:'u2',full_name:'Sarah Wijaya',email:'sarah@demo.local',job_title:'Operations Coordinator',username:'sarah_wijaya'},
  {id:'u3',full_name:'Daniel Pratama',email:'daniel@demo.local',job_title:'Development Specialist',username:'daniel_pratama'},
  {id:'u4',full_name:'Nadia Putri',email:'nadia@demo.local',job_title:'Quality Assurance',username:'nadia_putri'}
 ];
 const categories=[{id:'c1',workspace_id:ws,name:'Strategic',color:'#c89b55'},{id:'c2',workspace_id:ws,name:'Operations',color:'#3f6276'},{id:'c3',workspace_id:ws,name:'Development',color:'#009b4c'},{id:'c4',workspace_id:ws,name:'Administration',color:'#5f5d5d'}];
 const projects=[{id:'p1',workspace_id:ws,name:'Annual Planning',color:'#c89b55'},{id:'p2',workspace_id:ws,name:'Operations Improvement',color:'#3f6276'},{id:'p3',workspace_id:ws,name:'Digital Transformation',color:'#009b4c'}];
 const names=[
  ['Develop annual strategic roadmap','u1','c1','p1','In Progress','High',-9,13,'Define milestones, deliverables, and approval pathway.','Leadership Team'],
  ['Conduct stakeholder alignment meeting','u2','c1','p1','Completed','Medium',-15,-3,'Align objectives across stakeholders.','Department Heads'],
  ['Review operational procedures','u2','c2','p2','In Progress','High',-6,6,'Audit existing SOP and document gaps.','Operations'],
  ['Design performance dashboard','u3','c3','p3','In Progress','Critical',-3,17,'Build a unified dashboard for task performance.','Product Owner, IT Team'],
  ['Prepare monthly management report','u1','c4','p1','Not Started','Medium',3,12,'Summarize achievements, constraints, and next steps.','Executive Director'],
  ['Organize user training session','u4','c2','p3','Not Started','Low',8,20,'Develop a practical user training session.','All Users'],
  ['Data collection and validation','u4','c3','p3','In Progress','High',-5,4,'Review completeness and consistency of records.','Data Operators'],
  ['Finalize project budget','u1','c1','p1','Completed','High',-24,-5,'Consolidate workstream budget.','Finance'],
  ['Develop communication guidelines','u2','c4','p2','Not Started','Low',9,27,'Draft team communication standards.','Communications'],
  ['Test mobile responsive interface','u3','c3','p3','In Progress','Medium',-7,2,'Review usability on phone and tablet.','QA Team'],
  ['Schedule quarterly review','u1','c1','p1','Not Started','Medium',15,27,'Confirm dates and prepare materials.','Management'],
  ['Review resource allocation','u2','c2','p2','In Progress','High',-14,-2,'Assess staffing and budget capacity.','HR'],
  ['Prepare system rollout checklist','u4','c3','p3','Not Started','High',6,18,'Document go-live prerequisites and owners.','IT Team'],
  ['Complete procurement assessment','u2','c2','p2','Completed','Low',-30,-10,'Record purchasing requirements.','Procurement'],
  ['Design project documentation template','u3','c4','p3','In Progress','Medium',-2,8,'Standardize project documentation.','PMO'],
  ['Publish milestone update','u1','c1','p1','Not Started','High',2,11,'Issue concise status communication.','Leadership Team']
 ];
 return {
  workspaces:[{id:ws,name:'My Workspace',created_by:'u1',join_code:'DEMO12345678'}],
  members:people.map((p,i)=>({workspace_id:ws,user_id:p.id,role:i===0?'super_admin':i===1?'manager':i===2?'specialist':'officer',team_name:i===0?'Leadership':i===1?'Operations':'Technology'})),
  people,categories,projects,
  tasks:names.map(([title,assigned_to,category_id,project_id,status,priority,start,due,notes,stakeholders],i)=>({id:'task-'+(i+1),workspace_id:ws,title,assigned_to,category_id,project_id,status,priority,start_date:plusDays(today(),start),due_date:plusDays(today(),due),notes,stakeholders,created_by:'u1',attachment_url:i===0?'https://example.com/roadmap':'',completion_requested_at:null,completion_requested_by:null,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}))
 };
}
class DataStore{
 constructor(){this.connected=isConnected;this.demo=null;this.session=null;this.user=null;this.busyRefresh=null;}
 async initialize(){
  if(!this.connected){try{this.demo=JSON.parse(localStorage.getItem(DEMO_KEY))}catch{};if(!this.demo)this.demo=seed();
   // In-place demo migration, preserving all V1.0 tasks and custom workspace data.
   for(const m of this.demo.members||[]){m.role={owner:'super_admin',admin:'manager',member:'officer',viewer:'officer'}[m.role]||m.role;m.team_name=m.team_name||'General';}
   for(const p of this.demo.people||[]){if(!p.username)p.username='user_'+String(p.id).replace(/[^a-z0-9]/g,'').slice(0,20);}
   for(const task of this.demo.tasks||[]){task.attachment_url??='';task.completion_requested_at??=null;task.completion_requested_by??=null;}
   this.user={id:'u1',email:this.demo.people[0]?.email||'demo@local'};this.saveDemo();return;}
  try{this.session=JSON.parse(localStorage.getItem(SESSION_KEY))}catch{}
  if(this.session){try{await this.ensureToken();this.user=(await this.authFetch('/auth/v1/user',{method:'GET'}));}catch{this.session=null;this.user=null;localStorage.removeItem(SESSION_KEY);}}
 }
 saveDemo(){if(!this.connected)localStorage.setItem(DEMO_KEY,JSON.stringify(this.demo));}
 async raw(url,opts={}){
  const response=await fetch(apiRoot+url,{...opts,headers:{'apikey':anon,'Content-Type':'application/json',...(opts.headers||{})}});
  const text=await response.text();let body;try{body=text?JSON.parse(text):null}catch{body=text}
  if(!response.ok)throw Error(body?.msg||body?.message||body?.error_description||body?.error||`HTTP ${response.status}`);
  return body;
 }
 async refresh(){
  if(!this.session?.refresh_token)throw Error('Sesi login berakhir. Silakan masuk kembali.');
  if(!this.busyRefresh){this.busyRefresh=this.raw('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:JSON.stringify({refresh_token:this.session.refresh_token})}).then(s=>{this.setSession(s);return s}).finally(()=>this.busyRefresh=null);}
  return this.busyRefresh;
 }
 async ensureToken(){if(!this.session?.access_token)throw Error('Login dibutuhkan.');if((this.session.expires_at||0)*1000<Date.now()+60_000)await this.refresh();}
 setSession(s){this.session={...s,expires_at:s.expires_at||Math.floor(Date.now()/1000)+s.expires_in};this.user=s.user||this.user;localStorage.setItem(SESSION_KEY,JSON.stringify(this.session));}
 async authFetch(path,options={}){await this.ensureToken();return this.raw(path,{...options,headers:{...(options.headers||{}),Authorization:'Bearer '+this.session.access_token}});}
 async login(email,password){const s=await this.raw('/auth/v1/token?grant_type=password',{method:'POST',body:JSON.stringify({email,password})});this.setSession(s);}
 async loginByUsername(username,password){const response=await fetch(apiRoot+'/functions/v1/username-login',{method:'POST',headers:{'apikey':anon,'Content-Type':'application/json'},body:JSON.stringify({username,password})});const body=await response.json().catch(()=>({}));if(!response.ok)throw Error(body.message||'Username atau password salah');this.setSession(body);}
 async signup(full_name,email,password,username){const s=await this.raw('/auth/v1/signup',{method:'POST',body:JSON.stringify({email,password,data:{full_name,username}})});if(s?.access_token)this.setSession(s);return s;}
 async logout(){if(this.connected&&this.session){try{await this.authFetch('/auth/v1/logout',{method:'POST'})}catch{}this.session=null;this.user=null;localStorage.removeItem(SESSION_KEY);}}
 async rest(table,method='GET',params='',data){
  const opts={method,headers:{}};
  if(data!==undefined)opts.body=JSON.stringify(data);
  if(method!=='GET')opts.headers.Prefer='return=representation';
  const result=await this.authFetch(`/rest/v1/${table}${params}`,opts);
  return result;
 }
 async rpc(name,body){return this.authFetch('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(body)});}
 async getProfile(){if(!this.connected)return this.demo.people.find(p=>p.id===this.user.id);return (await this.rest('profiles','GET','?select=*&id=eq.'+encodeURIComponent(this.user.id)))[0];}
 async listWorkspaces(){if(!this.connected)return this.demo.workspaces;return this.rest('workspaces','GET','?select=*&order=created_at.asc');}
 async loadWorkspace(workspaceId){
  if(!this.connected){return {members:this.demo.members.filter(x=>x.workspace_id===workspaceId),people:this.demo.people,projects:this.demo.projects.filter(x=>x.workspace_id===workspaceId),categories:this.demo.categories.filter(x=>x.workspace_id===workspaceId),tasks:this.demo.tasks.filter(x=>x.workspace_id===workspaceId)};}
  const w=encodeURIComponent(workspaceId);
  const [members,projects,categories,tasks]=await Promise.all([
   this.rest('workspace_members','GET',`?select=*&workspace_id=eq.${w}`),
   this.rest('projects','GET',`?select=*&workspace_id=eq.${w}&order=name.asc`),
   this.rest('categories','GET',`?select=*&workspace_id=eq.${w}&order=name.asc`),
   this.rest('tasks','GET',`?select=*&workspace_id=eq.${w}&order=created_at.desc&limit=2000`)
  ]);
  const ids=members.map(m=>m.user_id);
  const people=ids.length?await this.rest('profiles','GET',`?select=*&id=in.(${ids.map(encodeURIComponent).join(',')})`):[];
  return {members,projects,categories,tasks,people};
 }
 async createWorkspace(name){
  if(!this.connected){const id=uuid();const ws={id,name,created_by:this.user.id,join_code:'DEMO12345678'};this.demo.workspaces.push(ws);this.demo.members.push({workspace_id:id,user_id:this.user.id,role:'super_admin',team_name:'General'});this.demo.projects.push({id:uuid(),workspace_id:id,name:'General',color:'#3f6276'});this.saveDemo();return ws;}
  const rows=await this.rest('workspaces','POST','',{name,created_by:this.user.id});return rows[0];
 }
 async joinWorkspace(code){if(!this.connected)throw Error('Undangan akun nyata tersedia setelah Supabase dikonfigurasi.');return this.rpc('join_workspace_by_code',{invite_code:code});}
 async rotateCode(workspaceId){if(!this.connected)throw Error('Hanya tersedia di mode Supabase.');return this.rpc('rotate_workspace_code',{target_workspace:workspaceId});}
 async saveTask(task){
  if(!validAttachment(task.attachment_url))throw Error('Attachment harus berupa tautan HTTPS valid');
  if(!this.connected){if(task.id){const idx=this.demo.tasks.findIndex(x=>x.id===task.id);if(idx<0)throw Error('Task tidak ditemukan');if(task.status==='Completed'&&this.demo.tasks[idx].status!=='Completed'&&!['super_admin','manager'].includes(this.demo.members.find(m=>m.user_id===this.user.id&&m.workspace_id===task.workspace_id)?.role))throw Error('Completed harus disetujui Manager');
    const prev=this.demo.tasks[idx],changed=prev.status!==task.status;
    const next={...prev,...task,updated_at:new Date().toISOString()};
    if(changed){next.completion_requested_at=null;next.completion_requested_by=null;}
    if(task.status==='Completed'&&changed){next.completed_at=new Date().toISOString();next.completion_approved_by=this.user.id;}
    if(task.status!=='Completed'){next.completed_at=null;next.completion_approved_by=null;}
    this.demo.tasks[idx]=next;}else{if(task.status==='Completed'&&!['super_admin','manager'].includes(this.demo.members.find(m=>m.user_id===this.user.id&&m.workspace_id===task.workspace_id)?.role))throw Error('Completed harus disetujui Manager');task={...task,id:uuid(),created_at:new Date().toISOString(),updated_at:new Date().toISOString(),created_by:this.user.id,completed_at:task.status==='Completed'?new Date().toISOString():null,completion_approved_by:task.status==='Completed'?this.user.id:null};this.demo.tasks.unshift(task);}this.saveDemo();return task;}
  if(task.id){const {id,...body}=task;const r=await this.rest('tasks','PATCH','?id=eq.'+encodeURIComponent(id),body);return r[0];}
  const r=await this.rest('tasks','POST','',task);return r[0];
 }
 async deleteTask(id){if(!this.connected){this.demo.tasks=this.demo.tasks.filter(x=>x.id!==id);this.saveDemo();return;}await this.rest('tasks','DELETE','?id=eq.'+encodeURIComponent(id));}
 async createProject(body){if(!this.connected){const val={...body,id:uuid()};this.demo.projects.push(val);this.saveDemo();return val;}return (await this.rest('projects','POST','',body))[0];}
 async createCategory(body){if(!this.connected){const val={...body,id:uuid()};this.demo.categories.push(val);this.saveDemo();return val;}return (await this.rest('categories','POST','',body))[0];}
 async updateProfile(body){if(!this.connected){const p=this.demo.people.find(p=>p.id===this.user.id);Object.assign(p,body);this.saveDemo();return p;}return (await this.rest('profiles','PATCH','?id=eq.'+encodeURIComponent(this.user.id),body))[0];}
 async updateMemberRole(workspaceId,userId,role){if(!this.connected){const m=this.demo.members.find(m=>m.workspace_id===workspaceId&&m.user_id===userId);if(m)m.role=role;this.saveDemo();return;}await this.rest('workspace_members','PATCH',`?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}`,{role});}
 async updateMemberTeam(workspaceId,userId,team_name){
   if(!this.connected){const m=this.demo.members.find(m=>m.workspace_id===workspaceId&&m.user_id===userId);if(m)m.team_name=team_name;this.saveDemo();return;}
   await this.rest('workspace_members','PATCH',`?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}`,{team_name});
 }
 async requestCompletion(task){
   if(task.status!=='In Progress')throw Error('Task harus In Progress untuk mengajukan penyelesaian');
   if(!this.connected){const t=this.demo.tasks.find(x=>x.id===task.id);if(!t)throw Error('Task tidak ditemukan');const r=this.demo.members.find(x=>x.workspace_id===t.workspace_id&&x.user_id===this.user.id)?.role;if(this.user.id!==t.assigned_to&&this.user.id!==t.created_by&&!['super_admin','manager'].includes(r))throw Error('Only task owner or assignee can request completion');if(t.completion_requested_at)throw Error('Request is already pending');t.completion_requested_at=new Date().toISOString();t.completion_requested_by=this.user.id;this.saveDemo();return t;}
   return (await this.rest('tasks','PATCH','?id=eq.'+encodeURIComponent(task.id),{completion_requested_at:new Date().toISOString()}))[0];
 }
 async reviewCompletion(task,approved,feedback=''){
   if(!this.connected){const t=this.demo.tasks.find(x=>x.id===task.id);if(!t)throw Error('Task tidak ditemukan');const role=this.demo.members.find(m=>m.workspace_id===t.workspace_id&&m.user_id===this.user.id)?.role;if(!['super_admin','manager'].includes(role))throw Error('Persetujuan hanya Manager atau Super Admin');if(!t.completion_requested_at)throw Error('Tidak ada pengajuan yang menunggu');t.completion_requested_at=null;t.completion_requested_by=null;t.completion_reviewed_at=new Date().toISOString();t.completion_reviewed_by=this.user.id;t.completion_feedback=approved?'':feedback;if(approved){t.status='Completed';t.completed_at=new Date().toISOString();t.completion_approved_by=this.user.id;}this.saveDemo();return t;}
   const patch=approved?{status:'Completed'}:{completion_requested_at:null,completion_requested_by:null,completion_feedback:feedback};
   return (await this.rest('tasks','PATCH','?id=eq.'+encodeURIComponent(task.id),patch))[0];
 }
 async resetDemo(){this.demo=seed();this.user={id:'u1',email:this.demo.people[0].email};this.saveDemo();}
}
export const store=new DataStore();
