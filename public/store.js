import {uuid,today,plusDays,validAttachment,normalizeAttachmentUrls,projectIds} from './core.js';
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
   for(const task of this.demo.tasks||[]){task.attachment_url??='';task.attachment_urls??=(task.attachment_url?[task.attachment_url]:[]);task.attachment_names??=[];task.assigned_by??=null;task.completion_requested_at??=null;task.completion_requested_by??=null;}
   this.demo.comments ||= [];this.demo.notifications ||= [];this.demo.checklist ||= [];this.demo.dueDateRequests ||= [];this.demo.projectTaskPositions ||= [];this.demo.viewPreferences ||= [];this.demo.managementPositions ||= [];for(const p of this.demo.projects||[]){p.archived_at??=null;p.created_by??='u1';}for(const t of this.demo.tasks||[]){t.archived_at??=null;t.project_ids??=t.project_id?[t.project_id]:[];}
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
  if(!this.connected){const members=this.demo.members.filter(x=>x.workspace_id===workspaceId),allProjects=this.demo.projects.filter(x=>x.workspace_id===workspaceId),archivedProjects=allProjects.filter(p=>p.archived_at),archivedIds=new Set(archivedProjects.map(p=>p.id)),allTasks=this.demo.tasks.filter(x=>x.workspace_id===workspaceId);return {members,people:this.demo.people.map(p=>{const m=members.find(x=>x.user_id===p.id);return {...p,full_name:m?.display_name||p.full_name,job_title:m?.display_job_title??p.job_title};}),projects:allProjects.filter(p=>!p.archived_at),archivedProjects,archivedTasks:allTasks.filter(t=>t.archived_at),categories:this.demo.categories.filter(x=>x.workspace_id===workspaceId),tasks:allTasks.filter(t=>!t.archived_at&&(!projectIds(t).length||projectIds(t).some(id=>!archivedIds.has(id)))),dueDateRequests:(this.demo.dueDateRequests||[]).filter(r=>r.workspace_id===workspaceId),workloadPositions:(this.demo.workloadPositions||[]).filter(x=>x.workspace_id===workspaceId),dashboardPositions:(this.demo.dashboardPositions||[]).filter(x=>x.workspace_id===workspaceId&&x.user_id===this.user.id),projectTaskPositions:(this.demo.projectTaskPositions||[]).filter(x=>x.workspace_id===workspaceId),managementPositions:(this.demo.managementPositions||[]).filter(x=>x.workspace_id===workspaceId),viewPreferences:(this.demo.viewPreferences||[]).find(x=>x.workspace_id===workspaceId&&x.user_id===this.user.id)||null};}
  const w=encodeURIComponent(workspaceId);
  const [members,projects,categories,tasks,workloadPositions,dashboardPositions,dueDateRequests,projectTaskPositions,viewPreferencesRows,managementPositions]=await Promise.all([
   this.rest('workspace_members','GET',`?select=*&workspace_id=eq.${w}`),
   this.rest('projects','GET',`?select=*&workspace_id=eq.${w}&order=name.asc`),
   this.rest('categories','GET',`?select=*&workspace_id=eq.${w}&order=name.asc`),
   this.rest('tasks','GET',`?select=*&workspace_id=eq.${w}&order=created_at.desc&limit=2000`),
    this.rest('workload_positions','GET',`?select=*&workspace_id=eq.${w}`),
    this.rest('dashboard_card_positions','GET',`?select=*&workspace_id=eq.${w}&user_id=eq.${encodeURIComponent(this.user.id)}`),
    this.rest('due_date_requests','GET',`?select=*&workspace_id=eq.${w}&order=created_at.desc&limit=1000`),
    this.rest('project_task_positions','GET',`?select=*&workspace_id=eq.${w}&order=sort_order.asc&limit=5000`),
    this.rest('workspace_view_preferences','GET',`?select=*&workspace_id=eq.${w}&user_id=eq.${encodeURIComponent(this.user.id)}&limit=1`),
    this.rest('management_item_positions','GET',`?select=*&workspace_id=eq.${w}&order=sort_order.asc&limit=2000`)
  ]);
  const ids=members.map(m=>m.user_id);
  const people=ids.length?await this.rest('profiles','GET',`?select=*&id=in.(${ids.map(encodeURIComponent).join(',')})`):[];
  const archivedProjects=projects.filter(p=>p.archived_at),archivedIds=new Set(archivedProjects.map(p=>p.id));return {members,projects:projects.filter(p=>!p.archived_at),archivedProjects,archivedTasks:tasks.filter(t=>t.archived_at),categories,tasks:tasks.filter(t=>!t.archived_at&&(!projectIds(t).length||projectIds(t).some(id=>!archivedIds.has(id)))),dueDateRequests,workloadPositions,dashboardPositions,projectTaskPositions,managementPositions,viewPreferences:viewPreferencesRows[0]||null,people:people.map(p=>{const m=members.find(x=>x.user_id===p.id);return {...p,full_name:m?.display_name||p.full_name,job_title:m?.display_job_title??p.job_title};})};
 }
 async createWorkspace(name){
  if(!this.connected){const id=uuid();const ws={id,name,created_by:this.user.id,join_code:'DEMO12345678'};this.demo.workspaces.push(ws);this.demo.members.push({workspace_id:id,user_id:this.user.id,role:'super_admin',team_name:'General'});this.demo.projects.push({id:uuid(),workspace_id:id,name:'General',color:'#3f6276'});this.saveDemo();return ws;}
  const rows=await this.rest('workspaces','POST','',{name,created_by:this.user.id});return rows[0];
 }
 async deleteWorkspace(workspaceId,confirmationName){
  const ws=(await this.listWorkspaces()).find(w=>w.id===workspaceId);
  if(!ws||ws.created_by!==this.user?.id)throw Error('Only the Workspace creator with Super Admin role can delete it.');
  if(confirmationName!==ws.name)throw Error('Workspace name confirmation does not match.');
  if(!this.connected){
   const m=this.demo.members.find(x=>x.workspace_id===workspaceId&&x.user_id===this.user.id);
   if(m?.role!=='super_admin')throw Error('Only a Super Admin can delete a Workspace.');
   this.demo.workspaces=this.demo.workspaces.filter(w=>w.id!==workspaceId);
   for(const key of ['members','projects','categories','tasks','comments','notifications','checklist','dueDateRequests','workloadPositions','dashboardPositions','projectTaskPositions','managementPositions','viewPreferences']){
    this.demo[key]=(this.demo[key]||[]).filter(x=>x.workspace_id!==workspaceId);
   }
   this.saveDemo();return true;
  }
  // Use one atomic transaction via SECURITY INVOKER RPC. Direct cascading DELETE
  // conflicts with the archive-before-delete triggers on tasks and projects.
  const deleted=await this.rpc('delete_workspace_permanently',{p_workspace_id:workspaceId,p_confirm_name:confirmationName});
  if(deleted!==true)throw Error('Workspace could not be deleted; no changes were applied.');
  return true;
 }
 async joinWorkspace(code){if(!this.connected)throw Error('Undangan akun nyata tersedia setelah Supabase dikonfigurasi.');return this.rpc('join_workspace_by_code',{invite_code:code});}
 async rotateCode(workspaceId){if(!this.connected)throw Error('Hanya tersedia di mode Supabase.');return this.rpc('rotate_workspace_code',{target_workspace:workspaceId});}
 async saveTask(task){
  task.project_ids=projectIds(task);
  if(task.project_ids.length>20)throw Error('Maksimal 20 Project per Work Item');
  task.project_id=task.project_ids[0]||null;
  if(!validAttachment(task.attachment_url))throw Error('Attachment harus berupa tautan HTTPS valid');
  // Preserve compatibility with the original single attachment field.
  task.attachment_urls=normalizeAttachmentUrls(task.attachment_urls ?? (task.attachment_url?[task.attachment_url]:[]));
  task.attachment_url=task.attachment_urls[0]||'';
  task.attachment_names=Array.isArray(task.attachment_names)?task.attachment_names.map(x=>String(x||'').trim()):[];
  if(task.attachment_names.length&&task.attachment_names.length!==task.attachment_urls.length)throw Error('Jumlah Link Name harus sama dengan Attachment Links');
  if(task.attachment_names.some(n=>!n||n.length>120))throw Error('Link Name harus 1–120 karakter');
  // Attachment permissions apply independently of general task-edit permissions.
  // A Completed/On Hold/Not Started task may still have readable legacy links.
  // The database trigger is the ultimate guard for REST/RPC updates.
  const previous=task.id
    ?(this.connected
      ?(await this.rest('tasks','GET','?select=id,status,attachment_url,attachment_urls,attachment_names&id=eq.'+encodeURIComponent(task.id)+'&limit=1'))[0]
      :this.demo.tasks.find(x=>x.id===task.id))
    :null;
  if(task.id&&!previous)throw Error('Work Item tidak ditemukan');
  if(previous?.due_date&&previous.due_date!==task.due_date&&!this.connected){const member=this.demo.members.find(m=>m.workspace_id===task.workspace_id&&m.user_id===this.user.id);if(!['super_admin','manager','assistant_manager'].includes(member?.role))throw Error('Due Date sudah ditetapkan. Ajukan persetujuan Manager.');}
  if(previous){
   const oldLinks=previous.attachment_urls??(previous.attachment_url?[previous.attachment_url]:[]);
   const changed=JSON.stringify(oldLinks)!==JSON.stringify(task.attachment_urls)
     ||(previous.attachment_url||'')!==task.attachment_url
     ||JSON.stringify(previous.attachment_names||[])!==JSON.stringify(task.attachment_names);
   if(changed&&(previous.status!=='In Progress'||task.status!=='In Progress'))
     throw Error('Attachment hanya dapat diubah saat Work Item berstatus In Progress.');
  }else if(task.status!=='In Progress'&&task.attachment_urls.length)
   throw Error('Attachment hanya dapat ditambahkan saat Work Item berstatus In Progress.');
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
 async saveNewTaskWithChecklist(task,items=[]){
  task.project_ids=projectIds(task);
  if(task.project_ids.length>20)throw Error('Maksimal 20 Project per Work Item');
  task.project_id=task.project_ids[0]||null;
  if(!Array.isArray(items)||items.length>100)throw Error('Maksimal 100 langkah checklist');
  const clean=items.map((x,i)=>({title:String(x.title||'').trim(),is_done:!!x.is_done,position:i}));
  if(clean.some(x=>!x.title||x.title.length>250))throw Error('Checklist: isi antara 1 hingga 250 karakter');
  if(!clean.length)return this.saveTask(task);
  if(!this.connected){
   const result=await this.saveTask(task);
   this.demo.checklist ||= [];
   for(const [position,item] of clean.entries())this.demo.checklist.push({id:uuid(),task_id:result.id,workspace_id:result.workspace_id,title:item.title,is_done:item.is_done,position,created_by:this.user.id,created_at:new Date().toISOString()});
   this.saveDemo();return result;
  }
  const row=await this.rpc('create_task_with_checklist',{p_task:task,p_items:clean});
  if(!row?.id)throw Error('Gagal menyimpan Work Item dan checklist');
  return row;
 }
 async saveDashboardOrder(workspaceId,keys){
  if(!Array.isArray(keys)||new Set(keys).size!==keys.length)throw Error('Urutan card tidak valid');
  const allowed=['total','progress','hold','completed','pending','overdue','calendar','deadlines','workload','approvals'];
  if(keys.some(k=>!allowed.includes(k)))throw Error('Jenis kartu tidak valid');
  const rows=keys.map((card_key,sort_order)=>({workspace_id:workspaceId,user_id:this.user.id,card_key,sort_order}));
  if(!this.connected){this.demo.dashboardPositions=(this.demo.dashboardPositions||[]).filter(x=>!(x.workspace_id===workspaceId&&x.user_id===this.user.id&&keys.includes(x.card_key))).concat(rows);this.saveDemo();return rows;}
  if(!rows.length)return [];
  return this.authFetch('/rest/v1/dashboard_card_positions?on_conflict=workspace_id,user_id,card_key',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)});
 }
 async renameProject(w,id,name,color=null){const clean=String(name||'').trim();if(clean.length<2||clean.length>120)throw Error('Nama Project harus 2–120 karakter');if(color!==null&&!/^#[0-9a-f]{6}$/i.test(String(color)))throw Error('Warna Project tidak valid');const changes=color===null?{name:clean}:{name:clean,color};if(!this.connected){const p=this.demo.projects.find(x=>x.id===id&&x.workspace_id===w);if(!p)throw Error('Project tidak ditemukan');Object.assign(p,changes);this.saveDemo();return p;}const rows=await this.rest('projects','PATCH',`?workspace_id=eq.${encodeURIComponent(w)}&id=eq.${encodeURIComponent(id)}`,changes);if(!rows.length)throw Error('Project tidak dapat diubah');return rows[0];}
 async archiveProject(w,id,restore=false){if(!this.connected){const p=this.demo.projects.find(x=>x.id===id&&x.workspace_id===w);if(!p)throw Error('Project tidak ditemukan');const role=this.demo.members.find(m=>m.user_id===this.user.id&&m.workspace_id===w)?.role;if(!['super_admin','manager'].includes(role)&&p.created_by!==this.user.id)throw Error('Hanya pembuat Project atau Manager dapat mengarsipkan');p.archived_at=restore?null:new Date().toISOString();this.saveDemo();return p;}const rows=await this.rest('projects','PATCH',`?workspace_id=eq.${encodeURIComponent(w)}&id=eq.${encodeURIComponent(id)}`,{archived_at:restore?null:new Date().toISOString()});if(!rows.length)throw Error('Project tidak dapat diarsip/restore');return rows[0];}
 async archiveTask(w,id,restore=false){if(!this.connected){const t=this.demo.tasks.find(x=>x.id===id&&x.workspace_id===w);if(!t)throw Error('Work Item tidak ditemukan');t.archived_at=restore?null:new Date().toISOString();t.archived_by=restore?null:this.user.id;this.saveDemo();return t;}const rows=await this.rest('tasks','PATCH',`?workspace_id=eq.${encodeURIComponent(w)}&id=eq.${encodeURIComponent(id)}`,{archived_at:restore?null:new Date().toISOString(),archived_by:restore?null:this.user.id});if(!rows.length)throw Error('Work Item tidak dapat diarsip/restore');return rows[0];}
 async requestDueDateChange(task,proposed,reason){if(!task?.id||!task.due_date)throw Error('Due Date awal belum ditetapkan');if(!/^\d{4}-\d{2}-\d{2}$/.test(String(proposed||''))||proposed===task.due_date)throw Error('Pilih Due Date yang berbeda');const why=String(reason||'').trim();if(why.length<5||why.length>1000)throw Error('Alasan harus 5–1000 karakter');const item={workspace_id:task.workspace_id,task_id:task.id,requested_by:this.user.id,old_due_date:task.due_date,proposed_due_date:proposed,reason:why,status:'Pending'};if(!this.connected){this.demo.dueDateRequests||=[];if(this.demo.dueDateRequests.some(r=>r.task_id===task.id&&r.status==='Pending'))throw Error('Ada permohonan yang masih Pending');const row={...item,id:uuid(),created_at:new Date().toISOString()};this.demo.dueDateRequests.push(row);this.saveDemo();return row;}return (await this.rest('due_date_requests','POST','',item))[0];}
 async reviewDueDateRequest(id,approved,note=''){if(!this.connected){const r=this.demo.dueDateRequests.find(x=>x.id===id),t=this.demo.tasks.find(x=>x.id===r?.task_id),role=this.demo.members.find(x=>x.user_id===this.user.id&&x.workspace_id===r?.workspace_id)?.role;if(!r||!t||r.status!=='Pending')throw Error('Permohonan tidak ditemukan');if(!['super_admin','manager','assistant_manager'].includes(role))throw Error('Tidak berwenang');if(approved&&t.due_date!==r.old_due_date)throw Error('Due Date telah berubah');if(approved)t.due_date=r.proposed_due_date;r.status=approved?'Approved':'Rejected';r.reviewed_by=this.user.id;r.reviewed_at=new Date().toISOString();r.review_note=note;this.saveDemo();return r;}return this.rpc('review_due_date_request',{p_request_id:id,p_approve:!!approved,p_note:String(note||'')});}
 async deleteArchivedTask(workspaceId,id){
  if(!this.connected){
   const m=this.demo.members.find(x=>x.workspace_id===workspaceId&&x.user_id===this.user.id);
   if(!['super_admin','manager'].includes(m?.role))throw Error('Hanya Manager atau Super Admin dapat menghapus permanen');
   const task=this.demo.tasks.find(t=>t.id===id&&t.workspace_id===workspaceId);
   if(!task?.archived_at)throw Error('Work Item harus diarsipkan terlebih dahulu');
   this.demo.tasks=this.demo.tasks.filter(t=>t.id!==id);
   this.demo.checklist=this.demo.checklist.filter(c=>c.task_id!==id);
   this.demo.comments=this.demo.comments.filter(c=>c.task_id!==id);
   this.demo.projectTaskPositions=this.demo.projectTaskPositions.filter(p=>p.task_id!==id);
   this.saveDemo();return;
  }
  const rows=await this.rest('tasks','DELETE',`?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&archived_at=not.is.null`);
  if(!rows?.length)throw Error('Work Item tidak ada di arsip atau Anda tidak memiliki izin');
 }
 async deleteArchivedProject(workspaceId,id){
  if(!this.connected){
   const m=this.demo.members.find(x=>x.workspace_id===workspaceId&&x.user_id===this.user.id);
   if(!['super_admin','manager'].includes(m?.role))throw Error('Hanya Manager atau Super Admin dapat menghapus permanen');
   const project=this.demo.projects.find(p=>p.id===id&&p.workspace_id===workspaceId);
   if(!project?.archived_at)throw Error('Project harus diarsipkan terlebih dahulu');
   this.demo.projects=this.demo.projects.filter(p=>p.id!==id);
   for(const t of this.demo.tasks){const ids=projectIds(t);if(t.workspace_id===workspaceId&&ids.includes(id)){t.project_ids=ids.filter(x=>x!==id);t.project_id=t.project_ids[0]||null;}}
   this.demo.projectTaskPositions=this.demo.projectTaskPositions.filter(p=>p.project_id!==id);
   this.saveDemo();return;
  }
  const rows=await this.rest('projects','DELETE',`?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}&archived_at=not.is.null`);
  if(!rows?.length)throw Error('Project tidak ada di arsip atau Anda tidak memiliki izin');
 }
 async deleteTask(id){throw Error('Gunakan Archive > Delete Permanently untuk menghapus Work Item');}
 async createProject(body){if(!this.connected){const val={...body,id:uuid(),created_by:this.user.id,archived_at:null};this.demo.projects.push(val);this.saveDemo();return val;}return (await this.rest('projects','POST','',{...body,created_by:this.user.id}))[0];}
 async updateCategory(workspaceId,id,body){
  const name=String(body.name||'').trim(),color=String(body.color||'');
  if(name.length<2||name.length>80)throw Error('Nama Category harus 2–80 karakter');
  if(!/^#[0-9a-f]{6}$/i.test(color))throw Error('Warna Category tidak valid');
  if(!this.connected){
   const item=this.demo.categories.find(c=>c.id===id&&c.workspace_id===workspaceId);
   if(!item)throw Error('Category tidak ditemukan');
   const role=this.demo.members.find(m=>m.workspace_id===workspaceId&&m.user_id===this.user.id)?.role;
   if(!['super_admin','manager','assistant_manager','specialist','admin','officer'].includes(role))throw Error('Tidak memiliki izin');
   Object.assign(item,{name,color});this.saveDemo();return item;
  }
  const rows=await this.rest('categories','PATCH',`?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`,{name,color});
  if(!rows?.length)throw Error('Category tidak dapat diubah');
  return rows[0];
 }
 async saveViewPreferences(workspaceId,prefs){
  if(!workspaceId||!this.user?.id)throw Error('Workspace belum aktif');
  const project_order=Array.isArray(prefs.project_order)?prefs.project_order:null;
  const width=prefs.work_item_width;
  const existing=this.demo?.viewPreferences?.find(x=>x.workspace_id===workspaceId&&x.user_id===this.user.id)||null;
  if(project_order!==null&&(project_order.length>250||project_order.length!==new Set(project_order).size||project_order.some(id=>!id)))
    throw Error('Urutan Project tidak valid');
  if(width!==undefined&&(!Number.isInteger(width)||width<190||width>800))throw Error('Lebar Work Item harus 190–800 px');
  const row={workspace_id:workspaceId,user_id:this.user.id,
   project_order:project_order??existing?.project_order??[],work_item_width:width??existing?.work_item_width??280,
   updated_at:new Date().toISOString()};
  if(!this.connected){
   if(!this.demo.members.some(m=>m.workspace_id===workspaceId&&m.user_id===this.user.id))throw Error('Tidak terdaftar di workspace');
   if(row.project_order.some(id=>!this.demo.projects.some(p=>p.workspace_id===workspaceId&&p.id===id)))throw Error('Project tidak ada di workspace');
   this.demo.viewPreferences=(this.demo.viewPreferences||[]).filter(x=>!(x.workspace_id===workspaceId&&x.user_id===this.user.id)).concat(row);
   this.saveDemo();return row;
  }
  // Upsert full preferences for this user; the UI supplies existing values to avoid resets.
  return (await this.authFetch('/rest/v1/workspace_view_preferences?on_conflict=workspace_id,user_id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify([row])
  }))[0];
 }
 async saveManagementItemOrder(workspaceId,itemType,ids){
  if(!['project','category'].includes(itemType))throw Error('Jenis urutan tidak valid');
  if(!Array.isArray(ids)||!ids.length||ids.length>5000||ids.some(id=>typeof id!=='string'||!id)||new Set(ids).size!==ids.length)
    throw Error('Daftar urutan tidak valid');
  const rows=ids.map((item_id,sort_order)=>({workspace_id:workspaceId,item_type:itemType,item_id,sort_order,updated_by:this.user.id,updated_at:new Date().toISOString()}));
  if(!this.connected){
   const membership=this.demo.members.some(m=>m.workspace_id===workspaceId&&m.user_id===this.user.id);
   const collection=itemType==='project'?this.demo.projects:this.demo.categories;
   if(!membership||ids.some(id=>!collection.some(o=>o.id===id&&o.workspace_id===workspaceId)))throw Error('Item tidak berada dalam workspace');
   this.demo.managementPositions=(this.demo.managementPositions||[]).filter(p=>!(p.workspace_id===workspaceId&&p.item_type===itemType)).concat(rows);
   this.saveDemo();return rows;
  }
  const saved=await this.authFetch('/rest/v1/management_item_positions?on_conflict=workspace_id,item_type,item_id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)
  });
  if(!Array.isArray(saved)||saved.length!==rows.length)throw Error('Urutan belum tersimpan lengkap');
  return saved;
 }
 async saveProjectTaskOrder(workspaceId,projectId,orderedTaskIds){
  const ids=[...new Set(orderedTaskIds.filter(Boolean))];
  if(!projectId||!ids.length||ids.length!==orderedTaskIds.length)throw Error('Daftar urutan Work Item tidak valid');
  const rows=ids.map((task_id,sort_order)=>({workspace_id:workspaceId,project_id:projectId,task_id,sort_order,updated_by:this.user.id,updated_at:new Date().toISOString()}));
  if(!this.connected){
   const project=this.demo.projects.find(p=>p.id===projectId&&p.workspace_id===workspaceId);
   const member=this.demo.members.find(m=>m.user_id===this.user.id&&m.workspace_id===workspaceId);
   if(!project||project.archived_at||!member)throw Error('Tidak diizinkan mengurutkan Project');
   if(ids.some(id=>!this.demo.tasks.some(t=>t.id===id&&t.workspace_id===workspaceId&&projectIds(t).includes(projectId))))throw Error('Work Item tidak terkait dengan Project');
   this.demo.projectTaskPositions=(this.demo.projectTaskPositions||[]).filter(x=>!(x.workspace_id===workspaceId&&x.project_id===projectId)).concat(rows);
   this.saveDemo();return rows;
  }
  const result=await this.authFetch('/rest/v1/project_task_positions?on_conflict=project_id,task_id',{
   method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)
  });
  if(result?.length!==rows.length)throw Error('Urutan Work Item belum tersimpan lengkap');
  return result;
 }
 async createCategory(body){if(!this.connected){const val={...body,id:uuid()};this.demo.categories.push(val);this.saveDemo();return val;}return (await this.rest('categories','POST','',body))[0];}
 async deleteProject(workspaceId,id){throw Error('Arsipkan Project terlebih dahulu. Hapus permanen hanya tersedia pada menu Archive.');}
    async deleteCategory(workspaceId,id){
    if(!this.connected){this.demo.categories=this.demo.categories.filter(x=>!(x.id===id&&x.workspace_id===workspaceId));for(const t of this.demo.tasks)if(t.workspace_id===workspaceId&&t.category_id===id)t.category_id=null;this.saveDemo();return;}
    const rows=await this.rest('categories','DELETE',`?id=eq.${encodeURIComponent(id)}&workspace_id=eq.${encodeURIComponent(workspaceId)}`);
    if(!rows?.length)throw Error('Category tidak ditemukan atau Anda tidak memiliki izin.');
  }
  async updateMemberDetails(workspaceId,userId,display_name,display_job_title){
    if(!this.connected){const m=this.demo.members.find(x=>x.workspace_id===workspaceId&&x.user_id===userId);if(!m)throw Error('Anggota tidak ditemukan');m.display_name=display_name;m.display_job_title=display_job_title;this.saveDemo();return m;}
    const result=await this.rest('workspace_members','PATCH',`?workspace_id=eq.${encodeURIComponent(workspaceId)}&user_id=eq.${encodeURIComponent(userId)}`,{display_name,display_job_title});
    if(!result?.length)throw Error('Tidak diizinkan memperbarui profil anggota ini.');
    return result[0];
  }
  async saveWorkloadOrder(workspaceId,userIds){
    const rows=userIds.map((user_id,sort_order)=>({workspace_id:workspaceId,user_id,sort_order}));
    if(!this.connected){this.demo.workloadPositions=(this.demo.workloadPositions||[]).filter(x=>x.workspace_id!==workspaceId).concat(rows);this.saveDemo();return rows;}
    if(!rows.length)return [];
    const result=await this.authFetch('/rest/v1/workload_positions?on_conflict=workspace_id,user_id',{
      method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=representation'},body:JSON.stringify(rows)
    });
    if(result?.length!==rows.length)throw Error('Urutan workload belum tersimpan seluruhnya.');
    return result;
  }
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
 async listTaskChecklist(taskId){
   if(!this.connected)return (this.demo.checklist||[]).filter(c=>c.task_id===taskId).slice().sort((a,b)=>a.position-b.position||String(a.created_at).localeCompare(String(b.created_at)));
   return this.rest('task_checklist','GET','?select=*&task_id=eq.'+encodeURIComponent(taskId)+'&order=position.asc,created_at.asc&limit=200');
  }
  async addChecklistItem(task,title,position=0){
   const name=String(title||'').trim();
   if(!name||name.length>250)throw Error('Checklist harus berisi 1–250 karakter');
   if(!task?.id)throw Error('Simpan Work Item terlebih dahulu');
   const item={task_id:task.id,workspace_id:task.workspace_id,title:name,is_done:false,position,created_by:this.user.id};
   if(!this.connected){const val={...item,id:uuid(),created_at:new Date().toISOString()};this.demo.checklist.push(val);this.saveDemo();return val;}
   return (await this.rest('task_checklist','POST','',item))[0];
  }
  async setChecklistDone(taskId,id,is_done){
   if(!this.connected){const item=this.demo.checklist.find(x=>x.id===id&&x.task_id===taskId);if(!item)throw Error('Item checklist tidak ditemukan');item.is_done=!!is_done;this.saveDemo();return item;}
   const result=await this.rest('task_checklist','PATCH','?id=eq.'+encodeURIComponent(id)+'&task_id=eq.'+encodeURIComponent(taskId),{is_done:!!is_done,updated_at:new Date().toISOString()});
   if(!result.length)throw Error('Checklist tidak berhasil diperbarui');
   return result[0];
  }
  async deleteChecklistItem(taskId,id){
   if(!this.connected){this.demo.checklist=this.demo.checklist.filter(x=>!(x.id===id&&x.task_id===taskId));this.saveDemo();return;}
   await this.rest('task_checklist','DELETE','?id=eq.'+encodeURIComponent(id)+'&task_id=eq.'+encodeURIComponent(taskId));
  }
  async listTaskComments(taskId){
  if(!this.connected)return (this.demo.comments||[]).filter(c=>c.task_id===taskId).slice().sort((a,b)=>a.created_at.localeCompare(b.created_at));
  return this.rest('task_comments','GET','?select=*&task_id=eq.'+encodeURIComponent(taskId)+'&order=created_at.asc&limit=300');
 }
 async addTaskComment(task,body,mentionedUserIds=[]){
  const text=String(body||'').trim();if(!text||text.length>5000)throw Error('Komentar harus berisi 1–5000 karakter.');
  const mentions=[...new Set(mentionedUserIds)].slice(0,30);
  const entry={workspace_id:task.workspace_id,task_id:task.id,author_id:this.user.id,body:text,mentioned_user_ids:mentions};
  if(this.connected)return (await this.rest('task_comments','POST','',entry))[0];
  const comment={...entry,id:uuid(),created_at:new Date().toISOString()};this.demo.comments.push(comment);
  const people=[...new Set([task.created_by,task.assigned_to,...mentions].filter(Boolean))];
  for(const userId of people){
   if(userId===this.user.id||!this.demo.members.some(m=>m.workspace_id===task.workspace_id&&m.user_id===userId))continue;
   this.demo.notifications.push({id:uuid(),workspace_id:task.workspace_id,task_id:task.id,comment_id:comment.id,actor_id:this.user.id,recipient_id:userId,kind:mentions.includes(userId)?'mention':'comment',body_preview:text.slice(0,180),is_read:false,created_at:comment.created_at});
  }this.saveDemo();return comment;
 }
 async listNotifications(workspaceId){
  if(!this.connected)return (this.demo.notifications||[]).filter(n=>n.workspace_id===workspaceId&&n.recipient_id===this.user.id).slice().sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,60);
  return this.rest('task_notifications','GET','?select=*&workspace_id=eq.'+encodeURIComponent(workspaceId)+'&order=created_at.desc&limit=60');
 }
 async markNotificationRead(id){
  if(!this.connected){const notification=this.demo.notifications.find(n=>n.id===id&&n.recipient_id===this.user.id);if(notification)notification.is_read=true;this.saveDemo();return;}
  await this.rest('task_notifications','PATCH','?id=eq.'+encodeURIComponent(id),{is_read:true});
 }
 async resetDemo(){this.demo=seed();this.user={id:'u1',email:this.demo.people[0].email};this.saveDemo();}
}
export const store=new DataStore();
