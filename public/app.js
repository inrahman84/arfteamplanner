import {STATUSES,PRIORITIES,MONTHS,WEEKDAYS,STATUS_COLORS,PRIORITY_COLORS,safe,safeColor,parseUserColor,colorToRGB,isoDate,today,plusDays,dayDiff,dateLabel,statusClass,priorityClass,overdue,initials,metrics,projectIds,projectProgress,csvExport,ROLES,roleLabel,validAttachment,normalizeAttachmentUrls,taskActiveOnDate,workloadSegments} from './core.js';
import {buildReportHTML,downloadHTMLReport} from './reports.js';
import {downloadPlannerPDF,filterPlannerReport} from './pdf-report.js';
import {buildGanttExportData,downloadGanttPDF,downloadGanttXLSX} from './gantt-export.js';
import {mentionCandidates,insertMention,mentionedUserIds,formattedCommentBody} from './discussion.js';
import {store,isConnected} from './store.js';

const root=document.getElementById('app');
const icons={
  logo:'<path d="M9 3h9a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3h3"/><path d="m8 12 3 3 6-7"/>',
  dashboard:'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>',
  board:'<rect x="3" y="3" width="7" height="18" rx="1"/><rect x="14" y="3" width="7" height="12" rx="1"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  gantt:'<path d="M4 5h16M4 10h9M9 15h11M4 20h13"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18"/>',
  team:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87"/><circle cx="9" cy="7" r="4"/>',
  settings:'<path d="M9.5 2h5l.55 2.65a8.3 8.3 0 0 1 1.7 1l2.55-.9 2.5 4.33-2 1.78a8.2 8.2 0 0 1 0 2.28l2 1.78-2.5 4.33-2.55-.9a8.3 8.3 0 0 1-1.7 1L14.5 22h-5l-.55-2.65a8.3 8.3 0 0 1-1.7-1l-2.55.9-2.5-4.33 2-1.78a8.2 8.2 0 0 1 0-2.28l-2-1.78 2.5-4.33 2.55.9a8.3 8.3 0 0 1 1.7-1L9.5 2Z"/><circle cx="12" cy="12" r="3.2"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
  down:'<path d="m6 9 6 6 6-6"/>',left:'<path d="m15 18-6-6 6-6"/>',right:'<path d="m9 18 6-6-6-6"/>',x:'<path d="M18 6 6 18M6 6l12 12"/>',check:'<path d="m5 12 4 4L19 6"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',warning:'<path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4M12 17v.01"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  download:'<path d="M12 3v12m0 0 5-5m-5 5-5-5M4 17v4h16v-4"/>',
  filter:'<path d="M3 5h18M7 12h10M10 19h4"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10H3Z"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  mail:'<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 6 10 8 10-8"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  copy:'<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  trash:'<path d="M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
  refresh:'<path d="M20 11a8 8 0 1 0-2 6M20 4v7h-7"/>',
  activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  arrowUp:'<path d="m12 19 0-14m-5 5 5-5 5 5"/>',
  close:'<path d="M3 12h18"/>'
};
const ic=(name,cls='')=>`<svg class="icon ${cls}" aria-hidden="true" viewBox="0 0 24 24">${icons[name]||icons.folder}</svg>`;
const $=q=>document.querySelector(q);
const S={view:'Dashboard',modal:null,modalTask:null,filter:{status:'',priority:'',category:'',assignee:'',assigned_by:'',project:'',projectIds:null},projectFilterOpen:false,viewFilters:{},collapsedProjects:{Grid:[],Gantt:[]},archivedProjects:[],archivedTasks:[],dueDateRequests:[],projectToRename:null,categoryToEdit:null,dueRequestTask:null,dashboardPositions:[],projectTaskPositions:[],managementPositions:[],viewPreferences:null,dashboardProject:'',draftChecklist:[],search:'',sort:'due_date',sortDir:1,calendarMonth:new Date(new Date().getFullYear(),new Date().getMonth(),1),ganttStart:plusDays(today(),-7),ganttDays:42,notifications:false,workspaceId:null,workspaces:[],members:[],people:[],projects:[],categories:[],tasks:[],profile:null,busy:false,authTab:'login',pendingJoin:'',isReady:false,dashboardTeam:'',dashboardUser:'',ganttTeam:'',ganttUser:'',dashboardMonth:new Date(new Date().getFullYear(),new Date().getMonth(),1),calView:'Month',taskTab:'work',taskComments:[],chatOpen:false,checklistItems:[],checklistLoading:false,reportType:'all',reportId:'',modalMemberId:null,workloadPositions:[],commentLoading:false,commentDraft:'',commentCaret:0,noticeItems:[]};
const role=()=>S.members.find(m=>m.user_id===store.user?.id)?.role||'viewer';
const canEdit=()=>true;
const canManage=()=>['super_admin','manager'].includes(role());
const canReviewDueDate=()=>['super_admin','manager','assistant_manager'].includes(role());
const canArchiveTask=t=>!!t?.id&&!t.archived_at&&(canManage()||t.created_by===store.user?.id||t.assigned_to===store.user?.id);
const canArchiveProject=p=>canManage()||p.created_by===store.user?.id;
const isOwner=()=>role()==='super_admin';
const canApprove=()=>['super_admin','manager'].includes(role());
const canEditTask=t=>!t?.archived_at&&(canApprove()||!t?.id||((t.created_by===store.user?.id||t.assigned_to===store.user?.id)&&t.status!=='Completed'));
const teamOf=id=>S.members.find(x=>x.user_id===id)?.team_name||'General';
const projectCollapsed=(view,id)=>(S.collapsedProjects[view]||[]).includes(id);
const teamNames=()=>[...new Set(S.members.map(x=>x.team_name||'General'))].sort();
const managerScope=()=>canApprove();
const workspace=()=>S.workspaces.find(w=>w.id===S.workspaceId);
const nameOf=id=>S.people.find(x=>x.id===id)?.full_name||'Unassigned';
const projectOf=id=>S.projects.find(x=>x.id===id)?.name||'General';
const activeProjectIds=t=>projectIds(t).filter(id=>S.projects.some(p=>p.id===id));
const projectNames=t=>activeProjectIds(t).map(id=>projectOf(id));
const inProject=(task,id)=>projectIds(task).includes(id);
const categoryOf=id=>S.categories.find(x=>x.id===id);
const toast=(message,kind='success')=>{let c=$('.toast-region');if(!c){c=document.createElement('div');c.className='toast-region';document.body.append(c)}const e=document.createElement('div');e.className='toast '+kind;e.textContent=message;c.append(e);setTimeout(()=>e.remove(),4500)};
function button(label,action,type='primary',more=''){return `<button type="button" class="btn ${type==='primary'?'':type}" data-action="${action}" ${more}>${label}</button>`}
function avatar(text,extra=''){return `<span class="avatar ${extra}" title="${safe(text)}">${safe(initials(text))}</span>`}
function listOptions(items,selected='',blank='All',pick=x=>x.name){return `<option value="">${safe(blank)}</option>`+items.map(x=>`<option value="${safe(x.id)}" ${x.id===selected?'selected':''}>${safe(pick(x))}</option>`).join('')}
function dateAlert(t){return overdue(t)?'overdue':''}
function taskStatus(t){return `<span class="badge ${statusClass(t.status)}"><span class="dot"></span>${safe(t.status)}</span>${t.completion_requested_at&&t.status!=='Completed'?'<span class="badge status-hold" title="Menunggu persetujuan Manager">Approval Pending</span>':''}`}
function taskPriority(t){return `<span class="badge ${priorityClass(t.priority)}">${safe(t.priority)}</span>`}
function taskFilter(){
 if(!['Board','Grid','Gantt'].includes(S.view))return S.filter;
 return S.viewFilters[S.view]??=( {status:'',priority:'',category:'',assignee:store.user?.id||'',assigned_by:'',project:'',projectIds:null} );
}
// null = all projects (including unassigned tasks); [] = explicitly none.
function selectedProjectIds(filter=taskFilter()){
 if(Array.isArray(filter.projectIds)){
  const active=new Set(S.projects.map(p=>p.id));
  return [...new Set(filter.projectIds)].filter(id=>active.has(id));
 }
 return filter.project?[filter.project]:null;
}
function newTaskProject(){const ids=selectedProjectIds();return ids?.length===1?ids[0]:'';}
function filteredTasks(){
 const f=taskFilter(),selected=selectedProjectIds(f);
 let out=S.tasks.filter(t=>(selected===null||selected.some(id=>inProject(t,id)))&&(!f.status||f.status===t.status)&&(!f.priority||f.priority===t.priority)&&(!f.category||f.category===t.category_id)&&(!f.assignee||f.assignee===t.assigned_to)&&(!f.assigned_by||f.assigned_by===t.assigned_by));
 if(S.search){const s=S.search.toLowerCase();out=out.filter(t=>[t.title,t.notes,t.stakeholders,nameOf(t.assigned_to),projectNames(t).join(' '),categoryOf(t.category_id)?.name,nameOf(t.assigned_by)].some(x=>String(x||'').toLowerCase().includes(s)));}
 return out;
}
function navLink(name,label,iconName){return `<button class="nav-link ${S.view===name?'active':''}" data-action="nav" data-view="${name}" title="${safe(label)}">${ic(iconName)}<span>${safe(label)}</span></button>`}
function mobileLink(name,label,iconName){return `<button class="mobile-link ${S.view===name?'active':''}" data-action="nav" data-view="${name}">${ic(iconName)}<span>${safe(label)}</span></button>`}
function sideBar(){return `<aside class="sidebar"><div class="brand"><span class="brand-mark">${ic('logo','lg')}</span><span>WorkFlow<span class="brand-sub">PLANNER</span></span></div><div class="nav-label">WORKSPACE</div>${navLink('Dashboard','Dashboard','dashboard')}${navLink('Board','Board View','board')}${navLink('Grid','Grid View','grid')}${navLink('Gantt','Timeline / Gantt','gantt')}${navLink('Calendar','Calendar','calendar')}${navLink('Archive','Archive','folder')}<div class="nav-label">MANAGEMENT</div>${navLink('Team','Team & Members','team')}${navLink('Settings','Settings','settings')}<div class="nav-spacer"></div><div class="sidebar-bottom"><div class="workspace-box"><div class="workspace-kicker">ACTIVE WORKSPACE</div><div class="workspace-row"><div class="workspace-name">${safe(workspace()?.name||'My Workspace')}</div><button class="icon-btn" data-action="switch-workspace" title="Switch workspace" style="color:#bed9c6;width:25px">${ic('down','sm')}</button></div></div><button class="side-bottom-btn" data-action="profile">${avatar(S.profile?.full_name||'?','gold')}<span>${safe(S.profile?.full_name||'My Profile')}</span></button>${isConnected?`<button class="side-bottom-btn" data-action="logout">${ic('logout')}<span>Sign out</span></button>`:''}</div></aside>`}
function topBar(){return `<header class="topbar"><div class="breadcrumb"><span>${safe(workspace()?.name||'Workspace')}</span><span class="divider"></span><strong>${safe(S.view)}</strong></div><div class="top-actions"><label class="search-box">${ic('search','sm')}<input id="globalSearch" placeholder="Search work items..." value="${safe(S.search)}" aria-label="Search work items"/></label><button class="icon-btn" data-action="notifications" aria-label="Notifications">${ic('bell')}<span id="notice-count" class="notif-count" ${S.noticeItems.filter(n=>!n.is_read).length?'':'hidden'}>${S.noticeItems.filter(n=>!n.is_read).length}</span></button><button class="top-avatar" data-action="profile" title="My profile">${safe(initials(S.profile?.full_name||'Me'))}</button></div>${S.notifications?renderNotification():''}</header>`}
function renderNotification(){const notices=S.noticeItems||[],alerts=S.tasks.filter(t=>overdue(t)).slice(0,3);return `<div class="notification-pop" id="notice-pop"><div class="flex between acenter"><h3>Notifications</h3><button class="icon-btn" data-action="notifications">${ic('x','sm')}</button></div>${notices.length?notices.slice(0,30).map(n=>`<button class="notification-row ${n.is_read?'':'unread'}" data-action="open-notification" data-id="${safe(n.id)}"><strong>${n.kind==='mention'?'Anda di-mention':'Komentar pada tugas'} · ${safe(nameOf(n.actor_id))}</strong><small>${safe(S.tasks.find(t=>t.id===n.task_id)?.title||'Work Item')}</small><small>${safe(n.body_preview||'')}</small><small>${safe(new Date(n.created_at).toLocaleString('id-ID'))}</small></button>`).join(''):'<p>Belum ada komentar atau mention baru.</p>'}${alerts.length?'<h4 style="margin:12px 3px">Overdue</h4>'+alerts.map(t=>`<p>${ic('warning','sm')} <b>${safe(t.title)}</b> · ${safe(dateLabel(t.due_date))}</p>`).join(''):''}</div>`}
function pageHead(label,title,desc,buttons=''){return `<div class="page-top"><div><div class="page-eyebrow">${safe(label)}</div><h1 class="page-title">${safe(title)}</h1><p class="page-desc">${safe(desc)}</p></div><div class="toolbar">${buttons}</div></div>`}
function projectCheckboxFilter(f){
 const selected=selectedProjectIds(f),all=selected===null,ids=selected||[];
 const label=all?'All projects':ids.length===0?'No projects selected':ids.length===1?(S.projects.find(p=>p.id===ids[0])?.name||'1 project'):`${ids.length} projects selected`;
 return `<div class="project-filter" data-project-select>
 <button type="button" class="project-filter-trigger ${all?'':'is-filtered'}" data-action="toggle-project-filter" data-filter="project" aria-label="Filter projects: ${safe(label)}" aria-haspopup="true" aria-expanded="${S.projectFilterOpen}" aria-controls="project-filter-panel"><span class="project-filter-title">${safe(label)}</span>${ic('down','sm')}</button>
 <div class="project-filter-panel" id="project-filter-panel" role="group" aria-label="Choose projects to display" ${S.projectFilterOpen?'':'hidden'}>
 <div class="project-filter-panel-head"><strong>Choose Projects</strong><span>${all?S.projects.length:ids.length} / ${S.projects.length}</span></div>
 <div class="project-filter-actions"><button type="button" data-action="project-filter-all">Select all</button><button type="button" data-action="project-filter-none">Clear selection</button></div>
 <div class="project-filter-list">${S.projects.length?S.projects.map(p=>`<label class="project-filter-option"><input type="checkbox" data-project-toggle value="${safe(p.id)}" ${all||ids.includes(p.id)?'checked':''}/><span class="project-swatch" style="background:${safeColor(p.color)}"></span><span>${safe(p.name)}</span></label>`).join(''):'<p class="small-text muted">No projects available.</p>'}</div>
 <p class="project-filter-help">Select one or more projects. Work Items associated with any selected project will be displayed.</p></div></div>`;
}
function commonToolbar(){const f=taskFilter();return `<div class="filterbar"><label class="search-box mobile-search">${ic('search','sm')}<input id="mobileSearch" value="${safe(S.search)}" placeholder="Search work items..." aria-label="Search work items"/></label>${ic('filter','sm')}<select aria-label="Filter assigned by" data-filter="assigned_by">${listOptions(S.people,f.assigned_by,'Assigned by',x=>x.full_name)}</select><select aria-label="Filter assigned to" data-filter="assignee">${listOptions(S.people,f.assignee,'Assigned to',x=>x.full_name)}</select>${projectCheckboxFilter(f)}<select aria-label="Filter category" data-filter="category">${listOptions(S.categories,f.category,'All Categories')}</select><select aria-label="Filter priority" data-filter="priority"><option value="">All Priorities</option>${PRIORITIES.map(p=>`<option ${p===f.priority?'selected':''}>${p}</option>`).join('')}</select><select aria-label="Filter status" data-filter="status"><option value="">All Statuses</option>${STATUSES.map(t=>`<option ${t===f.status?'selected':''}>${t}</option>`).join('')}</select>${Object.values(f).some(Boolean)||S.search?button('Clear filters','clear-filters','flat'):''}</div>`;}
function empty(title,desc,action=''){return `<div class="empty">${ic('folder','xl')}<h3>${safe(title)}</h3><p>${safe(desc)}</p>${action}</div>`}
function userTeamFilter(prefix){
 const canAll=managerScope(),selectedTeam=S[prefix+'Team'],selectedUser=S[prefix+'User'];
 const users=canAll?S.people.filter(x=>!selectedTeam||teamOf(x.id)===selectedTeam):S.people.filter(x=>x.id===store.user?.id);
 return `<div class="scope-filters">${ic('filter','sm')}<label>Team <select data-scope="${prefix}Team" ${canAll?'':'disabled'}><option value="">${canAll?'All Teams':'My Team'}</option>${teamNames().map(t=>`<option value="${safe(t)}" ${t===selectedTeam?'selected':''}>${safe(t)}</option>`).join('')}</select></label><label>User <select data-scope="${prefix}User"><option value="">${canAll?'All Users':'My Tasks'}</option>${users.map(u=>`<option value="${safe(u.id)}" ${u.id===selectedUser?'selected':''}>${safe(u.full_name)}</option>`).join('')}</select></label></div>`;
}
function scopeTasks(items,prefix){
 if(!managerScope())return items.filter(t=>t.assigned_to===store.user?.id||t.created_by===store.user?.id);
 const team=S[prefix+'Team'],user=S[prefix+'User'];
 return items.filter(t=>(!team||teamOf(t.assigned_to)===team)&&(!user||t.assigned_to===user));
}
function applyDashboardLayout(){
 if(S.view!=='Dashboard'||!document.querySelectorAll)return;
 const primary=document.querySelector('[data-dashboard-zone="panels"]');
 const secondary=document.querySelector('[data-dashboard-zone="panels-secondary"]');
 if(primary&&secondary){for(const card of [...secondary.querySelectorAll('[data-dashboard-card]')])primary.append(card);secondary.remove();}
 const positions=new Map((S.dashboardPositions||[]).map(x=>[x.card_key,x.sort_order]));
 for(const zone of document.querySelectorAll('[data-dashboard-zone]')){
  const cards=[...zone.querySelectorAll('[data-dashboard-card]')].filter(x=>x.parentElement===zone);
  const original=new Map(cards.map((x,i)=>[x.dataset.dashboardCard,i]));
  cards.sort((a,b)=>(positions.get(a.dataset.dashboardCard)??(original.get(a.dataset.dashboardCard)+100))-(positions.get(b.dataset.dashboardCard)??(original.get(b.dataset.dashboardCard)+100)));
  for(const card of cards){
   zone.append(card);
   if(!card.querySelector('.dashboard-drag-grip')){
    const grip=document.createElement('span');grip.className='dashboard-drag-grip';grip.draggable=true;
    grip.textContent='⠿';grip.title='Drag untuk mengubah urutan card';grip.setAttribute('aria-label','Drag untuk memindahkan card');
    card.prepend(grip);
   }
  }
 }
}
function dashboardCalendar(items){
 const y=S.dashboardMonth.getFullYear(),m=S.dashboardMonth.getMonth();
 const first=new Date(y,m,1),shift=(first.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),num=Math.ceil((days+shift)/7)*7;
 // Count inclusive active work days.
 const cells=Array.from({length:num},(_,i)=>{const d=new Date(y,m,1+i-shift),ds=isoDate(d),arr=items.filter(t=>taskActiveOnDate(t,ds));return `<button class="mini-cal-day ${d.getMonth()!==m?'other':''} ${ds===today()?'today':''}" data-action="dash-date" data-date="${ds}" title="${arr.length} active work items"><span>${d.getDate()}</span>${arr.length?`<b>${arr.length}</b>`:''}</button>`;}).join('');
 return `<section class="card panel-pad dashboard-tile" data-dashboard-card="calendar"><div class="panel-heading"><h2 class="section-title">Dashboard Calendar</h2><div class="calendar-controls"><button class="btn alt small" data-action="dash-prev">${ic('left','sm')}</button><strong>${MONTHS[m]} ${y}</strong><button class="btn alt small" data-action="dash-next">${ic('right','sm')}</button></div></div><div class="mini-cal">${WEEKDAYS.map(x=>`<div class="mini-day-name">${x}</div>`).join('')}${cells}</div><p class="small-text muted" style="margin-top:12px">Angka menunjukkan pekerjaan aktif pada tanggal tersebut. Klik tanggal untuk membuka kalender.</p></section>`;
}
function workloadMembers(data){
 const positions=new Map((S.workloadPositions||[]).map(x=>[x.user_id,x.sort_order]));
 return S.people.filter(u=>managerScope()||u.id===store.user?.id).map(u=>{
   const a=data.filter(t=>t.assigned_to===u.id);
   return {u,total:a.length,progress:a.filter(t=>t.status==='In Progress').length,hold:a.filter(t=>t.status==='On Hold').length,done:a.filter(t=>t.status==='Completed').length,pending:a.filter(t=>t.completion_requested_at&&t.status!=='Completed').length};
 }).sort((a,b)=>{
   const pa=positions.get(a.u.id),pb=positions.get(b.u.id);
   if(pa!==undefined&&pb!==undefined)return pa-pb;
   if(pa!==undefined)return -1;
   if(pb!==undefined)return 1;
   return b.total-a.total||a.u.full_name.localeCompare(b.u.full_name);
 });
}
function workloadCard(x,data){
 const parts=workloadSegments(data.filter(t=>t.assigned_to===x.u.id));
 let sum=0;
 const stops=parts.map(p=>{const a=sum;sum+=x.total?p.count/x.total*100:0;return STATUS_COLORS[p.status]+' '+a.toFixed(2)+'% '+sum.toFixed(2)+'%';});
 const wedges=x.total?stops.join(','):'#e9efeb 0% 100%';
 const legend=parts.filter(p=>p.count).map(p=>'<span><i style="background:'+STATUS_COLORS[p.status]+'"></i>'+safe(p.status)+': '+p.count+'</span>').join('');
 return `<button class="workload-card" draggable="${canManage()}" data-workload-id="${safe(x.u.id)}" data-action="dashboard-user" data-id="${safe(x.u.id)}" title="${canManage()?'Tarik untuk mengubah urutan · klik untuk filter':'Filter pekerjaan'} ${safe(x.u.full_name)}"><div class="donut-chart" style="background:conic-gradient(${wedges})" role="img" aria-label="${safe(x.u.full_name)}: ${x.done} dari ${x.total} completed"><span class="donut-hole"><b>${x.total?Math.round(x.done/x.total*100):0}%</b><small>Completed</small></span></div><div class="donut-info"><strong>${safe(x.u.full_name)} ${canManage()?'<span class="workload-grip" aria-hidden="true">⠿</span>':''}</strong><span>${safe(teamOf(x.u.id))} · ${x.total} tasks</span><div class="donut-legend">${legend}</div>${x.pending?'<small class="pending-note">'+x.pending+' pending approvals</small>':''}</div></button>`;
}
function dueDateApprovalPanel(){
 const pending=(S.dueDateRequests||[]).filter(r=>r.status==='Pending'&&(canReviewDueDate()||r.requested_by===store.user?.id));
 return `<section class="card panel-pad" style="margin-top:18px"><div class="panel-heading"><h2 class="section-title">Due Date Change Approval</h2><span class="panel-note">${pending.length} pending requests</span></div>
 ${pending.map(r=>`<div class="task-line" style="gap:10px;flex-wrap:wrap"><div class="grow"><strong>${safe(S.tasks.find(t=>t.id===r.task_id)?.title||'Work Item')}</strong><span class="sub">${safe(nameOf(r.requested_by))} · ${safe(dateLabel(r.old_due_date))} → ${safe(dateLabel(r.proposed_due_date))}<br/>${safe(r.reason)}</span></div>${canReviewDueDate()?`<div class="flex gap8"><button type="button" class="btn small" data-action="approve-due-date" data-id="${safe(r.id)}">Approve</button><button type="button" class="btn alt small" data-action="reject-due-date" data-id="${safe(r.id)}">Reject</button></div>`:'<span class="badge status-hold">Pending Approval</span>'}</div>`).join('')||'<p class="small-text muted">No Due Date change requests are pending.</p>'}</section>`;
}
function projectProgressPanels(source){
 const selected=selectedProjectIds(),visibleProjects=selected===null?S.projects:S.projects.filter(p=>selected.includes(p.id));
 const result=projectProgress(source,visibleProjects),showing=result.projects;
 const meter=p=>`<div class="project-progress-row"><div class="project-progress-heading"><span class="project-progress-name"><span class="project-swatch" style="background:${p.color}"></span><strong>${safe(p.name)}</strong></span><span class="project-progress-numbers"><b>${p.percent}%</b> · ${p.completed}/${p.total} Completed</span></div><div class="project-progress-track" role="progressbar" aria-label="${safe(p.name)}" aria-valuenow="${p.percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${p.percent}%;background:${p.color}"></span></div></div>`;
 return `<div class="project-progress-layout">
 <section class="card panel-pad project-progress-panel"><div class="panel-heading"><div><h2 class="section-title">Project Performance</h2><p class="small-text muted">Capaian = Completed ÷ Total Work Items per Project.</p></div><span class="panel-note">${showing.length} Project</span></div>
 <div class="project-progress-list">${showing.map(meter).join('')||'<p class="small-text muted">Belum ada Project dalam pilihan ini.</p>'}</div></section>
 <section class="card panel-pad project-progress-overall"><div class="panel-heading"><h2 class="section-title">Overall Project Achievement</h2></div>
 <div class="portfolio-chart" role="img" aria-label="Capaian keseluruhan ${result.percent}%"><div class="portfolio-donut" style="--portfolio-pct:${result.percent}"><div><strong>${result.percent}%</strong><span>Completed</span></div></div></div>
 <div class="portfolio-counts"><span><b>${result.completed}</b> Completed</span><span><b>${result.total}</b> Unique Work Items</span></div>
 <p class="small-text muted">Dihitung satu kali per Work Item unik, meskipun terkait dengan beberapa Project. Mengikuti Project dan filter lain yang sedang aktif.</p></section>
 </div>`;
}
function dashboard(){
 const base=scopeTasks(filteredTasks(),'dashboard'),data=base,m=metrics(data);
 const ordered=data.filter(t=>t.due_date&&t.status!=='Completed').sort((a,b)=>a.due_date.localeCompare(b.due_date));
 const requests=data.filter(t=>t.completion_requested_at&&t.status!=='Completed');
  const pendingDue=(S.dueDateRequests||[]).filter(r=>r.status==='Pending');
 const kpis=[['Total Work Items',m.total,'briefcase','#073b2d'],['In Progress',m.inProgress,'activity','#3f6276'],['On Hold',m.onHold,'clock','#c89b55'],['Completed',m.completed,'check','#009b4c'],['Pending Approval',m.pending,'warning','#b7791f'],['Overdue Tasks',m.late,'warning','#bd5548']];const kpiKeys=['total','progress','hold','completed','pending','overdue'];
 const workload=workloadMembers(data).filter(x=>!S.dashboardTeam||teamOf(x.u.id)===S.dashboardTeam).filter(x=>!S.dashboardUser||x.u.id===S.dashboardUser);
 return pageHead('WELCOME BACK','Workspace Overview',`Ringkasan pekerjaan dan tim · ${safe(roleLabel(role()))}`,button(ic('download')+' Download Laporan','download-report','alt')+(canEdit()?button(ic('plus')+' Create Task','new-task'):''))+
 commonToolbar()+userTeamFilter('dashboard')+
 `<div class="kpi-grid v11-kpi" data-dashboard-zone="kpis">${kpis.map(([label,v,icon,color],i)=>`<div class="card kpi dashboard-tile" data-dashboard-card="${kpiKeys[i]}"><div class="kpi-icon" style="color:${color};background:${color}14">${ic(icon)}</div><div class="kpi-label">${label}</div><div class="kpi-value">${v}</div></div>`).join('')}</div>`+projectProgressPanels(base)+`
 <div class="dashboard-grid" data-dashboard-zone="panels">${dashboardCalendar(data)}<section class="card panel-pad dashboard-tile" data-dashboard-card="deadlines"><div class="panel-heading"><h2 class="section-title">Upcoming Deadlines</h2><span class="panel-note">${ordered.length} open deadlines</span></div><div class="task-list">${ordered.slice(0,8).map(t=>`<div class="task-line" data-action="edit-task" data-id="${safe(t.id)}"><div class="flex acenter gap12 grow">${avatar(nameOf(t.assigned_to))}<div class="grow"><strong>${safe(t.title)}</strong><span class="sub">${safe(nameOf(t.assigned_to))} · ${safe(t.status)}</span></div></div><span class="date ${dateAlert(t)}">${dateLabel(t.due_date,true)}</span></div>`).join('')||'<p class="muted">No upcoming deadlines.</p>'}</div></section></div>
 <div class="dashboard-grid" data-dashboard-zone="panels-secondary"><section class="card panel-pad dashboard-tile" data-dashboard-card="workload"><div class="panel-heading"><h2 class="section-title">Member Workload</h2><span class="panel-note">${workload.length} members ${canManage()?'· drag to arrange':''}</span></div>
 <div class="workload-donuts">${workload.map(x=>workloadCard(x,data)).join('')||'<p class="small-text muted">Belum ada tugas yang ditugaskan ke anggota.</p>'}</div></section>
 <section class="card panel-pad dashboard-tile" data-dashboard-card="approvals"><div class="panel-heading"><h2 class="section-title">Completion Approval Queue</h2><span class="panel-note">${requests.length} requests</span></div>${requests.length?requests.map(t=>`<div class="task-line" data-action="edit-task" data-id="${safe(t.id)}"><div class="grow"><strong>${safe(t.title)}</strong><span class="sub">${safe(nameOf(t.completion_requested_by))} · ${safe(nameOf(t.assigned_to))}</span></div><span class="badge status-hold">Pending</span></div>`).join(''):'<p class="small-text muted">Tidak ada permohonan Completed yang menunggu.</p>'}${!canApprove()?'<p class="small-text muted">Persetujuan diselesaikan oleh Manager.</p>':''}</section></div>`+dueDateApprovalPanel();
}
function taskCard(t){const cat=categoryOf(t.category_id);return `<article class="task-card" draggable="${canEditTask(t)}" data-task-id="${safe(t.id)}" data-action="edit-task" data-id="${safe(t.id)}"><div class="card-topline"><span class="category-pill" style="background:${safeColor(cat?.color)}18;color:${safeColor(cat?.color)}">${safe(cat?.name||'General')}</span>${taskPriority(t)}</div><div class="task-title">${safe(t.title)}</div>${t.completion_requested_at&&t.status!=='Completed'?'<span class="badge status-hold">Approval Pending</span>':''}<div class="task-desc">${safe(t.notes||projectNames(t).join(', ')||'Tanpa Project')}</div><div class="task-footer"><div class="flex acenter gap8">${avatar(nameOf(t.assigned_to))}<span class="small-text muted" style="max-width:120px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${safe(nameOf(t.assigned_to))}</span></div><span class="due ${dateAlert(t)}">${ic('calendar','sm')}${dateLabel(t.due_date,true)}</span></div></article>`}
function board(){const tasks=filteredTasks();return pageHead('WORK MANAGEMENT','Kanban Board','Drag cards between columns to update progress.',canEdit()?button(ic('plus')+' New Task','new-task'):'')+commonToolbar()+`<div class="kanban">${STATUSES.map(status=>{const column=tasks.filter(t=>t.status===status);return `<div class="kanban-col" data-drop-status="${status}"><div class="col-top"><div class="col-heading"><span class="dot" style="color:${STATUS_COLORS[status]}"></span>${status}<span class="counter">${column.length}</span></div>${canEdit()?`<button class="icon-btn" data-action="new-task" data-status="${status}" title="Add task">${ic('plus','sm')}</button>`:''}</div><div class="kanban-items">${column.map(taskCard).join('')||'<div class="kanban-drop-hint">Drop a task here or create a new one</div>'}</div></div>`}).join('')}</div>`}
function sortProjectWorkItems(tasks,projectId){
 const rank=new Map((S.projectTaskPositions||[]).filter(p=>p.project_id===projectId).map(p=>[p.task_id,p.sort_order]));
 return tasks.slice().sort((a,b)=>{
  const pa=rank.get(a.id),pb=rank.get(b.id);
  if(pa!==undefined&&pb!==undefined)return pa-pb||a.id.localeCompare(b.id);
  if(pa!==undefined)return -1;if(pb!==undefined)return 1;
  const da=a.due_date||a.start_date||'9999-12-31',db=b.due_date||b.start_date||'9999-12-31';
  return da.localeCompare(db)||String(a.title).localeCompare(String(b.title))||a.id.localeCompare(b.id);
 });
}
function groupTasksByProject(tasks){
 const groups=new Map(),selected=selectedProjectIds();
 for(const t of tasks){
  const ids=activeProjectIds(t).filter(id=>selected===null||selected.includes(id));
  // When filtering, do not create groups for projects that were not selected.
  if(!ids.length&&selected!==null)continue;
  for(const project of ids.length?ids:['__unassigned__']){
   if(!groups.has(project))groups.set(project,{id:project,name:project==='__unassigned__'?'Tanpa Project':projectOf(project),items:[]});
   groups.get(project).items.push(t);
  }
 }
 const rank=new Map((S.viewPreferences?.project_order||[]).map((id,index)=>[id,index]));
 return [...groups.values()].map(g=>({...g,items:sortProjectWorkItems(g.items,g.id)})).sort((a,b)=>{
  const ra=rank.get(a.id),rb=rank.get(b.id);
  if(ra!==undefined&&rb!==undefined)return ra-rb;
  if(ra!==undefined)return -1;
  if(rb!==undefined)return 1;
  return a.name.localeCompare(b.name,'id');
 });
}
const workItemWidth=()=>Math.max(190,Math.min(800,S.viewPreferences?.work_item_width||280));
function sortedManagementItems(type){
 const rows=type==='project'?S.projects:S.categories;
 const rank=new Map((S.managementPositions||[]).filter(p=>p.item_type===type).map(p=>[p.item_id,p.sort_order]));
 return rows.slice().sort((a,b)=>{
  const ra=rank.get(a.id),rb=rank.get(b.id);
  if(ra!==undefined&&rb!==undefined)return ra-rb;
  if(ra!==undefined)return -1;
  if(rb!==undefined)return 1;
  return a.name.localeCompare(b.name,'id');
 });
}
function projectFoldLabel(group,view){
 const expanded=!projectCollapsed(view,group.id);
 return `<span class="project-fold-chevron" aria-hidden="true">${expanded?'▾':'▸'}</span>${ic('folder','sm')}<span class="project-fold-body"><span class="project-fold-name">${safe(group.name)}</span><span class="project-group-count">(${group.items.length} Work Items)</span></span>`;
}
function grid(){const data=filteredTasks().slice().sort((a,b)=>{const av=String(a[S.sort]||''),bv=String(b[S.sort]||'');return av.localeCompare(bv,undefined,{numeric:true})*S.sortDir;});const header=(label,key)=>`<button class="table-sort" data-action="sort" data-col="${key}">${label} ${S.sort===key?(S.sortDir===1?'↑':'↓'):''}</button>`;
 return pageHead('TASK REGISTER','Grid View','Work Items grouped by Project; multi-Project items appear under each selected Project.',button(ic('download')+' Export CSV','export-csv','alt')+button(ic('download')+' Download Laporan','download-report','alt')+(canEdit()?button(ic('plus')+' New Task','new-task'):''))+commonToolbar()+`<div class="table-wrap grid-column-layout" style="--work-item-width:${workItemWidth()}px"><table class="data-table grid-resizable"><colgroup><col style="width:var(--work-item-width)"><col style="width:175px"><col style="width:140px"><col style="width:130px"><col style="width:110px"><col style="width:140px"><col style="width:140px"><col style="width:215px"></colgroup><thead><tr><th class="grid-title-header"><span class="grid-heading-content">${header('Work Item','title')}<span class="column-resize-handle" data-resize-workitem role="separator" aria-orientation="vertical" tabindex="0" aria-label="Resize Work Item column; arrow keys adjust width" title="Geser untuk mengubah lebar kolom Work Item"></span></span></th><th>Assigned To</th><th>Category</th><th>${header('Status','status')}</th><th>${header('Priority','priority')}</th><th>${header('Start Date','start_date')}</th><th>${header('Due Date','due_date')}</th><th>Project</th></tr></thead><tbody>${groupTasksByProject(data).map(group=>`<tr class="project-group-row" data-grid-group="${safe(group.id)}"><td class="grid-project-header"><span class="grid-project-line">${group.id!=='__unassigned__'?`<span draggable="true" class="grid-project-grip" data-grid-project-grip data-project-id="${safe(group.id)}" tabindex="0" role="button" aria-label="Drag Project ${safe(group.name)} to reorder" title="Tarik untuk mengurutkan Project">⠿</span>`:''}<button type="button" class="project-fold" data-action="toggle-project" data-view="Grid" data-id="${safe(group.id)}" aria-expanded="${!projectCollapsed('Grid',group.id)}">${projectFoldLabel(group,'Grid')}</button></span></td><td colspan="7" class="grid-project-fill"></td></tr>`+(projectCollapsed('Grid',group.id)?[]:group.items).map(t=>`<tr data-action="edit-task" data-id="${safe(t.id)}" data-grid-task="${safe(t.id)}" data-grid-project="${safe(group.id)}"><td class="title-cell"><span class="grid-task-title-layout">${group.id!=='__unassigned__'?`<span class="grid-order-grip" draggable="true" data-grid-grip data-project-id="${safe(group.id)}" data-task-id="${safe(t.id)}" role="button" tabindex="0" aria-label="Drag to reorder ${safe(t.title)} within ${safe(group.name)}" title="Drag to change order">⠿</span>`:''}<span class="grid-task-title-text">${safe(t.title)}</span></span></td><td><span class="flex acenter gap8">${avatar(nameOf(t.assigned_to))}${safe(nameOf(t.assigned_to))}</span></td><td>${safe(categoryOf(t.category_id)?.name||'—')}</td><td>${taskStatus(t)}</td><td>${taskPriority(t)}</td><td>${dateLabel(t.start_date)}</td><td class="${dateAlert(t)}">${dateLabel(t.due_date)}</td><td>${safe(projectNames(t).join(', ')||'Tanpa Project')}</td></tr>`).join('')).join('')||`<tr><td colspan="8">${empty('No matching tasks','Try adjusting your filters.')}</td></tr>`}</tbody></table></div><p class="small-text muted" style="margin-top:13px">Showing ${data.length} of ${S.tasks.length} total work items. Drag ikon ⠿ untuk mengurutkan Project maupun Work Item. Tarik tepi kanan kolom Work Item untuk mengubah lebarnya; urutan Project dan lebar kolom digunakan pula di Timeline/Gantt. Click a row for details.</p>`;
}
function gantt(){const data=scopeTasks(filteredTasks(),'gantt').filter(t=>t.start_date||t.due_date).slice().sort((a,b)=>String(a.start_date||a.due_date).localeCompare(String(b.start_date||b.due_date)));const dates=Array.from({length:S.ganttDays},(_,i)=>plusDays(S.ganttStart,i));const cell=34;const dateHead=dates.map(date=>{const day=+date.slice(-2),d=parseDateSafe(date),weekend=[0,6].includes(d.getDay());return `<div class="gantt-day ${weekend?'weekend':''} ${date===today()?'today':''}"><span>${WEEKDAYS[(d.getDay()+6)%7]}</span><strong>${day}</strong></div>`}).join('');
 const rows=groupTasksByProject(data).map(group=>`<div class="gantt-project-heading"><div class="gantt-task-label"><button type="button" class="project-fold" data-action="toggle-project" data-view="Gantt" data-id="${safe(group.id)}" aria-expanded="${!projectCollapsed('Gantt',group.id)}">${projectFoldLabel(group,'Gantt')}</button></div><div class="gantt-timeline" style="width:${S.ganttDays*cell}px"></div></div>`+(projectCollapsed('Gantt',group.id)?[]:group.items).map(t=>{const start=t.start_date||t.due_date,end=t.due_date||t.start_date,offset=dayDiff(S.ganttStart,start),length=dayDiff(start,end)+1;const left=Math.max(0,offset)*cell,right=Math.min(S.ganttDays,offset+length)*cell;const vis=right>left;const bg=STATUS_COLORS[t.status];return `<div class="gantt-task-row"><div class="gantt-task-label gantt-task-child" data-action="edit-task" data-id="${safe(t.id)}"><span class="dot gantt-task-bullet" style="--bullet-color:${safe(bg)}" aria-hidden="true"></span><span title="${safe(t.title)}">${safe(t.title)}</span></div><div class="gantt-timeline" style="width:${S.ganttDays*cell}px"><div class="gantt-grid-cells">${dates.map(dt=>`<span class="gantt-cell ${[0,6].includes(parseDateSafe(dt).getDay())?'weekend':''} ${dt===today()?'today':''}"></span>`).join('')}</div>${vis?`<div class="gantt-bar" style="left:${left+3}px;width:${Math.max(right-left-6,6)}px;background:${bg}" title="${safe(t.title)} · ${dateLabel(start)} — ${dateLabel(end)}" data-action="edit-task" data-id="${safe(t.id)}">${safe(t.title)}</div>`:''}</div></div>`}).join('')).join('');
 let startIndex=0;const months=[];while(startIndex<dates.length){const d=parseDateSafe(dates[startIndex]);const m=d.getMonth(),y=d.getFullYear();let n=1;while(startIndex+n<dates.length){const z=parseDateSafe(dates[startIndex+n]);if(z.getMonth()!==m||z.getFullYear()!==y)break;n++;}months.push(`<div class="gantt-month-cell" style="width:${n*cell}px">${MONTHS[m]} ${y}</div>`);startIndex+=n;}
 return pageHead('PLANNING & SCHEDULING','Timeline / Gantt','Visualize activity windows, deadlines and dependencies over time.',`<button class="btn alt" data-action="gantt-prev">${ic('left','sm')}</button><button class="btn alt" data-action="gantt-today">Today</button><button class="btn alt" data-action="gantt-next">${ic('right','sm')}</button><select class="btn alt" data-change="gantt-zoom" aria-label="Zoom timeline"><option value="28" ${S.ganttDays===28?'selected':''}>4 weeks</option><option value="42" ${S.ganttDays===42?'selected':''}>6 weeks</option><option value="84" ${S.ganttDays===84?'selected':''}>12 weeks</option></select><button class="btn alt" data-action="export-gantt">${ic('download','sm')} Export PDF / XLSX</button>`)+commonToolbar()+userTeamFilter('gantt')+`<div class="gantt-scroller gantt-resizable" style="--work-item-width:${workItemWidth()}px"><div class="gantt-board"><div class="gantt-head"><div class="gantt-label"><span>Work Item</span><span class="column-resize-handle" data-resize-workitem role="separator" aria-orientation="vertical" tabindex="0" aria-label="Resize Work Item column; arrow keys adjust width" title="Geser untuk mengubah lebar kolom Work Item"></span></div><div><div class="gantt-month-row">${months.join('')}</div><div class="gantt-days">${dateHead}</div></div></div>${rows||`<div class="gantt-task-row"><div class="gantt-task-label">No tasks with dates</div></div>`}</div></div><p class="gantt-foot">Timeline ranges are inclusive of start and due dates. Scroll horizontally to see the full period. Tasks without dates are excluded.</p>`;
}
function parseDateSafe(s){return new Date(s+'T12:00:00');}
function calItem(t){const c=safeColor(S.projects.find(p=>p.id===activeProjectIds(t)[0])?.color||'#3f6276');return `<button class="cal-item" style="border-left:4px solid ${c};background:${c}20;color:#073b2d" data-action="edit-task" data-id="${safe(t.id)}" title="${safe(projectNames(t).join(', ')||'Tanpa Project')} · ${safe(t.title)}">${safe(t.title)}</button>`}
function monthCells(y,m,items,mini=false){
 const start=new Date(y,m,1),offset=(start.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),n=Math.ceil((offset+days)/7)*7;
 return Array.from({length:n},(_,i)=>{const d=new Date(y,m,i-offset+1),ds=isoDate(d),tasks=items.filter(t=>taskActiveOnDate(t,ds));return `<div class="cal-cell ${mini?'year-cell':''} ${d.getMonth()!==m?'other':''} ${ds===today()?'today':''}" data-action="calendar-day" data-date="${ds}"><div class="cal-date">${d.getDate()}</div>${mini?(tasks.length?`<span class="year-dot" style="background:${safeColor(S.projects.find(p=>p.id===activeProjectIds(tasks[0])[0])?.color||'#3f6276')}" title="${tasks.length} tasks"></span>`:''):tasks.slice(0,3).map(calItem).join('')}${!mini&&tasks.length>3?`<div class="cal-more">+${tasks.length-3} more</div>`:''}</div>`}).join('');
}
function calendar(){
 const y=S.calendarMonth.getFullYear(),m=S.calendarMonth.getMonth(),mode=S.calView,items=filteredTasks();
 const head=pageHead('YOUR SCHEDULE','Calendar','Week, Month, and Year · Click a task to open details.',`<div class="calendar-controls"><button class="btn alt" data-action="cal-prev">${ic('left','sm')}</button><strong>${mode==='Year'?y:mode==='Week'?'Minggu '+dateLabel(isoDate(S.calendarMonth)):MONTHS[m]+' '+y}</strong><button class="btn alt" data-action="cal-next">${ic('right','sm')}</button><button class="btn alt" data-action="cal-today">Today</button><select class="btn alt" data-change="cal-view" aria-label="Calendar view">${['Week','Month','Year'].map(v=>`<option ${v===mode?'selected':''}>${v}</option>`).join('')}</select></div>`);
 let body='';
 if(mode==='Month')body=`<div class="calendar-shell"><div class="calendar-grid">${WEEKDAYS.map(w=>`<div class="cal-weekday">${w}</div>`).join('')}${monthCells(y,m,items)}</div></div>`;
 else if(mode==='Week'){
  const base=new Date(S.calendarMonth),shift=(base.getDay()+6)%7;const monday=new Date(base);monday.setDate(base.getDate()-shift);
  body=`<div class="calendar-shell"><div class="week-view">${Array.from({length:7},(_,i)=>{const d=new Date(monday);d.setDate(monday.getDate()+i);const ds=isoDate(d);const due=items.filter(t=>taskActiveOnDate(t,ds));return `<section class="week-col"><div class="week-head ${ds===today()?'today':''}"><b>${WEEKDAYS[i]}</b><span>${dateLabel(ds,true)}</span></div><div class="week-work" data-action="calendar-day" data-date="${ds}">${due.map(calItem).join('')||'<span class="small-text muted">No tasks</span>'}</div></section>`}).join('')}</div></div>`;
 }else body=`<div class="year-cal-grid">${Array.from({length:12},(_,i)=>`<section class="card year-month"><button class="year-month-label" data-action="cal-month" data-month="${i}">${MONTHS[i]} ${y} ${ic('right','sm')}</button><div class="calendar-grid year-grid">${WEEKDAYS.map(w=>`<div class="cal-weekday">${w}</div>`).join('')}${monthCells(y,i,items,true)}</div></section>`).join('')}</div>`;
 return head+commonToolbar()+body+`<p class="gantt-foot">Work items tampil dari Start Date sampai Due Date (inklusif). Klik tanggal untuk membuat tugas.</p>`;
}
function team(){
 const manage=canManage();
 return pageHead('PEOPLE & COLLABORATION','Team Members','Enam peran pengguna dan klasifikasi tim.',manage?button(ic('plus')+' Add Team Member','invite'):'')+
 `<div class="panel-heading"><span class="panel-note">${S.members.length} members · ${safe(workspace()?.name||'workspace')}</span></div><div class="members-grid">${S.members.map(m=>{
  const u=S.people.find(p=>p.id===m.user_id)||{full_name:'Unknown',email:'',username:''};
  const mayChange=manage&&m.user_id!==store.user?.id&&(isOwner()||m.role!=='super_admin');
   const canEditIdentity=m.user_id===store.user?.id||mayChange;
  return `<div class="card member-card">${avatar(u.full_name,'gold')}<div class="grow"><div class="name">${safe(u.full_name)}</div><div class="email">@${safe(u.username||'username-belum-disetel')}</div><div class="role">${safe(u.job_title||'Team Member')}</div><div class="flex acenter gap8 wrap" style="margin-top:13px"><span class="badge status-not">${safe(roleLabel(m.role))}</span>${mayChange?`<select data-role-user="${safe(m.user_id)}" aria-label="Atur role ${safe(u.full_name)}">${ROLES.filter(r=>isOwner()||r[0]!=='super_admin').map(([key,label])=>`<option value="${key}" ${key===m.role?'selected':''}>${label}</option>`).join('')}</select>`:''}</div>${canEditIdentity?`<div style="margin-top:10px"><button type="button" class="btn alt small" data-action="edit-member" data-id="${safe(m.user_id)}">${ic('settings','sm')} ${m.user_id===store.user?.id?'Edit My Profile':'Edit Member'}</button></div>`:''}<div class="member-team"><label class="small-text muted">Team</label>${mayChange?`<input data-team-user="${safe(m.user_id)}" value="${safe(m.team_name||'General')}" maxlength="60" aria-label="Team ${safe(u.full_name)}"/>`:`<strong>${safe(m.team_name||'General')}</strong>`}</div></div></div>`;
 }).join('')}</div>${manage?`<div class="card panel-pad" style="margin-top:18px"><div class="flex between acenter gap12 wrap"><div><h3 class="section-title">Invite team members</h3><p class="small-text muted" style="margin-top:8px">User baru bergabung sebagai Officer dan dapat diubah role maupun team-nya oleh Manager.</p></div>${button(ic('mail')+' Invitation Code','invite','alt')}</div></div>`:''}`;
}
function settings(){return pageHead('CONTROL CENTER','Workspace Settings','Manage your workspace, projects, categories, and profile.')+`<div class="setting-grid"><section class="card setting-block"><h3>Workspace</h3><p>Your active workspace and project environment.</p><div class="field"><label>Current workspace</label><select id="settingsWorkspace" data-change="switch-workspace">${S.workspaces.map(w=>`<option value="${safe(w.id)}" ${w.id===S.workspaceId?'selected':''}>${safe(w.name)}</option>`).join('')}</select></div><div style="margin-top:17px">${button(ic('plus')+' Create workspace','create-workspace','alt')}</div>${isOwner()&&workspace()?.created_by===store.user?.id?`<div class="workspace-danger-zone"><p>Delete Workspace menghapus seluruh Project, Work Item, Archive, checklist, komentar, dan akses anggota secara permanen.</p>${button(ic('trash','sm')+' Delete Workspace','delete-workspace','danger')}</div>`:''}</section>
 <section class="card setting-block"><h3>My Profile</h3><p>Update your personal information and work identity.</p><div class="flex acenter gap12">${avatar(S.profile?.full_name||'?','gold')}<div><strong style="color:var(--forest)">${safe(S.profile?.full_name||'User')}</strong><p style="margin:4px 0 0">${safe(S.profile?.email||'')}</p></div></div><div style="margin-top:17px">${button('Edit profile','profile','alt')}</div></section>
 <section class="card setting-block"><h3>Projects <span class="badge status-not">${S.projects.length}</span></h3><p>Organize work items by projects and programs.</p><div class="project-management-list">${sortedManagementItems('project').map(p=>`<div class="project-management-row" data-management-type="project" data-management-id="${safe(p.id)}"><span class="management-drag-grip" draggable="true" tabindex="0" role="button" data-management-grip data-type="project" data-id="${safe(p.id)}" aria-label="Drag untuk mengurutkan Project ${safe(p.name)}" title="Tarik untuk mengurutkan Project">⠿</span><span class="project-swatch" style="background:${safeColor(p.color)}"></span><div class="project-management-info"><strong title="${safe(p.name)}">${safe(p.name)}</strong><small>${S.tasks.filter(t=>inProject(t,p.id)).length} Work Items</small></div><div class="project-management-actions"><button type="button" class="icon-btn" data-action="rename-project" data-id="${safe(p.id)}" title="Rename Project ${safe(p.name)}" aria-label="Rename Project">${ic('settings','sm')}</button>${canArchiveProject(p)?`<button type="button" class="icon-btn" data-action="archive-project" data-id="${safe(p.id)}" title="Archive Project ${safe(p.name)}" aria-label="Archive Project">${ic('folder','sm')}</button>`:''}</div></div>`).join('')||'<p class="small-text muted">Belum ada Project.</p>'}</div><div style="margin-top:18px">${canEdit()?button(ic('plus')+' Add project','new-project','alt'):''}</div></section>
 <section class="card setting-block"><h3>Categories <span class="badge status-not">${S.categories.length}</span></h3><p>Define a consistent task classification framework.</p><div class="project-management-list category-management-list">${sortedManagementItems('category').map(c=>`<div class="project-management-row" data-management-type="category" data-management-id="${safe(c.id)}"><span class="management-drag-grip" draggable="true" tabindex="0" role="button" data-management-grip data-type="category" data-id="${safe(c.id)}" aria-label="Drag untuk mengurutkan Category ${safe(c.name)}" title="Tarik untuk mengurutkan Category">⠿</span><span class="project-swatch" style="background:${safeColor(c.color)}"></span><div class="project-management-info"><strong title="${safe(c.name)}">${safe(c.name)}</strong><small>${S.tasks.filter(t=>t.category_id===c.id).length} Work Items</small></div><div class="project-management-actions"><button type="button" class="icon-btn" data-action="edit-category" data-id="${safe(c.id)}" title="Edit Category ${safe(c.name)}" aria-label="Edit Category">${ic('settings','sm')}</button>${canManage()?`<button type="button" class="icon-btn chip-delete" data-action="delete-category" data-id="${safe(c.id)}" title="Delete Category ${safe(c.name)}" aria-label="Delete Category">${ic('trash','sm')}</button>`:''}</div></div>`).join('')||'<p class="small-text muted">Belum ada Category.</p>'}</div><div style="margin-top:18px">${canEdit()?button(ic('plus')+' Add category','new-category','alt'):''}</div></section>
 <section class="card setting-block"><h3>Timeline & Schedule</h3><p>Open time-based planning, Gantt tracking, or the team calendar.</p><div class="flex gap8 wrap">${button(ic('gantt')+' Timeline / Gantt','nav-gantt','alt')}${button(ic('calendar')+' Calendar','nav-calendar','alt')}</div></section>
 <section class="card setting-block"><h3>Team Access</h3><p>Control who has access to your workspace and their roles.</p>${button(ic('team')+' Manage members','nav-team','alt')}${canManage()?`<div style="margin-top:12px">${button(ic('copy')+' Invite by code','invite','alt')}</div>`:''}</section>
 <section class="card setting-block"><h3>Data & Deployment</h3><p>${isConnected?'Your data is stored in Supabase and protected by database Row Level Security.':'This workspace uses browser localStorage demo data. Other devices do not share these tasks.'}</p>${button(ic('download')+' Export tasks CSV','export-csv','alt')}<div style="margin-top:10px">${button(ic('download')+' Download Laporan','download-report','alt')}${button(ic('download')+' Simpan PDF','print-report','alt')}</div>${!isConnected?`<div style="margin-top:12px">${button(ic('refresh')+' Reset sample data','reset-demo','flat')}</div>`:''}</section></div>`;
}
function archiveView(){
 const projects=S.archivedProjects||[],tasks=S.archivedTasks||[];
 return pageHead('RECORDS','Archive','Restore archived data or permanently delete it with Manager approval.')+
 `<section class="card panel-pad" style="margin-bottom:16px"><h3 class="section-title">Archived Projects (${projects.length})</h3>
 <p class="small-text muted">Menghapus Project secara permanen akan menghilangkan relasinya dari Work Items. Work Items sendiri tetap tersimpan.</p>
 <div class="archive-list">${projects.map(p=>`<div class="archive-entry"><strong>${safe(p.name)}</strong><div class="archive-actions">
 ${canArchiveProject(p)?`<button type="button" class="btn alt small" data-action="restore-project" data-id="${safe(p.id)}">Restore Project</button>`:''}
 ${canManage()?`<button type="button" class="btn danger small" data-action="permanent-delete-project" data-id="${safe(p.id)}">Delete Permanently</button>`:''}
 </div></div>`).join('')||'<p class="muted">No archived Projects.</p>'}</div></section>
 <section class="card panel-pad"><h3 class="section-title">Archived Work Items (${tasks.length})</h3>
 <div class="archive-list">${tasks.map(t=>`<div class="archive-entry"><button type="button" class="archive-preview-link" data-action="view-archived-task" data-id="${safe(t.id)}" title="View archived Work Item"><strong>${safe(t.title)}</strong><span>${safe(t.status)} · View details</span></button><div class="archive-actions">
 ${canArchiveTask(t)?`<button type="button" class="btn alt small" data-action="restore-task" data-id="${safe(t.id)}">Restore Work Item</button>`:''}
 ${canManage()?`<button type="button" class="btn danger small" data-action="permanent-delete-task" data-id="${safe(t.id)}">Delete Permanently</button>`:''}
 </div></div>`).join('')||'<p class="muted">No archived Work Items.</p>'}</div></section>`;
}
function layout(){const m={Dashboard:dashboard,Board:board,Grid:grid,Gantt:gantt,Calendar:calendar,Archive:archiveView,Team:team,Settings:settings};return `<div class="app-shell">${sideBar()}<main class="workspace-main">${topBar()}${!isConnected?`<div class="demo-strip">${ic('warning','sm')}<span><b>DEMO MODE</b> · Data tersimpan di browser ini. Hubungkan Supabase untuk akun dan kolaborasi sungguhan.</span></div>`:''}<div class="content" id="view-content">${(m[S.view]||dashboard)()}</div></main><nav class="mobile-nav">${mobileLink('Dashboard','Home','dashboard')}${mobileLink('Board','Board','board')}${mobileLink('Grid','Tasks','grid')}${mobileLink('Calendar','Calendar','calendar')}${mobileLink('Archive','Archive','folder')}${mobileLink('Settings','More','settings')}</nav></div><div id="modal-root"></div>`}
function renderContent(){const el=$('#view-content');if(el){const f=document.activeElement?.id==='globalSearch';el.innerHTML=({Dashboard:dashboard,Board:board,Grid:grid,Gantt:gantt,Calendar:calendar,Archive:archiveView,Team:team,Settings:settings}[S.view]||dashboard)();if(f)$('#globalSearch')?.focus();applyDashboardLayout();}else render();}
function render(){if(!S.isReady){root.innerHTML='<div class="splash"><img src="/icon.svg" width="60" height="60" alt=""/>WorkFlow Planner</div>';return;}if(isConnected&&!store.user){root.innerHTML=authScreen();return;}if(!S.workspaceId){root.innerHTML=onboarding();return;}root.innerHTML=layout();applyDashboardLayout();drawModal();}
function authScreen(){return `<div class="auth-screen"><div class="auth-hero"><div class="brand" style="padding:0">${ic('logo','xl')}<span>WorkFlow<span class="brand-sub">PLANNER</span></span></div><div><h1>Great work starts with <em>great planning.</em></h1><p>Manage your tasks, team, timelines, and approvals in one workspace.</p></div><small>PLAN. EXECUTE. MONITOR. DELIVER.</small></div><div class="auth-panel"><div class="auth-form"><div class="page-eyebrow">WORKFLOW PLANNER V1.7.8</div><h2>${S.authTab==='signup'?'Create an account':'Welcome back'}</h2><p>${S.authTab==='signup'?'Register with a unique username and verified email.':'Login using username or existing email address.'}</p><form id="authForm">${S.authTab==='signup'?`${formField('Full Name','full_name','','text','required maxlength="100"')}${formField('Username','username','','text','required minlength="3" maxlength="30" pattern="[a-z][a-z0-9_]{2,29}" placeholder="nama_pengguna" title="Huruf kecil, angka, underscore; dimulai huruf"')}${formField('Email Address','email','','email','required autocomplete="email"')}`:formField('Username or Email','identifier','','text','required autocomplete="username" placeholder="username atau email"')}${formField('Password','password','','password',`required minlength="6" autocomplete="${S.authTab==='login'?'current-password':'new-password'}"`)}<button type="submit" class="btn block" style="margin-top:15px">${S.authTab==='signup'?'Create account':'Sign in'} ${ic('right','sm')}</button></form><div class="auth-extra">${S.authTab==='signup'?'Already have an account?':'New to WorkFlow?'} <button class="link-btn" data-action="auth-toggle">${S.authTab==='signup'?'Sign in':'Create account'}</button></div><div class="auth-demo"><p class="small-text muted">${button('Open Demo Preview','demo-preview','flat')}</p></div></div></div></div>`}
function onboarding(){return `<div class="onboarding"><div class="card onboarding-card"><div class="page-eyebrow">GET STARTED</div><h2>Create or join a workspace</h2><p>Start a new workspace for your projects, or enter an invitation code shared by your workspace administrator.</p><form id="workspaceForm" class="stack"><div class="field"><label>Workspace name</label><input name="name" placeholder="e.g. Strategic PMO" maxlength="120" minlength="2" required/></div><button class="btn" type="submit">${ic('plus','sm')} Create workspace</button></form><div class="separator" style="margin:25px 0"></div><form id="joinForm" class="stack"><div class="field"><label>Invitation code</label><input name="code" placeholder="12-character code" maxlength="12" required value="${safe(S.pendingJoin)}"/></div><button type="submit" class="btn alt">${ic('team','sm')} Join existing workspace</button></form>${S.workspaces.length?`<div class="separator"></div><h3 style="margin-bottom:10px">Your workspaces</h3><div class="workspace-switcher">${S.workspaces.map(w=>`<button class="workspace-choice" data-action="select-workspace" data-id="${safe(w.id)}">${safe(w.name)}</button>`).join('')}</div>`:''}<div style="margin-top:22px">${button('Sign out','logout','flat')}</div></div></div>`}
function formField(label,name,value='',type='text',extra=''){return `<div class="field"><label>${safe(label)}</label><input type="${type}" name="${name}" value="${safe(value)}" ${extra}/></div>`}
function formSelect(label,name,options,selected=''){return `<div class="field"><label>${safe(label)}</label><select name="${name}">${options.map(o=>`<option value="${safe(o.value)}" ${String(o.value)===String(selected||'')?'selected':''}>${safe(o.label)}</option>`).join('')}</select></div>`}

function mentionSuggestionMarkup(){
 const candidates=mentionCandidates(S.commentDraft,S.commentCaret,S.people.filter(p=>S.members.some(m=>m.user_id===p.id)));
 return candidates.map(p=>`<button type="button" class="mention-choice" data-action="pick-mention" data-id="${safe(p.id)}">${avatar(p.full_name)}<span><b>${safe(p.full_name)}</b><small>@${safe(p.username)}</small></span></button>`).join('');
}
function checklistPanel(task,readonly){
 
 if(!task?.id){
  const total=S.draftChecklist.length,done=S.draftChecklist.filter(x=>x.is_done).length;
  return `<section class="task-checklist"><div class="flex between acenter"><h3>Checklist</h3><span class="small-text muted">${done}/${total} completed · akan tersimpan bersama Work Item</span></div>
   <div class="checklist-track"><div style="width:${total?Math.round(done/total*100):0}%"></div></div>
   <div class="checklist-rows">${total?S.draftChecklist.map(x=>`<div class="checklist-row"><label><input type="checkbox" data-checklist-toggle="${safe(x.id)}" ${x.is_done?'checked':''}/><span class="${x.is_done?'checked':''}">${safe(x.title)}</span></label><button type="button" class="icon-btn checklist-delete" data-action="delete-checklist" data-id="${safe(x.id)}" aria-label="Hapus langkah checklist">${ic('trash','sm')}</button></div>`).join(''):'<p class="small-text muted">Tambahkan checklist sebelum menyimpan Work Item.</p>'}</div>
   <div class="checklist-add"><input type="text" maxlength="250" id="checklistInput" placeholder="Tambah langkah checklist..." /><button type="button" class="btn alt small" data-action="add-checklist">+ Add</button></div>
  </section>`;
 }
 const done=S.checklistItems.filter(x=>x.is_done).length,total=S.checklistItems.length;
 const progress=total?Math.round(done/total*100):0;
 return `<section class="task-checklist"><div class="flex between acenter"><h3>Checklist</h3><span class="small-text muted">${done}/${total} completed</span></div>
 <div class="checklist-track"><div style="width:${progress}%"></div></div>
 <div class="checklist-rows">${S.checklistLoading?'<p class="small-text muted">Memuat checklist…</p>':total?S.checklistItems.map(item=>`<div class="checklist-row"><label><input type="checkbox" data-checklist-toggle="${safe(item.id)}" ${item.is_done?'checked':''} ${readonly?'disabled':''}/><span class="${item.is_done?'checked':''}">${safe(item.title)}</span></label>${!readonly?`<button type="button" class="icon-btn checklist-delete" data-action="delete-checklist" data-id="${safe(item.id)}" aria-label="Hapus checklist ${safe(item.title)}">${ic('trash','sm')}</button>`:''}</div>`).join(''):'<p class="small-text muted">Tambahkan langkah untuk menyelesaikan pekerjaan ini.</p>'}</div>
 ${!readonly?`<div class="checklist-add"><input type="text" maxlength="250" id="checklistInput" placeholder="Tambah langkah checklist..." /><button type="button" class="btn alt small" data-action="add-checklist">+ Add</button></div>`:''}
 </section>`;
}
async function loadTaskChecklist(taskId){
 S.checklistLoading=true;S.checklistItems=[];
 try{const items=await store.listTaskChecklist(taskId);if(['task','archivedTask'].includes(S.modal)&&S.modalTask?.id===taskId){S.checklistItems=items;S.checklistLoading=false;const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(S.modalTask,!canEditTask(S.modalTask));}}
 catch(err){S.checklistLoading=false;toast('Checklist gagal dimuat: '+err.message,'error');}
}
function commentsPanel(){
 const t=S.modalTask;
 if(!t?.id)return '<p class="small-text muted">Simpan Work Item terlebih dahulu untuk memulai komentar.</p>';
 return `<section class="discussion-panel"><div class="comment-list" aria-live="polite">${S.commentLoading?'<p class="muted">Memuat komentar…</p>':S.taskComments.length?S.taskComments.map(c=>`<article class="comment-entry">${avatar(nameOf(c.author_id))}<div class="comment-main"><div class="comment-header"><strong>${safe(nameOf(c.author_id))}</strong><time>${safe(new Date(c.created_at).toLocaleString('id-ID'))}</time></div><div class="comment-body">${formattedCommentBody(c.body)}</div></div></article>`).join(''):'<p class="muted">Belum ada komentar. Mulai diskusi atau mention anggota menggunakan @username.</p>'}</div><form id="commentForm" ${t.archived_at?'hidden':''}><div class="comment-compose"><label for="commentBody">Tulis komentar</label><textarea id="commentBody" name="body" rows="4" minlength="1" maxlength="5000" required placeholder="Tulis pesan… ketik @ untuk mention anggota">${safe(S.commentDraft)}</textarea><div class="mention-suggestions" id="mention-suggestions" ${mentionSuggestionMarkup()?'':'hidden'}>${mentionSuggestionMarkup()}</div><small>@mention akan mengirim notifikasi kepada anggota terkait; penanggung jawab dan pembuat tugas juga mendapat notifikasi komentar.</small></div><div style="margin-top:12px;text-align:right"><button type="submit" class="btn">Kirim Komentar</button></div></form></section>`;
}
function taskDetailContent(){
 return `<div class="task-detail-layout ${S.chatOpen?'chat-open':''}"><div class="task-detail-main">
 <div class="task-detail-tabs"><span class="task-tab active">Work Item Details</span><button type="button" class="task-tab task-chat-toggle ${S.chatOpen?'active':''}" data-action="task-tab" data-tab="comments" aria-expanded="${S.chatOpen}" aria-controls="task-chat-panel">Task Chat ${S.taskComments.length?'<span class="task-tab-count">'+S.taskComments.length+'</span>':''} ${ic('mail','sm')}</button></div>
 ${S.modalTask?.archived_at?'<p class="archive-preview-notice">Archived Work Item · Read-only preview. Restore to make changes.</p>':''}${taskModal()}</div>
 <aside class="task-chat-aside" id="task-chat-panel" aria-label="Task Chat"><div class="task-chat-heading"><strong>Task Chat</strong><button type="button" class="icon-btn" data-action="close-chat" aria-label="Tutup Task Chat">${ic('x','sm')}</button></div>${commentsPanel()}</aside>
 </div>`;
}
async function loadTaskComments(taskId){
 S.commentLoading=true;
 try{const comments=await store.listTaskComments(taskId);
   if(['task','archivedTask'].includes(S.modal)&&S.modalTask?.id===taskId){S.taskComments=comments;S.commentLoading=false;const panel=$('#task-chat-panel .discussion-panel');if(panel)panel.outerHTML=commentsPanel();}
 }catch(err){S.commentLoading=false;console.error(err);toast('Tidak bisa memuat komentar: '+err.message,'error');}
}
async function refreshNotices(){
 if(!store.user||!S.workspaceId)return;
 const ws=S.workspaceId;
 try{const notices=await store.listNotifications(ws);if(ws!==S.workspaceId)return;S.noticeItems=notices;
   const badge=$('#notice-count');if(badge){const count=notices.filter(n=>!n.is_read).length;badge.textContent=String(count);badge.hidden=!count;}
   const pop=$('#notice-pop');if(pop)pop.outerHTML=renderNotification();
 }catch(err){console.warn('Notification refresh:',err.message);}
}
function attachmentRow(url='',name='',editable=true){
 const link=String(url||'');
 const title=String(name||'').trim()||'Attachment Link';
 const open=validAttachment(link)&&link?`<a class="attachment-named-link" href="${safe(link)}" target="_blank" rel="noopener noreferrer" title="${safe(link)}">${ic('folder','sm')} ${safe(title)}</a>`:'';
 return `<div class="attachment-link-row attachment-named-row" data-attachment-row>
 ${editable?`<div class="attachment-input-stack">
   <label class="attachment-field-label">Link Name<input data-attachment-name type="text" maxlength="120" value="${safe(title==='Attachment Link'?'':title)}" placeholder="Contoh: Dokumen SOP Final" aria-label="Attachment Link Name"/></label>
   <label class="attachment-field-label">Attachment Link (HTTPS)<input data-attachment-input type="url" inputmode="url" maxlength="2048" value="${safe(link)}" placeholder="https://drive.google.com/..." aria-label="Attachment URL (HTTPS)"/></label>
  </div>`:`<div class="attachment-readonly-name">${open||`<span>${safe(title)}</span>`}</div>`}
 ${editable&&open?`<div class="attachment-preview">Tautan tersimpan: ${open}</div>`:''}
 ${editable?`<button type="button" class="btn alt small attachment-remove" data-action="remove-attachment" aria-label="Hapus attachment link">${ic('trash','sm')} Hapus</button>`:''}
 </div>`;
}
function attachmentCanChange(task,selectedStatus=task?.status){
 return !task?.archived_at && canEditTask(task) && selectedStatus==='In Progress' && (!task?.id || task.status==='In Progress');
}
function taskModal(){
 const t=S.modalTask||{},ro=!canEditTask(t)||!!t.archived_at,isPending=!!t.completion_requested_at&&t.status!=='Completed';
  const attachmentLinks=t.attachment_urls??(t.attachment_url?[t.attachment_url]:[]);
  const attachmentNames=Array.isArray(t.attachment_names)?t.attachment_names:[];
  const attachmentEditable=attachmentCanChange(t,t.status||'Not Started');
 const opts=(data,name,empty,key)=>formSelect(name==='project_id'?'Project':name==='category_id'?'Category':name==='assigned_by'?'Assigned By':'Assigned To',name,[{value:'',label:empty},...data.map(x=>({value:x.id,label:x[key]}))],t[name]||(name==='assigned_by'&&!t.id?store.user?.id:'')||'');
 const statuses=STATUSES.map(x=>({value:x,label:x==='Completed'&&!canApprove()?'Completed — Request Manager Approval':x}));
 return `<form id="taskForm" class="stack"><fieldset class="task-fields" ${ro?'disabled':''}>
 <div class="field"><label>Work Item <span class="required">*</span></label><input name="title" required maxlength="300" value="${safe(t.title||'')}" placeholder="What needs to be accomplished?"/></div>
 <div class="field-row">${opts(S.people,'assigned_to','Unassigned','full_name')}${opts(S.people,'assigned_by','Not specified','full_name')}</div>
 <div class="field-row">${opts(S.categories,'category_id','No category','name')}</div>
  <div class="field-row"><div class="field"><label>Projects <span class="small-text muted">(pilih satu atau lebih)</span></label><input type="hidden" name="project_id" value="${safe(t.project_id||'')}"/><div class="multi-project-picker" role="group" aria-label="Pilih Projects">${S.projects.map(p=>`<label class="project-check"><input type="checkbox" name="project_ids" value="${safe(p.id)}" ${projectIds(t).includes(p.id)?'checked':''}/><span class="project-swatch" style="background:${safeColor(p.color)}"></span><span>${safe(p.name)}</span></label>`).join('')||'<span class="small-text muted">Create a Project from Settings first.</span>'}</div><small>Work Item dapat terhubung ke maksimal 20 Project.</small></div>${formSelect('Status Progress','status',statuses,t.status||'Not Started')}</div>
 <div class="field-row">${formSelect('Priority','priority',PRIORITIES.map(x=>({value:x,label:x})),t.priority||'Medium')}${formField('Start Date','start_date',t.start_date||(t.id?'':today()),'date')}</div>
 <div class="field-row">${formField('Due Date','due_date',t.due_date||'','date',t.id&&t.due_date&&!canReviewDueDate()?'readonly aria-readonly="true"':'')}${t.id&&t.due_date&&!canReviewDueDate()&&(t.assigned_to===store.user?.id||t.created_by===store.user?.id)?`<button type="button" class="btn alt small" data-action="request-due-date">Request Due Date Change</button>`:''}${formField('Key Stakeholders','stakeholders',t.stakeholders||'','text','maxlength="500"')}</div>
 <div class="field"><label>Notes</label><textarea name="notes" rows="4" placeholder="Background, deliverables, next steps...">${safe(t.notes||'')}</textarea></div>
 <div id="checklist-section">${checklistPanel(t,ro)}</div>
 <div class="field" data-attachment-section ${(t.status==='In Progress'||attachmentLinks.length)?'':'hidden'}>
  <label>Attachment Links (HTTPS)</label>
  <div data-attachment-editor ${attachmentEditable?'':'hidden'}>
   <div id="attachment-link-list" class="attachment-link-list">${attachmentLinks.map((url,i)=>attachmentRow(url,attachmentNames[i]||('Attachment '+(i+1)),true)).join('')}</div>
   <button type="button" class="btn alt small" data-action="add-attachment">${ic('plus','sm')} Add Link</button>
   <small>Tambah atau hapus tautan HTTPS ketika status <b>In Progress</b>, lalu klik Save Work Item (maksimal 20 tautan).</small>
  </div>
  <div data-attachment-viewer ${attachmentEditable?'hidden':''}>
   <div class="attachment-link-list">${attachmentLinks.map((url,i)=>attachmentRow(url,attachmentNames[i]||('Attachment '+(i+1)),false)).join('')||'<p class="small-text muted">Belum ada attachment.</p>'}</div>
   <small>Link tetap bisa dibuka. Penambahan, perubahan, dan penghapusan hanya boleh pada tugas yang masih In Progress.</small>
  </div>
 </div>
 </fieldset>${isPending?`<div class="approval-notice">${ic('clock','sm')} <b>Completed diajukan</b> oleh ${safe(nameOf(t.completion_requested_by))} · ${safe(dateLabel(t.completion_requested_at))}. Menunggu persetujuan Manager.</div>`:''}
 ${t.completion_feedback?`<div class="notice-box"><strong>Manager Feedback:</strong> ${safe(t.completion_feedback)}</div>`:''}
 ${t.id&&t.status==='Completed'&&t.completion_approved_by?`<div class="notice-box">Completed disetujui oleh ${safe(nameOf(t.completion_approved_by))} pada ${safe(dateLabel(t.completed_at))}.</div>`:''}
 ${t.id?`<p class="small-text muted">Created ${safe(dateLabel(t.created_at))} · Updated ${safe(dateLabel(t.updated_at))}</p>`:''}</form>`;
}
function inviteModal(){return `<div class="stack"><p class="small-text muted" style="line-height:1.7">Bagi kode undangan berikut kepada calon anggota. Mereka membuat akun menggunakan email sendiri, lalu memilih <b>Join existing workspace</b> dan memasukkan kode.</p><div class="field"><label>Workspace</label><input value="${safe(workspace()?.name||'')}" readonly/></div><div class="field"><label>Invitation Code</label><div class="code-display">${safe(workspace()?.join_code||'') }<button class="icon-btn" data-action="copy-code" title="Copy invitation code">${ic('copy')}</button></div></div>${!isConnected?`<div class="notice-box">Mode demo: kode ini hanya contoh. Hubungkan Supabase untuk undangan nyata antar akun.</div>`:`<div class="notice-box">Siapa pun yang memiliki kode dapat bergabung sebagai Officer. Bagikan secara privat dan ganti kode jika tersebar.</div>`}</div>`}
function profileModal(){return `<form id="profileForm" class="stack">${formField('Username','username',S.profile?.username||'','text','required minlength="3" maxlength="30" pattern="[a-z][a-z0-9_]{2,29}" placeholder="nama_pengguna"')}${formField('Full Name','full_name',S.profile?.full_name||'','text','required maxlength="100"')}${formField('Job Title / Position','job_title',S.profile?.job_title||'','text','maxlength="120"')}<div class="field"><label>Email</label><input value="${safe(S.profile?.email||'')}" readonly/><small>Email mengikuti akun autentikasi dan tidak diubah di sini.</small></div></form>`}
function editMemberModal(){
 const m=S.members.find(x=>x.user_id===S.modalMemberId),u=S.people.find(x=>x.id===S.modalMemberId);
 if(!m||!u||!canManage())return '<p>Member not found or insufficient permission.</p>';
 return `<form id="memberForm" class="stack">
 ${formField('Nama Member','full_name',u.full_name||'','text','required minlength="2" maxlength="100"')}
 ${formField('Job / Position','job_title',u.job_title||'','text','maxlength="120"')}
 <p class="small-text muted">Perubahan nama dan jabatan berlaku pada workspace ini saja. Email, username, login, dan profil di workspace lain tidak berubah.</p></form>`;
}
function reportTargetField(){
 const types={user:S.people,project:S.projects,category:S.categories};
 const type=S.reportType,items=types[type];
 if(!items)return '<p class="small-text muted">All Work Items dalam workspace saat ini akan dimasukkan ke laporan.</p>';
 const label=type==='user'?'Member':type==='project'?'Project':'Category';
 return `<div class="field"><label>Pilih ${label}</label><select name="report_id" id="reportId" required><option value="">-- Pilih ${label} --</option>${items.map(item=>`<option value="${safe(item.id)}" ${item.id===S.reportId?'selected':''}>${safe(type==='user'?item.full_name:item.name)}</option>`).join('')}</select></div>`;
}
function ganttExportModal(){
 const begin=S.ganttStart,finish=plusDays(begin,S.ganttDays-1);
 const year1=Number(begin.slice(0,4)),year2=Number(finish.slice(0,4));
 return `<form id="ganttExportForm" class="stack">
  <p class="small-text muted">Ekspor Timeline / Gantt lengkap dengan urutan Project, Work Item, dan bar durasi pekerjaan. Laporan berdasarkan semua Work Items aktif dalam workspace, bukan hanya yang sedang terlihat pada layar.</p>
  <div class="field"><label>Format download</label><select name="format" required><option value="pdf">PDF — visual Timeline/Gantt</option><option value="xlsx">Excel (.xlsx) — Gantt dengan kolom periode dan bar warna</option></select></div>
  <div class="field"><label>Project</label><select name="projectId"><option value="">All Projects</option>${S.projects.map(p=>`<option value="${safe(p.id)}">${safe(p.name)}</option>`).join('')}</select></div>
  <div class="field"><label>Jenis periode</label><select name="rangeType" data-change="gantt-export-period"><option value="dates">Rentang tanggal</option><option value="years">Rentang tahun (tahun penuh)</option></select></div>
  <div class="gantt-export-period" data-gantt-period="dates">
   <div class="gantt-export-period-grid">
    ${formField('Tanggal mulai','startDate',begin,'date','required')}
    ${formField('Tanggal akhir','endDate',finish,'date','required')}
   </div>
  </div>
  <div class="gantt-export-period" data-gantt-period="years" hidden>
   <div class="gantt-export-period-grid">
    ${formField('Tahun mulai','startYear',year1,'number','min="2000" max="2100" disabled')}
    ${formField('Tahun akhir','endYear',year2,'number','min="2000" max="2100" disabled')}
   </div>
  </div>
  <small>Rentang maksimal 10 tahun. Jika rentang panjang, interval disesuaikan menjadi mingguan/bulanan. Work Item yang beririsan dengan rentang dipertahankan dalam laporan.</small>
 </form>`;
}
function reportModal(){
 return `<form id="reportForm" class="stack">
 <p class="small-text muted">Satu berkas PDF berisi 6 KPI, Timeline/Gantt, dan Grid seluruh Work Item sesuai filter.</p>
 <div class="field"><label>Laporan berdasarkan</label><select name="report_scope" data-change="report-scope"><option value="all" ${S.reportType==='all'?'selected':''}>All Work Items</option><option value="user" ${S.reportType==='user'?'selected':''}>User / Member</option><option value="project" ${S.reportType==='project'?'selected':''}>Project</option><option value="category" ${S.reportType==='category'?'selected':''}>Categories</option></select></div>
 <div id="reportTargetField">${reportTargetField()}</div>
 <div class="notice-box">KPI: Total Work Items, In Progress, On Hold, Completed, Pending Approval dan Overdue Tasks. Jadwal ditampilkan sebagai Gantt dan daftar Grid dalam PDF yang sama.</div>
 </form>`;
}
function createWorkspaceModal(){return `<form id="workspaceModalForm" class="stack">${formField('Workspace name','name','','text','required minlength="2" maxlength="120" placeholder="Example: Operations PMO"')}<p class="small-text muted">Setiap workspace memiliki proyek, kategori, tugas dan anggota tersendiri.</p></form>`}
function colorPickerMarkup(color){
 const hex=safeColor(color);
 return `<div class="field color-editor" data-color-editor>
  <label>Warna Project / Category (HEX atau RGB)</label>
  <div class="color-editor-controls">
    <input type="color" name="color" value="${safe(hex)}" data-color-swatch aria-label="Pilih warna dari palet"/>
    <div class="color-editor-number"><span>HEX</span><input type="text" data-color-hex value="${safe(hex)}" maxlength="7" spellcheck="false" placeholder="#3F6276" aria-label="Kode warna HEX"/></div>
    <div class="color-editor-number"><span>RGB</span><input type="text" data-color-rgb value="${safe(colorToRGB(hex))}" maxlength="20" spellcheck="false" placeholder="63, 98, 118" aria-label="Nilai warna RGB"/></div>
  </div><small>Pilih warna atau masukkan HEX (#RRGGBB) atau RGB (R, G, B). Semua nilai akan tersinkronisasi.</small>
 </div>`;
}
function updateColorEditor(target){
 const editor=target?.closest?.('[data-color-editor]');if(!editor)return;
 const swatch=editor.querySelector('[data-color-swatch]'),hex=editor.querySelector('[data-color-hex]'),rgb=editor.querySelector('[data-color-rgb]');
 let next;
 try{next=target===swatch?parseUserColor(swatch.value):parseUserColor(target.value);}catch{
  target.setCustomValidity?.('Masukkan warna HEX atau RGB yang valid.');target.setAttribute?.('aria-invalid','true');return;
 }
 target.setCustomValidity?.('');target.removeAttribute?.('aria-invalid');
 swatch.value=next;hex.value=next.toUpperCase();rgb.value=colorToRGB(next);
 for(const el of [swatch,hex,rgb]){el.setCustomValidity?.('');el.removeAttribute?.('aria-invalid');}
}
function formColor(form){
 const editor=form.querySelector?.('[data-color-editor]');
 if(!editor)return safeColor(form.elements?.color?.value);
 const hex=editor.querySelector('[data-color-hex]');
 const rgb=editor.querySelector('[data-color-rgb]');
 const chosen=parseUserColor(hex.value);
 if(parseUserColor(rgb.value)!==chosen)throw Error('Kode HEX dan RGB berbeda. Periksa kembali pilihan warna.');
 return chosen;
}
function createNamedModal(kind){return `<form id="${kind==='project'?'projectForm':'categoryForm'}" class="stack">${formField(kind==='project'?'Project Name':'Category Name','name','','text',`required maxlength="${kind==='project'?120:80}" placeholder="Name"`)}${colorPickerMarkup(kind==='project'?'#3f6276':'#c89b55')}</form>`}
function editCategoryModal(){
 const c=S.categories.find(x=>x.id===S.categoryToEdit);
 return `<form id="editCategoryForm" class="stack">
 ${formField('Category Name','name',c?.name||'','text','required minlength="2" maxlength="80"')}
 ${colorPickerMarkup(c?.color||'#3f6276')}
 <p class="small-text muted">Nama dan warna baru berlaku pada semua Work Item yang menggunakan Category ini.</p>
 </form>`;
}
function projectRenameModal(){const p=S.projects.find(x=>x.id===S.projectToRename);return `<form id="renameProjectForm" class="stack">${formField('Project Name','name',p?.name||'','text','required minlength="2" maxlength="120"')}${colorPickerMarkup(p?.color||'#3f6276')}<p class="muted">Existing Work Items remain linked to this Project.</p></form>`;}
function dueDateRequestModal(){const t=S.dueRequestTask;return `<form id="dueDateRequestForm" class="stack"><div class="notice-box">Current Due Date: <b>${safe(dateLabel(t?.due_date))}</b>. Manager or Assistant Manager approval is required.</div>${formField('Proposed Due Date','proposed_due_date','','date','required')}<div class="field"><label>Reason</label><textarea name="reason" required minlength="5" maxlength="1000" rows="4" placeholder="Explain reason for change"></textarea></div></form>`;}
function switchModal(){return `<div class="stack"><p class="small-text muted">Select a workspace to switch projects, tasks, and team.</p><div class="workspace-switcher">${S.workspaces.map(w=>`<button class="workspace-choice ${S.workspaceId===w.id?'selected':''}" data-action="select-workspace" data-id="${safe(w.id)}">${safe(w.name)}</button>`).join('')}</div>${button(ic('plus')+' New Workspace','create-workspace','alt')}</div>`}
function drawModal(){const el=$('#modal-root');if(!el)return;if(!S.modal){el.innerHTML='';return;}const def={task:{title:S.modalTask?.id?'Work Item Details':'Create New Task',content:taskDetailContent(),form:'taskForm',save:'Save Work Item'},archivedTask:{title:'Archived Work Item Details',content:taskDetailContent()},invite:{title:'Invite Team Members',content:inviteModal()},profile:{title:'Edit My Profile',content:profileModal(),form:'profileForm',save:'Save Profile'},member:{title:'Edit Team Member',content:editMemberModal(),form:'memberForm',save:'Save Member'},workspace:{title:'Create Workspace',content:createWorkspaceModal(),form:'workspaceModalForm',save:'Create Workspace'},project:{title:'Add New Project',content:createNamedModal('project'),form:'projectForm',save:'Create Project'},renameProject:{title:'Rename Project',content:projectRenameModal(),form:'renameProjectForm',save:'Save Name'},dueRequest:{title:'Request Due Date Change',content:dueDateRequestModal(),form:'dueDateRequestForm',save:'Submit Request'},category:{title:'Add New Category',content:createNamedModal('category'),form:'categoryForm',save:'Create Category'},editCategory:{title:'Edit Category',content:editCategoryModal(),form:'editCategoryForm',save:'Save Category'},report:{title:'Download Integrated PDF Report',content:reportModal(),form:'reportForm',save:'Download PDF'},ganttExport:{title:'Download Timeline / Gantt',content:ganttExportModal(),form:'ganttExportForm',save:'Download Report'},switch:{title:'Switch Workspace',content:switchModal()}}[S.modal];if(!def)return;
 const buttons=`${S.modal==='task'&&S.modalTask?.id&&canArchiveTask(S.modalTask)?`<button class="btn alt small" type="button" data-action="archive-task">${ic('folder','sm')} Archive</button>`:''}${false?'<span></span>':'<span></span>'}<div class="flex gap8">${S.modal==='invite'&&isConnected?button(ic('refresh','sm')+' Rotate Code','rotate-code','alt'):''}<button class="btn alt" type="button" data-action="close-modal">Close</button>${S.modal==='task'&&S.modalTask?.id&&S.modalTask.completion_requested_at&&canApprove()?`${button(ic('x','sm')+' Reject','reject-completion','alt')}${button(ic('check','sm')+' Approve Completed','approve-completion','primary')}`:''}${S.modal==='task'&&S.modalTask?.id&&!S.modalTask.completion_requested_at&&S.modalTask.status==='In Progress'&&!canApprove()&&canEditTask(S.modalTask)?button('Request Completed','request-completion','alt'):''}${def.form&&!(S.modal==='task'&&!canEditTask(S.modalTask))?`<button type="submit" form="${def.form}" class="btn">${def.save}</button>`:''}</div>`;
 el.innerHTML=`<div class="modal-shade" data-action="close-if-shade"><div class="modal ${['task','archivedTask'].includes(S.modal)?'task-modal':''}" role="dialog" aria-modal="true" aria-label="${safe(def.title)}"><div class="modal-head"><h2>${safe(def.title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></div><div class="modal-body">${def.content}</div><div class="modal-actions">${buttons}</div></div></div>`;
}
function openModal(type,task=null){S.modal=type;S.modalTask=task;S.taskTab='work';S.chatOpen=false;S.checklistItems=[];S.draftChecklist=[];S.checklistLoading=!!task?.id;S.taskComments=[];S.commentDraft='';S.commentCaret=0;S.commentLoading=!!task?.id;drawModal();if(['task','archivedTask'].includes(type)&&task?.id){void loadTaskComments(task.id);void loadTaskChecklist(task.id);}setTimeout(()=>$('#modal-root input[name=title]')?.focus(),0)}
function closeModal(){S.modal=null;S.modalTask=null;drawModal()}
async function refreshWorkspace(){if(!S.workspaceId)return;const w=await store.loadWorkspace(S.workspaceId);Object.assign(S,w);render()}
async function reloadWorkspaces(id=null){S.workspaces=await store.listWorkspaces();S.profile=await store.getProfile();const chosen=id||S.workspaceId;S.workspaceId=S.workspaces.some(w=>w.id===chosen)?chosen:(S.workspaces[0]?.id||null);if(S.workspaceId){Object.assign(S,await store.loadWorkspace(S.workspaceId));}else{S.members=[];S.people=[];S.projects=[];S.archivedProjects=[];S.archivedTasks=[];S.dueDateRequests=[];S.categories=[];S.tasks=[];S.viewPreferences=null;S.managementPositions=[];}S.filter={status:'',priority:'',category:'',assignee:'',assigned_by:'',project:'',projectIds:null};S.projectFilterOpen=false;S.viewFilters={};S.collapsedProjects={Grid:[],Gantt:[]};S.dashboardTeam='';S.dashboardUser='';S.categoryToEdit=null;S.dashboardProject='';S.ganttTeam='';S.ganttUser=store.user?.id||'';S.search='';S.noticeItems=[];render();void refreshNotices();}
async function busy(fn){if(S.busy)return;S.busy=true;try{await fn()}catch(e){console.error(e);toast(e.message||'Something went wrong','error')}finally{S.busy=false}}
async function start(){try{await store.initialize();S.isReady=true;if(isConnected&&!store.user){render();return;}await reloadWorkspaces();}catch(e){console.error(e);S.isReady=true;toast(e.message||'Initialization failed','error');render()}}
function calShift(dir){const d=new Date(S.calendarMonth);if(S.calView==='Year')d.setFullYear(d.getFullYear()+dir);else if(S.calView==='Week')d.setDate(d.getDate()+7*dir);else {d.setDate(1);d.setMonth(d.getMonth()+dir)};return d;}
async function act(action,node){if(S.busy)return;switch(action){
 case 'nav':S.view=node.dataset.view;S.notifications=false;render();window.scrollTo({top:0,behavior:'instant'});break;
 case 'nav-team':S.view='Team';render();break;
 case 'nav-gantt':S.view='Gantt';render();break;
 case 'nav-calendar':S.view='Calendar';render();break;
 case 'notifications':S.notifications=!S.notifications;render();if(S.notifications)void refreshNotices();break;
 case 'task-tab':S.chatOpen=!S.chatOpen;S.taskTab=S.chatOpen?'comments':'work';$('#modal-root .task-detail-layout')?.classList.toggle('chat-open',S.chatOpen);node.setAttribute('aria-expanded',String(S.chatOpen));node.classList.toggle('active',S.chatOpen);break;
 case 'close-chat':S.chatOpen=false;S.taskTab='work';$('#modal-root .task-detail-layout')?.classList.remove('chat-open');$('#modal-root .task-chat-toggle')?.setAttribute('aria-expanded','false');$('#modal-root .task-chat-toggle')?.classList.remove('active');break;
 case 'add-checklist':{if(!canEditTask(S.modalTask))break;const input=$('#checklistInput');const title=input?.value.trim();
   if(!S.modalTask?.id){if(!title)break;if(S.draftChecklist.length>=100){toast('Maksimal 100 langkah per checklist','error');break;}S.draftChecklist.push({id:'draft-'+Date.now()+'-'+S.draftChecklist.length,title,is_done:false});const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(S.modalTask,false);$('#checklistInput')?.focus();break;}if(!title)break;if(S.checklistItems.length>=100){toast('Maksimal 100 langkah per checklist','error');break;}await busy(async()=>{await store.addChecklistItem(S.modalTask,title,S.checklistItems.reduce((m,x)=>Math.max(m,x.position||0),-1)+1);S.checklistItems=await store.listTaskChecklist(S.modalTask.id);const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(S.modalTask,!canEditTask(S.modalTask));$('#checklistInput')?.focus();toast('Checklist ditambahkan')});break;}
 case 'delete-checklist':{if(!canEditTask(S.modalTask))break;if(!S.modalTask?.id){S.draftChecklist=S.draftChecklist.filter(x=>x.id!==node.dataset.id);const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(S.modalTask,false);break;}const item=S.checklistItems.find(c=>c.id===node.dataset.id);if(!item||!confirm('Hapus langkah checklist ini?'))break;await busy(async()=>{await store.deleteChecklistItem(S.modalTask.id,item.id);S.checklistItems=await store.listTaskChecklist(S.modalTask.id);const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(S.modalTask,!canEditTask(S.modalTask));toast('Checklist dihapus')});break;}
 case 'pick-mention':{const p=S.people.find(x=>x.id===node.dataset.id);if(!p?.username)break;const area=$('#commentBody');if(!area)break;const result=insertMention(area.value,area.selectionStart,p.username);area.value=result.text;S.commentDraft=result.text;S.commentCaret=result.caret;area.focus();area.setSelectionRange(result.caret,result.caret);const suggestions=$('#mention-suggestions');if(suggestions){suggestions.innerHTML=mentionSuggestionMarkup();suggestions.hidden=!suggestions.innerHTML;}break;}
 case 'open-notification':{const n=S.noticeItems.find(x=>x.id===node.dataset.id);if(!n)break;await busy(async()=>{if(!n.is_read)await store.markNotificationRead(n.id);S.noticeItems=S.noticeItems.map(x=>x.id===n.id?{...x,is_read:true}:x);S.notifications=false;const task=S.tasks.find(t=>t.id===n.task_id);if(task){openModal('task',{...task});S.taskTab='comments';S.chatOpen=true;}render();});break;}

 case 'auth-toggle':S.authTab=S.authTab==='login'?'signup':'login';render();break;
 case 'demo-preview':window.location.href='/?demo=1';break;
 case 'logout':await busy(async()=>{await store.logout();S.workspaceId=null;render()});break;
 case 'new-task':if(canEdit())openModal('task',{status:node.dataset.status||'Not Started',assigned_to:store.user?.id||'',start_date:node.dataset.date||today(),due_date:node.dataset.date||'',project_id:newTaskProject()});break;
 case 'edit-task':{const t=S.tasks.find(x=>x.id===node.dataset.id);if(t)openModal('task',{...t});break;}
 case 'view-archived-task':{const t=S.archivedTasks.find(x=>x.id===node.dataset.id);if(t)openModal('archivedTask',{...t});break;}
  case 'add-attachment':{
    if(S.modal!=='task')break;
    const form=$('#taskForm'),list=$('#attachment-link-list');
    if(!attachmentCanChange(S.modalTask,form?.elements?.status?.value))break;
    if(!list||form?.elements?.status?.value!=='In Progress')break;
    if(list.querySelectorAll('[data-attachment-row]').length>=20){toast('Maksimal 20 Attachment Link per Work Item','error');break;}
    list.insertAdjacentHTML('beforeend',attachmentRow('','',true));
    list.lastElementChild?.querySelector('[data-attachment-name]')?.focus();
    break;
  }
  case 'remove-attachment':{
    if(S.modal!=='task'||!attachmentCanChange(S.modalTask,$('#taskForm')?.elements?.status?.value))break;
    node.closest('[data-attachment-row]')?.remove();
    break;
  }
 case 'close-modal':closeModal();break;
 case 'close-if-shade':if(node===eventTargetCache)closeModal();break;
 case 'profile':openModal('profile');break;
  case 'edit-member':{if(node.dataset.id===store.user?.id){openModal('profile');break;}if(!canManage())break;const m=S.members.find(x=>x.user_id===node.dataset.id);if(!m||(!isOwner()&&m.role==='super_admin'))break;S.modalMemberId=m.user_id;openModal('member');break;}
case 'toggle-project':{const view=node.dataset.view,id=node.dataset.id;if(!['Grid','Gantt'].includes(view))break;const old=S.collapsedProjects[view]||[];S.collapsedProjects[view]=old.includes(id)?old.filter(x=>x!==id):[...old,id];renderContent();break;}
 case 'rename-project':{const p=S.projects.find(x=>x.id===node.dataset.id);if(!p||!canEdit())break;S.projectToRename=p.id;openModal('renameProject');break;}
 case 'archive-project':{const p=S.projects.find(x=>x.id===node.dataset.id);if(!p||!canArchiveProject(p))break;const n=S.tasks.filter(t=>inProject(t,p.id)).length;if(!confirm(`Archive Project "${p.name}" and temporarily hide its ${n} Work Items? No data will be deleted.`))break;await busy(async()=>{await store.archiveProject(S.workspaceId,p.id);await refreshWorkspace();toast('Project archived. Restore it from Archive.');});break;}
 case 'restore-project':{const p=S.archivedProjects.find(x=>x.id===node.dataset.id);if(!p||!canArchiveProject(p))break;await busy(async()=>{await store.archiveProject(S.workspaceId,p.id,true);await refreshWorkspace();toast('Project restored');});break;}
 case 'archive-task':{const t=S.modalTask;if(!canArchiveTask(t))break;if(!confirm('Archive this Work Item? It can be restored from Archive.'))break;await busy(async()=>{await store.archiveTask(S.workspaceId,t.id);S.modal=null;S.modalTask=null;await refreshWorkspace();toast('Work Item archived');});break;}
 case 'permanent-delete-task':{
   if(!canManage())break;
   const task=S.archivedTasks.find(t=>t.id===node.dataset.id);
   if(!task)break;
   const typed=prompt('PERMANENT DELETE: Work Item "'+task.title+'" beserta checklist dan komentarnya tidak bisa dipulihkan. Ketik HAPUS untuk melanjutkan:');
   if(typed!=='HAPUS')break;
   await busy(async()=>{await store.deleteArchivedTask(S.workspaceId,task.id);await refreshWorkspace();toast('Work Item dihapus permanen.');});break;
 }
 case 'permanent-delete-project':{
   if(!canManage())break;
   const project=S.archivedProjects.find(p=>p.id===node.dataset.id);
   if(!project)break;
   const typed=prompt('PERMANENT DELETE: Project "'+project.name+'" tidak dapat dipulihkan. Work Items tetap tersimpan tetapi kehilangan relasi Project ini. Ketik HAPUS untuk melanjutkan:');
   if(typed!=='HAPUS')break;
   await busy(async()=>{await store.deleteArchivedProject(S.workspaceId,project.id);await refreshWorkspace();toast('Project dihapus permanen; Work Items tetap tersimpan.');});break;
 }
 case 'restore-task':{const t=S.archivedTasks.find(x=>x.id===node.dataset.id);if(!t||!canArchiveTask(t))break;await busy(async()=>{await store.archiveTask(S.workspaceId,t.id,true);await refreshWorkspace();toast('Work Item restored');});break;}
 case 'request-due-date':{const t=S.modalTask;if(!t?.id||!t.due_date||canReviewDueDate()||!(t.created_by===store.user?.id||t.assigned_to===store.user?.id))break;S.dueRequestTask=t;openModal('dueRequest');break;}
 case 'approve-due-date':case 'reject-due-date':{if(!canReviewDueDate())break;const r=S.dueDateRequests.find(x=>x.id===node.dataset.id&&x.status==='Pending');if(!r)break;const approve=action==='approve-due-date';const note=approve?'':(prompt('Reason for rejecting the Due Date change:')||'');if(!confirm(`${approve?'Approve':'Reject'} proposed Due Date ${r.proposed_due_date}?`))break;await busy(async()=>{await store.reviewDueDateRequest(r.id,approve,note);await refreshWorkspace();toast(approve?'Due Date change approved':'Due Date change rejected');});break;}
   case 'delete-project':{if(!canManage())break;const p=S.projects.find(x=>x.id===node.dataset.id);if(!p)break;const count=S.tasks.filter(t=>t.project_id===p.id).length;if(!confirm(`Hapus project "${p.name}"?\n${count} Work Item tetap tersimpan, tetapi akan kehilangan label Project. Tindakan ini tidak dapat dibatalkan.`))break;await busy(async()=>{await store.deleteProject(S.workspaceId,p.id);if(S.filter.project===p.id)S.filter.project='';await refreshWorkspace();toast('Project deleted. Work Items tetap tersimpan.');});break;}
  case 'delete-category':{if(!canManage())break;const c=S.categories.find(x=>x.id===node.dataset.id);if(!c)break;const count=S.tasks.filter(t=>t.category_id===c.id).length;if(!confirm(`Hapus category "${c.name}"?\n${count} Work Item tetap tersimpan, tetapi akan kehilangan label Category. Tindakan ini tidak dapat dibatalkan.`))break;await busy(async()=>{await store.deleteCategory(S.workspaceId,c.id);if(S.filter.category===c.id)S.filter.category='';await refreshWorkspace();toast('Category deleted. Work Items tetap tersimpan.');});break;}
 case 'invite':if(canManage())openModal('invite');break;
 case 'switch-workspace':openModal('switch');break;
 case 'create-workspace':openModal('workspace');break;
 case 'delete-workspace':{const w=workspace();if(!w||!isOwner()||w.created_by!==store.user?.id){toast('Only the Workspace creator with Super Admin role may delete it.','error');break;}const typed=window.prompt(`PERMANENT DELETE: Workspace "${w.name}" beserta seluruh Project, Work Item, arsip, checklist, komentar, dan anggota akan dihapus untuk semua pengguna. Ketik nama Workspace persis untuk melanjutkan:`);if(typed!==w.name)break;if(!window.confirm(`Hapus Workspace "${w.name}" secara PERMANEN? Tindakan ini tidak dapat dibatalkan.`))break;await busy(async()=>{await store.deleteWorkspace(w.id,w.name);S.modal=null;await reloadWorkspaces();toast('Workspace deleted permanently.');});break;}
 case 'new-project':if(canEdit())openModal('project');break;
 case 'new-category':if(canEdit())openModal('category');break;
  case 'edit-category':{const c=S.categories.find(x=>x.id===node.dataset.id);if(!c||!canEdit())break;S.categoryToEdit=c.id;openModal('editCategory');break;}
 case 'select-workspace':S.modal=null;await busy(()=>reloadWorkspaces(node.dataset.id));break;
 case 'clear-filters':if(['Board','Grid','Gantt'].includes(S.view))S.viewFilters[S.view]={status:'',priority:'',category:'',assignee:'',assigned_by:'',project:''};else S.filter={status:'',priority:'',category:'',assignee:'',assigned_by:'',project:''};if(S.view==='Gantt'){S.ganttUser='';S.ganttTeam='';}if(S.view==='Dashboard'){S.dashboardTeam='';S.dashboardUser='';S.dashboardProject='';}S.search='';render();break;
 case 'sort':if(S.sort===node.dataset.col)S.sortDir=-S.sortDir;else {S.sort=node.dataset.col;S.sortDir=1;}renderContent();break;
 case 'download-report':S.reportType='all';S.reportId='';openModal('report');break;
 case 'export-gantt':openModal('ganttExport');break;
 case 'print-report':{const data=S.view==='Dashboard'?scopeTasks(filteredTasks(),'dashboard'):filteredTasks();const html=buildReportHTML(data,S.people,S.categories,S.projects,workspace()?.name||'Workspace');const tab=window.open('','_blank');if(!tab){toast('Izinkan popup browser untuk cetak laporan','error');break;}tab.document.open();tab.document.write(html);tab.document.close();tab.focus();break;}
 case 'export-csv':{const file=csvExport(filteredTasks(),S.people,S.categories,S.projects);const url=URL.createObjectURL(new Blob([file],{type:'text/csv;charset=utf-8;'}));const link=document.createElement('a');link.href=url;link.download='workflow-tasks-'+today()+'.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Tasks exported as CSV');break;}
 case 'delete-task':{if(!canEditTask(S.modalTask))break;const task=S.modalTask;if(!task?.id)break;if(!window.confirm('Delete this work item permanently?'))break;await busy(async()=>{await store.deleteTask(task.id);S.modal=null;await refreshWorkspace();toast('Work item deleted');});break;}
 case 'copy-code':{const code=workspace()?.join_code||'';try{await navigator.clipboard.writeText(code);toast('Invitation code copied')}catch{toast('Copy this code manually: '+code,'error')}break;}
 case 'rotate-code':{if(!canManage())break;if(!confirm('Rotate invite code? Old code will stop working.'))break;await busy(async()=>{await store.rotateCode(S.workspaceId);S.workspaces=await store.listWorkspaces();drawModal();toast('Invitation code rotated')});break;}
 case 'cal-prev':S.calendarMonth=calShift(-1);renderContent();break;
 case 'cal-next':S.calendarMonth=calShift(1);renderContent();break;
 case 'cal-today':S.calendarMonth=new Date();renderContent();break;
 case 'calendar-day':if(canEdit())openModal('task',{status:'Not Started',assigned_to:store.user?.id||'',start_date:node.dataset.date,due_date:node.dataset.date,project_id:taskFilter().project||''});break;
 case 'cal-month':S.calendarMonth=new Date(S.calendarMonth.getFullYear(),Number(node.dataset.month),1);S.calView='Month';renderContent();break;
 case 'dash-prev':S.dashboardMonth=new Date(S.dashboardMonth.getFullYear(),S.dashboardMonth.getMonth()-1,1);renderContent();break;
 case 'dash-next':S.dashboardMonth=new Date(S.dashboardMonth.getFullYear(),S.dashboardMonth.getMonth()+1,1);renderContent();break;
 case 'dash-date':S.calendarMonth=parseDateSafe(node.dataset.date);S.calView='Week';S.view='Calendar';render();break;
 case 'dashboard-user':if(Date.now()-lastWorkloadDragAt<550)break;if(managerScope()){S.dashboardUser=node.dataset.id;renderContent()}break;
 case 'approve-completion':case 'reject-completion':{if(!canApprove()||!S.modalTask?.completion_requested_at)break;const approved=action==='approve-completion';let feedback='';if(!approved){feedback=prompt('Reason for rejecting completion (optional):')||'';}await busy(async()=>{await store.reviewCompletion(S.modalTask,approved,feedback);closeModal();await refreshWorkspace();toast(approved?'Completed approved':'Completion request rejected')});break;}
 case 'request-completion':{const t=S.modalTask;if(!t?.id||!canEditTask(t)||t.completion_requested_at)break;await busy(async()=>{await store.requestCompletion(t);closeModal();await refreshWorkspace();toast('Completion request submitted')});break;}
 case 'gantt-prev':S.ganttStart=plusDays(S.ganttStart,-Math.floor(S.ganttDays/2));renderContent();break;
 case 'gantt-next':S.ganttStart=plusDays(S.ganttStart,Math.floor(S.ganttDays/2));renderContent();break;
 case 'gantt-today':S.ganttStart=plusDays(today(),-7);renderContent();break;
 case 'reset-demo':if(confirm('Reset demo data and discard changes in this browser?'))await busy(async()=>{await store.resetDemo();await reloadWorkspaces();toast('Sample data restored')});break;
 default:break;
}}
let eventTargetCache=null;
let lastGridOrderDrag=0;
document.addEventListener('click',async e=>{if(e.target.closest?.('[data-grid-grip]')?.hasAttribute?.('data-grid-grip')||e.target.closest?.('[data-grid-project-grip]')?.hasAttribute?.('data-grid-project-grip')||e.target.closest?.('[data-resize-workitem]')?.hasAttribute?.('data-resize-workitem')||e.target.closest?.('[data-management-grip]')?.hasAttribute?.('data-management-grip'))return;if(Date.now()-lastGridOrderDrag<450&&e.target.closest?.('[data-grid-task]'))return;const node=e.target.closest('[data-action]');if(!node)return;eventTargetCache=e.target;await act(node.dataset.action,node);});
document.addEventListener('change',async e=>{
 const target=e.target;
 if(target.closest?.('[data-color-editor]')){updateColorEditor(target);return;}
 if(target.dataset.filter){taskFilter()[target.dataset.filter]=target.value;if(S.view==='Gantt'&&target.dataset.filter==='assignee')S.ganttUser=target.value;renderContent();return;}
 if(target.dataset.scope){S[target.dataset.scope]=target.value;const prefix=target.dataset.scope.startsWith('dashboard')?'dashboard':'gantt';if(target.dataset.scope.endsWith('Team'))S[prefix+'User']='';if(prefix==='gantt')taskFilter().assignee=S.ganttUser||'';renderContent();return;}
 if(target.dataset.change==='dashboard-project'){S.dashboardProject=target.value;renderContent();return;}
  if(target.dataset.change==='gantt-export-period'){
   const yearMode=target.value==='years',form=target.closest('#ganttExportForm');
   form?.querySelectorAll('[data-gantt-period]').forEach(section=>{
     const active=section.dataset.ganttPeriod===(yearMode?'years':'dates');
     section.hidden=!active;
     section.querySelectorAll('input').forEach(input=>{input.disabled=!active;input.required=active;});
   });
   return;
  }
  if(target.dataset.change==='gantt-zoom'){S.ganttDays=Number(target.value);renderContent();return;}
 if(target.dataset.change==='cal-view'){S.calView=target.value;renderContent();return;}
 if(target.dataset.change==='report-scope'){S.reportType=target.value;S.reportId='';const panel=$('#reportTargetField');if(panel)panel.innerHTML=reportTargetField();return;}
 if(target.dataset.change==='switch-workspace'){await busy(()=>reloadWorkspaces(target.value));return;}
 if(target.dataset.checklistToggle){const t=S.modalTask;if(!canEditTask(t))return;if(!t?.id){const item=S.draftChecklist.find(x=>x.id===target.dataset.checklistToggle);if(item)item.is_done=target.checked;const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(t,false);return;}const item=S.checklistItems.find(x=>x.id===target.dataset.checklistToggle);if(!item)return;await busy(async()=>{await store.setChecklistDone(t.id,item.id,target.checked);S.checklistItems=await store.listTaskChecklist(t.id);const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(t,!canEditTask(t));});return;}
 if(target.name==='status'&&target.closest('#taskForm')){const section=document.querySelector('[data-attachment-section]'),task=S.modalTask||{},links=task.attachment_urls??(task.attachment_url?[task.attachment_url]:[]);const editable=attachmentCanChange(task,target.value);if(section)section.hidden=!(target.value==='In Progress'||links.length);const editor=section?.querySelector('[data-attachment-editor]'),viewer=section?.querySelector('[data-attachment-viewer]');if(editor)editor.hidden=!editable;if(viewer)viewer.hidden=editable;return;}
 if(target.dataset.roleUser){
  if(!canManage()||target.dataset.roleUser===store.user.id)return;
  const member=S.members.find(m=>m.user_id===target.dataset.roleUser);
  if(!isOwner()&&(member?.role==='super_admin'||target.value==='super_admin'))return;
  await busy(async()=>{await store.updateMemberRole(S.workspaceId,target.dataset.roleUser,target.value);await refreshWorkspace();toast('Member role updated');});return;
 }
 if(target.dataset.teamUser){
  if(!canManage()||target.dataset.teamUser===store.user.id)return;
  const member=S.members.find(m=>m.user_id===target.dataset.teamUser);
  if(!isOwner()&&member?.role==='super_admin')return;
  const value=target.value.trim()||'General';
  await busy(async()=>{await store.updateMemberTeam(S.workspaceId,target.dataset.teamUser,value);await refreshWorkspace();toast('Member team updated')});return;
 }
});
document.addEventListener('input',e=>{if(e.target.closest?.('[data-color-editor]')){updateColorEditor(e.target);return;}if(e.target.id==='commentBody'){S.commentDraft=e.target.value;S.commentCaret=e.target.selectionStart;const sugg=$('#mention-suggestions');if(sugg){sugg.innerHTML=mentionSuggestionMarkup();sugg.hidden=!sugg.innerHTML;}return;}if(e.target.id==='globalSearch'||e.target.id==='mobileSearch'){const mobile=e.target.id==='mobileSearch';const cursor=e.target.selectionStart;S.search=e.target.value;renderContent();if(mobile){const input=$('#mobileSearch');input?.focus();if(input&&cursor!==null)input.setSelectionRange(cursor,cursor);}}});
document.addEventListener('submit',async e=>{const form=e.target;if(!['authForm','taskForm','profileForm','workspaceForm','joinForm','workspaceModalForm','projectForm','renameProjectForm','dueDateRequestForm','categoryForm','editCategoryForm','commentForm','memberForm','reportForm','ganttExportForm'].includes(form.id))return;e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());
 await busy(async()=>{
  if(form.id==='ganttExportForm'){
    const input={rangeType:data.rangeType,format:data.format,projectId:data.projectId||'',startDate:data.startDate,endDate:data.endDate,startYear:data.startYear,endYear:data.endYear};
    const report=buildGanttExportData({...input,tasks:S.tasks,projects:S.projects,positions:S.projectTaskPositions||[],projectOrder:S.viewPreferences?.project_order||[]});
    if(!report.uniqueTasks)throw Error('Tidak ada Work Item dengan tanggal dalam periode dan Project yang dipilih.');
    const name=workspace()?.name||'Workspace';
    const result=data.format==='xlsx'?downloadGanttXLSX(report,name):await downloadGanttPDF(report,name);
    S.modal=null;drawModal();toast('Gantt '+data.format.toUpperCase()+' diunduh: '+report.uniqueTasks+' Work Items.');return;
   }
   if(form.id==='reportForm'){
  const scope=String(data.report_scope||'all'),id=String(data.report_id||'');
  const selected=filterPlannerReport(S.tasks,{scope,id});
  const names={all:'All Work Items',user:'Member: '+(S.people.find(x=>x.id===id)?.full_name||''),project:'Project: '+(S.projects.find(x=>x.id===id)?.name||''),category:'Category: '+(S.categories.find(x=>x.id===id)?.name||'')};
  await downloadPlannerPDF({tasks:selected,people:S.people,projects:S.projects,categories:S.categories,workspaceName:workspace()?.name||'Workspace',selectionLabel:names[scope]||'All Work Items'});
  S.modal=null;drawModal();toast('Laporan PDF berhasil dibuat ('+selected.length+' Work Items).');return;
 }
 if(form.id==='commentForm'){const t=S.modalTask;if(t?.archived_at)throw Error('Archived Work Item is read-only');if(!t?.id||!S.workspaceId)throw Error('Work Item belum tersimpan');const text=String(data.body||'').trim();if(!text)throw Error('Tuliskan komentar terlebih dahulu');await store.addTaskComment(t,text,mentionedUserIds(text,S.people));S.commentDraft='';S.commentCaret=0;S.taskComments=await store.listTaskComments(t.id);S.commentLoading=false;S.taskTab='comments';S.chatOpen=true;const body=$('#task-chat-panel .discussion-panel');if(body)body.outerHTML=commentsPanel();toast('Komentar tersimpan dan notifikasi terkirim');return;}
  if(form.id==='authForm'){if(S.authTab==='login'){if(data.identifier.includes('@'))await store.login(data.identifier.trim(),data.password);else await store.loginByUsername(data.identifier.trim().toLowerCase(),data.password);await reloadWorkspaces();toast('Welcome back!');}else{const response=await store.signup(data.full_name,data.email,data.password,data.username.trim().toLowerCase());if(response?.access_token){await reloadWorkspaces();toast('Your account is ready!');}else{S.authTab='login';render();toast('Account created. Check your inbox to confirm your email before signing in.');}}return;}
  if(form.id==='joinForm'){S.pendingJoin=data.code;const wsId=await store.joinWorkspace(data.code);S.pendingJoin='';await reloadWorkspaces(wsId);toast('You joined the workspace!');return;}
  if(form.id==='workspaceForm'||form.id==='workspaceModalForm'){const ws=await store.createWorkspace(data.name.trim());S.modal=null;await reloadWorkspaces(ws.id);toast('Workspace created');return;}
  if(form.id==='memberForm'){const m=S.members.find(x=>x.user_id===S.modalMemberId);if(!canManage()||!m||m.user_id===store.user?.id||(!isOwner()&&m.role==='super_admin'))throw Error('Anda tidak memiliki izin untuk mengedit member ini.');const full_name=String(data.full_name||'').trim(),job_title=String(data.job_title||'').trim();if(full_name.length<2||full_name.length>100||job_title.length>120)throw Error('Nama 2–100 karakter, Job/Position maksimal 120 karakter.');await store.updateMemberDetails(S.workspaceId,m.user_id,full_name,job_title);S.modal=null;S.modalMemberId=null;await refreshWorkspace();toast('Identitas member berhasil diperbarui.');return;}
   if(form.id==='profileForm'){if(!data.full_name.trim())throw Error('Full name is required');if(!/^[a-z][a-z0-9_]{2,29}$/.test(data.username))throw Error('Username: 3–30 karakter, huruf kecil/angka/underscore');await store.updateProfile({username:data.username.trim(),full_name:data.full_name.trim(),job_title:data.job_title.trim()});S.modal=null;await reloadWorkspaces(S.workspaceId);toast('Profile updated');return;}
  if(form.id==='renameProjectForm'){const p=S.projects.find(x=>x.id===S.projectToRename);if(!p)throw Error('Project tidak ditemukan');await store.renameProject(S.workspaceId,p.id,data.name,formColor(form));S.projectToRename=null;S.modal=null;await refreshWorkspace();toast('Project renamed');return;}
   if(form.id==='dueDateRequestForm'){const t=S.dueRequestTask;if(!t?.id)throw Error('Work Item tidak ditemukan');await store.requestDueDateChange(t,data.proposed_due_date,data.reason);S.dueRequestTask=null;S.modal=null;await refreshWorkspace();toast('Due Date change request submitted');return;}
   if(form.id==='projectForm'){await store.createProject({workspace_id:S.workspaceId,name:data.name.trim(),color:formColor(form)});S.modal=null;await refreshWorkspace();toast('Project created');return;}
  if(form.id==='categoryForm'){await store.createCategory({workspace_id:S.workspaceId,name:data.name.trim(),color:formColor(form)});S.modal=null;await refreshWorkspace();toast('Category created');return;}
   if(form.id==='editCategoryForm'){const cat=S.categories.find(c=>c.id===S.categoryToEdit);if(!cat)throw Error('Category tidak ditemukan');await store.updateCategory(S.workspaceId,cat.id,{name:data.name,color:formColor(form)});S.modal=null;S.categoryToEdit=null;await refreshWorkspace();toast('Category berhasil diperbarui');return;}
  if(form.id==='taskForm'){
   if(!canEditTask(S.modalTask))throw Error('Read-only access');
   if(!data.title?.trim())throw Error('Work Item cannot be empty');
   if(data.start_date&&data.due_date&&data.due_date<data.start_date)throw Error('Due Date cannot be earlier than Start Date');
    if(S.modalTask?.id&&S.modalTask.due_date&&S.modalTask.due_date!==data.due_date&&!canReviewDueDate())throw Error('Due Date sudah ditetapkan. Gunakan Request Due Date Change untuk meminta persetujuan.');
   const current=S.modalTask||{};
    const editableAttachments=attachmentCanChange(current,data.status);
    const rows=editableAttachments?[...form.querySelectorAll('[data-attachment-editor] [data-attachment-row]')]:[];
    const entered=rows.map(row=>({url:row.querySelector('[data-attachment-input]')?.value.trim()||'',name:row.querySelector('[data-attachment-name]')?.value.trim()||''}));
    if(entered.some(x=>x.name&&!x.url))throw Error('Isi URL HTTPS untuk setiap Link Name');
    if(entered.some(x=>x.url&&!x.name))throw Error('Isi Link Name untuk setiap tautan HTTPS');
    const attachment_urls=editableAttachments?normalizeAttachmentUrls(entered.map(x=>x.url)):
      normalizeAttachmentUrls(current.attachment_urls??(current.attachment_url?[current.attachment_url]:[]));
    const attachment_names=editableAttachments?entered.filter(x=>x.url).map(x=>x.name):(current.attachment_names||[]);
   const needsRequest=data.status==='Completed'&&!canApprove();
   const selectedProjectInputs=form.querySelectorAll?.('input[name="project_ids"]');
   const chosen=selectedProjectInputs?[...selectedProjectInputs].filter(x=>x.checked).map(x=>x.value):(data.project_id?[data.project_id]:[]);
   const archivedLinks=projectIds(S.modalTask).filter(id=>(S.archivedProjects||[]).some(p=>p.id===id));
   const project_ids=[...new Set([...chosen,...archivedLinks])];
   if(project_ids.length>20)throw Error('Maksimal 20 Project per Work Item');
   const task={workspace_id:S.workspaceId,project_id:project_ids[0]||null,project_ids,title:data.title.trim(),assigned_to:data.assigned_to||null,assigned_by:data.assigned_by||null,category_id:data.category_id||null,status:needsRequest?'In Progress':data.status,priority:data.priority,start_date:data.start_date||null,due_date:data.due_date||null,notes:data.notes||'',stakeholders:data.stakeholders||'',attachment_url:attachment_urls[0]||'',attachment_urls,attachment_names};
   if(S.modalTask?.id)task.id=S.modalTask.id;else task.created_by=store.user.id;
   const saved=!task.id?await store.saveNewTaskWithChecklist(task,S.draftChecklist):await store.saveTask(task);if(needsRequest){await store.requestCompletion(saved);};S.modal=null;S.draftChecklist=[];await refreshWorkspace();toast(needsRequest?'Completed diajukan ke Manager':(S.modalTask?.id?'Work item updated':'New work item created'));S.modalTask=null;return;
  }
 });
});
let draggingManagement=null;
function reorderManagement(type,sourceId,targetId){
 const items=sortedManagementItems(type),ids=items.map(x=>x.id);
 const a=ids.indexOf(sourceId),b=ids.indexOf(targetId);
 if(a<0||b<0||a===b)return null;
 ids.splice(a,1);ids.splice(b,0,sourceId);
 return ids;
}
async function persistManagementOrder(type,ids){
 const saved=await store.saveManagementItemOrder(S.workspaceId,type,ids);
 const rankIds=new Set(ids);
 S.managementPositions=(S.managementPositions||[]).filter(p=>!(p.workspace_id===S.workspaceId&&p.item_type===type&&rankIds.has(p.item_id))).concat(saved);
 renderContent();toast('Urutan '+(type==='project'?'Projects':'Categories')+' berhasil disimpan.');
}
document.addEventListener('dragstart',e=>{
 const grip=e.target.closest?.('[data-management-grip]');
 if(!grip||S.view!=='Settings')return;
 draggingManagement={type:grip.dataset.type,id:grip.dataset.id};
 if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','settings:'+draggingManagement.type+':'+draggingManagement.id);}
 grip.closest('[data-management-type]')?.classList.add('management-dragging');
});
document.addEventListener('dragover',e=>{
 const row=e.target.closest?.('[data-management-type]');
 if(!draggingManagement||S.view!=='Settings'||!row||row.dataset.managementType!==draggingManagement.type||row.dataset.managementId===draggingManagement.id)return;
 e.preventDefault();
 if(e.dataTransfer)e.dataTransfer.dropEffect='move';
 row.classList.add('management-drag-target');
});
document.addEventListener('dragleave',e=>{
 const row=e.target.closest?.('[data-management-type]');
 if(row&&!row.contains(e.relatedTarget))row.classList.remove('management-drag-target');
});
document.addEventListener('dragend',()=>{
 draggingManagement=null;
 document.querySelectorAll?.('.management-dragging,.management-drag-target').forEach(row=>row.classList.remove('management-dragging','management-drag-target'));
});
document.addEventListener('drop',async e=>{
 const row=e.target.closest?.('[data-management-type]');
 if(!draggingManagement||S.view!=='Settings'||!row||row.dataset.managementType!==draggingManagement.type)return;
 e.preventDefault();e.stopPropagation();
 const {type,id}=draggingManagement,targetId=row.dataset.managementId;
 draggingManagement=null;
 document.querySelectorAll?.('.management-dragging,.management-drag-target').forEach(el=>el.classList.remove('management-dragging','management-drag-target'));
 const ids=reorderManagement(type,id,targetId);
 if(ids)await busy(()=>persistManagementOrder(type,ids));
});
document.addEventListener('keydown',async e=>{
 const grip=e.target.closest?.('[data-management-grip]');
 if(!grip||S.view!=='Settings'||!['ArrowUp','ArrowDown'].includes(e.key))return;
 e.preventDefault();
 const type=grip.dataset.type,ordered=sortedManagementItems(type).map(x=>x.id);
 const index=ordered.indexOf(grip.dataset.id),next=index+(e.key==='ArrowUp'?-1:1);
 if(index<0||next<0||next>=ordered.length)return;
 const targetId=ordered[next],ids=reorderManagement(type,grip.dataset.id,targetId);
 if(ids){await busy(()=>persistManagementOrder(type,ids));document.querySelector('[data-management-grip][data-type="'+type+'"][data-id="'+grip.dataset.id+'"]')?.focus();}
});
let gridDrag=null;
document.addEventListener('dragstart',e=>{
 const grip=e.target.closest?.('[data-grid-grip]');
 if(!grip||S.view!=='Grid')return;
 gridDrag={project:grip.dataset.projectId,task:grip.dataset.taskId};
 if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','grid:'+gridDrag.project+':'+gridDrag.task);}
 grip.closest('[data-grid-task]')?.classList.add('grid-row-moving');
});
document.addEventListener('dragover',e=>{
 const target=e.target.closest?.('[data-grid-task]');
 if(!target||!gridDrag||S.view!=='Grid'||target.dataset.gridProject!==gridDrag.project)return;
 e.preventDefault();if(e.dataTransfer)e.dataTransfer.dropEffect='move';target.classList.add('grid-row-target');
});
document.addEventListener('dragleave',e=>{
 const row=e.target.closest?.('[data-grid-task]');
 if(row&&!row.contains(e.relatedTarget))row.classList.remove('grid-row-target');
});
document.addEventListener('dragend',()=>{
 gridDrag=null;
 document.querySelectorAll?.('.grid-row-moving,.grid-row-target').forEach(x=>x.classList.remove('grid-row-moving','grid-row-target'));
});
document.addEventListener('drop',async e=>{
 const target=e.target.closest?.('[data-grid-task]');
 if(!target||!gridDrag||S.view!=='Grid'||target.dataset.gridProject!==gridDrag.project)return;
 e.preventDefault();e.stopPropagation();
 const {project,task}=gridDrag,destination=target.dataset.gridTask;
 gridDrag=null;lastGridOrderDrag=Date.now();
 document.querySelectorAll?.('.grid-row-moving,.grid-row-target').forEach(x=>x.classList.remove('grid-row-moving','grid-row-target'));
 if(!project||project==='__unassigned__'||task===destination)return;
 const all=sortProjectWorkItems(S.tasks.filter(t=>inProject(t,project)),project).map(t=>t.id);
 const from=all.indexOf(task),to=all.indexOf(destination);
 if(from<0||to<0)return;
 all.splice(from,1);all.splice(to,0,task);
 await busy(async()=>{
  const result=await store.saveProjectTaskOrder(S.workspaceId,project,all);
  S.projectTaskPositions=(S.projectTaskPositions||[]).filter(x=>x.project_id!==project).concat(result);
  renderContent();toast('Urutan Work Item tersimpan dan berlaku di Timeline/Gantt.');
 });
});
function projectOrderIds(){
 const rank=new Map((S.viewPreferences?.project_order||[]).map((id,index)=>[id,index]));
 return S.projects.slice().sort((a,b)=>{
  const ra=rank.get(a.id),rb=rank.get(b.id);
  if(ra!==undefined&&rb!==undefined)return ra-rb;
  if(ra!==undefined)return -1;if(rb!==undefined)return 1;
  return a.name.localeCompare(b.name,'id');
 }).map(p=>p.id);
}
async function persistViewPreferences(patch,success){
 const existing=S.viewPreferences||{};
 const next={project_order:existing.project_order||[],work_item_width:existing.work_item_width||280,...patch};
 const saved=await store.saveViewPreferences(S.workspaceId,next);
 S.viewPreferences=saved;
 renderContent();
 if(success)toast(success);
}
let draggingProjectId=null;
document.addEventListener('dragstart',e=>{
 const grip=e.target.closest?.('[data-grid-project-grip]');
 if(!grip||S.view!=='Grid')return;
 draggingProjectId=grip.dataset.projectId;
 if(e.dataTransfer){e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain','project:'+draggingProjectId);}
 grip.closest('[data-grid-group]')?.classList.add('grid-project-moving');
});
document.addEventListener('dragover',e=>{
 const group=e.target.closest?.('[data-grid-group]');
 if(!draggingProjectId||!group||S.view!=='Grid')return;
 if(group.dataset.gridGroup===draggingProjectId)return;
 e.preventDefault();
 if(e.dataTransfer)e.dataTransfer.dropEffect='move';
 group.classList.add('grid-project-target');
});
document.addEventListener('dragleave',e=>{
 const group=e.target.closest?.('[data-grid-group]');
 if(group&&!group.contains(e.relatedTarget))group.classList.remove('grid-project-target');
});
document.addEventListener('dragend',()=>{
 draggingProjectId=null;
 document.querySelectorAll?.('.grid-project-moving,.grid-project-target').forEach(el=>el.classList.remove('grid-project-moving','grid-project-target'));
});
document.addEventListener('drop',async e=>{
 const group=e.target.closest?.('[data-grid-group]');
 if(!group||!draggingProjectId||S.view!=='Grid')return;
 const moved=draggingProjectId,target=group.dataset.gridGroup;
 draggingProjectId=null;lastGridOrderDrag=Date.now();
 document.querySelectorAll?.('.grid-project-moving,.grid-project-target').forEach(el=>el.classList.remove('grid-project-moving','grid-project-target'));
 if(moved===target||!S.projects.some(p=>p.id===moved)||!S.projects.some(p=>p.id===target))return;
 e.preventDefault();e.stopPropagation();
 const order=projectOrderIds(),from=order.indexOf(moved),to=order.indexOf(target);
 if(from<0||to<0)return;
 order.splice(from,1);order.splice(to,0,moved);
 // Retain archived Project IDs so restoring one does not lose its previous place.
 const old=S.viewPreferences?.project_order||[];
 const full=[...order,...old.filter(id=>!order.includes(id))];
 await busy(()=>persistViewPreferences({project_order:full},'Urutan Project tersimpan untuk Grid dan Timeline/Gantt.'));
});
let resizingWorkItem=null;
document.addEventListener('pointerdown',e=>{
 const handle=e.target.closest?.('[data-resize-workitem]');
 if(!handle||!['Grid','Gantt'].includes(S.view))return;
 e.preventDefault();e.stopPropagation();
 const root=handle.closest('.grid-column-layout,.gantt-resizable');
 if(!root)return;
 resizingWorkItem={startX:e.clientX,original:workItemWidth(),current:workItemWidth(),root};
 root.classList.add('is-resizing-workitem');
 handle.setPointerCapture?.(e.pointerId);
});
document.addEventListener('pointermove',e=>{
 if(!resizingWorkItem)return;
 const r=resizingWorkItem;
 r.current=Math.max(190,Math.min(800,Math.round(r.original+e.clientX-r.startX)));
 r.root.style.setProperty('--work-item-width',r.current+'px');
});
document.addEventListener('pointerup',async e=>{
 if(!resizingWorkItem)return;
 const {current,original,root}=resizingWorkItem;resizingWorkItem=null;
 root.classList.remove('is-resizing-workitem');
 if(current===original)return;
 await busy(()=>persistViewPreferences({work_item_width:current},'Lebar kolom Work Item tersimpan untuk Grid dan Gantt.'));
});
document.addEventListener('pointercancel',()=>{
 if(!resizingWorkItem)return;
 resizingWorkItem.root.style.setProperty('--work-item-width',resizingWorkItem.original+'px');
 resizingWorkItem.root.classList.remove('is-resizing-workitem');
 resizingWorkItem=null;
});
document.addEventListener('keydown',async e=>{
 const handle=e.target.closest?.('[data-resize-workitem]');
 if(!handle||!['Grid','Gantt'].includes(S.view))return;
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
 e.preventDefault();
 const old=workItemWidth();
 const value=e.key==='Home'?190:e.key==='End'?800:Math.max(190,Math.min(800,old+(e.key==='ArrowRight'?25:-25)));
 if(value!==old)await busy(()=>persistViewPreferences({work_item_width:value},'Lebar kolom Work Item diperbarui.'));
});
let draggingDashboardKey=null;
document.addEventListener('dragstart',e=>{
 const grip=e.target.closest?.('.dashboard-drag-grip');
 if(!grip||S.view!=='Dashboard')return;
 const card=grip.closest('[data-dashboard-card]');if(!card)return;
 draggingDashboardKey=card.dataset.dashboardCard;
 e.dataTransfer?.setData('text/plain','dashboard:'+draggingDashboardKey);
 if(e.dataTransfer)e.dataTransfer.effectAllowed='move';
 card.classList.add('dashboard-dragging');
});
document.addEventListener('dragover',e=>{
 if(!draggingDashboardKey)return;
 const card=e.target.closest?.('[data-dashboard-card]');
 if(!card||card.dataset.dashboardCard===draggingDashboardKey)return;
 const zone=card.closest('[data-dashboard-zone]'),source=document.querySelector('[data-dashboard-card="'+draggingDashboardKey+'"]');
 if(!zone||source?.parentElement!==zone)return;
 e.preventDefault();
 card.classList.add('dashboard-drag-over');
});
document.addEventListener('dragleave',e=>{
 if(!draggingDashboardKey)return;
 const card=e.target.closest?.('[data-dashboard-card]');
 if(card&&!card.contains(e.relatedTarget))card.classList.remove('dashboard-drag-over');
});
document.addEventListener('dragend',()=>{
 draggingDashboardKey=null;
 document.querySelectorAll?.('.dashboard-dragging,.dashboard-drag-over').forEach(x=>x.classList.remove('dashboard-dragging','dashboard-drag-over'));
});
document.addEventListener('drop',async e=>{
 if(!draggingDashboardKey)return;
 const target=e.target.closest?.('[data-dashboard-card]');
 const source=document.querySelector('[data-dashboard-card="'+draggingDashboardKey+'"]');
 const key=draggingDashboardKey;draggingDashboardKey=null;
 document.querySelectorAll?.('.dashboard-dragging,.dashboard-drag-over').forEach(x=>x.classList.remove('dashboard-dragging','dashboard-drag-over'));
 if(!target||!source||target===source||target.parentElement!==source.parentElement)return;
 e.preventDefault();e.stopPropagation();
 const zone=target.parentElement;
 const cards=[...zone.children].filter(x=>x.dataset?.dashboardCard);
 const keys=cards.map(x=>x.dataset.dashboardCard);
 const from=keys.indexOf(key),to=keys.indexOf(target.dataset.dashboardCard);
 if(from<0||to<0)return;
 keys.splice(from,1);keys.splice(to,0,key);
 await busy(async()=>{
  await store.saveDashboardOrder(S.workspaceId,keys);
  S.dashboardPositions=(S.dashboardPositions||[]).filter(x=>!keys.includes(x.card_key)).concat(keys.map((card_key,sort_order)=>({workspace_id:S.workspaceId,user_id:store.user.id,card_key,sort_order})));
  renderContent();toast('Urutan kartu Workspace Overview tersimpan.');
 });
});
let draggingWorkloadId=null,lastWorkloadDragAt=0;
document.addEventListener('dragstart',e=>{
 const card=e.target.closest('[data-workload-id]');
 if(!card)return;
 if(!canManage()){e.preventDefault();return;}
 draggingWorkloadId=card.dataset.workloadId;
 e.dataTransfer.effectAllowed='move';
 e.dataTransfer.setData('text/plain',draggingWorkloadId);
 card.classList.add('dragging');
});
document.addEventListener('dragover',e=>{
 const card=e.target.closest('[data-workload-id]');
 if(!card||!canManage()||!draggingWorkloadId)return;
 e.preventDefault();e.dataTransfer.dropEffect='move';card.classList.add('drag-over');
});
document.addEventListener('dragleave',e=>{
 const card=e.target.closest('[data-workload-id]');
 if(card&&!card.contains(e.relatedTarget))card.classList.remove('drag-over');
});
document.addEventListener('dragend',()=>{
 draggingWorkloadId=null;
 document.querySelectorAll('.workload-card.dragging,.workload-card.drag-over').forEach(el=>el.classList.remove('dragging','drag-over'));
});
document.addEventListener('drop',async e=>{
 const card=e.target.closest('[data-workload-id]');
 if(!card||!draggingWorkloadId||!canManage())return;
 e.preventDefault();e.stopPropagation();
 const source=draggingWorkloadId,target=card.dataset.workloadId;
 draggingWorkloadId=null;lastWorkloadDragAt=Date.now();
 document.querySelectorAll('.workload-card.dragging,.workload-card.drag-over').forEach(el=>el.classList.remove('dragging','drag-over'));
 if(source===target)return;
 const all=workloadMembers(scopeTasks(filteredTasks(),'dashboard')).map(x=>x.u.id);
 const from=all.indexOf(source),to=all.indexOf(target);
 if(from<0||to<0)return;
 all.splice(from,1);all.splice(to,0,source);
 await busy(async()=>{await store.saveWorkloadOrder(S.workspaceId,all);S.workloadPositions=all.map((user_id,sort_order)=>({workspace_id:S.workspaceId,user_id,sort_order}));renderContent();toast('Urutan Member Workload tersimpan');});
});
let dragId=null;
document.addEventListener('dragstart',e=>{const card=e.target.closest('[data-task-id]');if(!card||!canEditTask(S.tasks.find(t=>t.id===card.dataset.taskId)))return;dragId=card.dataset.taskId;e.dataTransfer.effectAllowed='move';e.dataTransfer.setData('text/plain',dragId);card.classList.add('dragging');});
document.addEventListener('dragend',()=>{dragId=null;document.querySelectorAll('.dragging,.drag-over').forEach(x=>x.classList.remove('dragging','drag-over'))});
document.addEventListener('dragover',e=>{const col=e.target.closest('[data-drop-status]');if(!col||!canEdit())return;e.preventDefault();col.classList.add('drag-over');});
document.addEventListener('dragleave',e=>{const col=e.target.closest('[data-drop-status]');if(col&&!col.contains(e.relatedTarget))col.classList.remove('drag-over');});
document.addEventListener('drop',async e=>{const col=e.target.closest('[data-drop-status]');if(!col||!canEdit())return;e.preventDefault();col.classList.remove('drag-over');const id=dragId||e.dataTransfer.getData('text/plain');dragId=null;const t=S.tasks.find(t=>t.id===id);if(!t||!canEditTask(t)||t.status===col.dataset.dropStatus)return;await busy(async()=>{const requested=col.dataset.dropStatus==='Completed'&&!canApprove();const saved=await store.saveTask({...t,status:requested?'In Progress':col.dataset.dropStatus});if(requested)await store.requestCompletion(saved);await refreshWorkspace();toast(requested?'Completion requested for Manager approval':'Task moved to '+col.dataset.dropStatus);});});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='checklistInput'){e.preventDefault();$('#checklist-section [data-action="add-checklist"]')?.click();return;}if(e.key==='Escape'&&S.modal)closeModal()});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js').catch(()=>{}));
if(typeof window.setInterval==='function')window.setInterval(()=>{if(S.workspaceId&&store.user&&document.visibilityState==='visible'&&!S.busy)void refreshNotices();},25000);
start();
