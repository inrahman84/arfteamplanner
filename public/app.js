import {STATUSES,PRIORITIES,MONTHS,WEEKDAYS,STATUS_COLORS,PRIORITY_COLORS,safe,safeColor,isoDate,today,plusDays,dayDiff,dateLabel,statusClass,priorityClass,overdue,initials,metrics,csvExport,ROLES,roleLabel,validAttachment,normalizeAttachmentUrls,taskActiveOnDate,workloadSegments} from './core.js';
import {buildReportHTML,downloadHTMLReport} from './reports.js';
import {downloadPlannerPDF,filterPlannerReport} from './pdf-report.js';
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
  settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-1.91 1.91-.06-.06A1.7 1.7 0 0 0 16 18.45a1.7 1.7 0 0 0-1 1.56V21h-3v-.99a1.7 1.7 0 0 0-1-1.56 1.7 1.7 0 0 0-1.88.34l-.06.06-1.91-1.91.06-.06A1.7 1.7 0 0 0 7.55 15a1.7 1.7 0 0 0-1.56-1H5v-3h.99a1.7 1.7 0 0 0 1.56-1 1.7 1.7 0 0 0-.34-1.88l-.06-.06 1.91-1.91.06.06A1.7 1.7 0 0 0 11 6.55a1.7 1.7 0 0 0 1-1.56V4h3v.99a1.7 1.7 0 0 0 1 1.56 1.7 1.7 0 0 0 1.88-.34l.06-.06 1.91 1.91-.06.06A1.7 1.7 0 0 0 19.45 10a1.7 1.7 0 0 0 1.56 1H22v3h-.99a1.7 1.7 0 0 0-1.56 1Z"/>',
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
const S={view:'Dashboard',modal:null,modalTask:null,filter:{status:'',priority:'',category:'',assignee:'',project:''},viewFilters:{},dashboardPositions:[],draftChecklist:[],search:'',sort:'due_date',sortDir:1,calendarMonth:new Date(new Date().getFullYear(),new Date().getMonth(),1),ganttStart:plusDays(today(),-7),ganttDays:42,notifications:false,workspaceId:null,workspaces:[],members:[],people:[],projects:[],categories:[],tasks:[],profile:null,busy:false,authTab:'login',pendingJoin:'',isReady:false,dashboardTeam:'',dashboardUser:'',ganttTeam:'',ganttUser:'',dashboardMonth:new Date(new Date().getFullYear(),new Date().getMonth(),1),calView:'Month',taskTab:'work',taskComments:[],chatOpen:false,checklistItems:[],checklistLoading:false,reportType:'all',reportId:'',modalMemberId:null,workloadPositions:[],commentLoading:false,commentDraft:'',commentCaret:0,noticeItems:[]};
const role=()=>S.members.find(m=>m.user_id===store.user?.id)?.role||'viewer';
const canEdit=()=>true;
const canManage=()=>['super_admin','manager'].includes(role());
const isOwner=()=>role()==='super_admin';
const canApprove=()=>['super_admin','manager'].includes(role());
const canEditTask=t=>canApprove()||!t?.id||((t.created_by===store.user?.id||t.assigned_to===store.user?.id)&&t.status!=='Completed');
const teamOf=id=>S.members.find(x=>x.user_id===id)?.team_name||'General';
const teamNames=()=>[...new Set(S.members.map(x=>x.team_name||'General'))].sort();
const managerScope=()=>canApprove();
const workspace=()=>S.workspaces.find(w=>w.id===S.workspaceId);
const nameOf=id=>S.people.find(x=>x.id===id)?.full_name||'Unassigned';
const projectOf=id=>S.projects.find(x=>x.id===id)?.name||'General';
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
 return S.viewFilters[S.view]??=( {status:'',priority:'',category:'',assignee:store.user?.id||'',project:''} );
}
function filteredTasks(){const f=taskFilter();let out=S.tasks.filter(t=>(!f.project||f.project===t.project_id)&&(!f.status||f.status===t.status)&&(!f.priority||f.priority===t.priority)&&(!f.category||f.category===t.category_id)&&(!f.assignee||f.assignee===t.assigned_to));if(S.search){const s=S.search.toLowerCase();out=out.filter(t=>[t.title,t.notes,t.stakeholders,nameOf(t.assigned_to),projectOf(t.project_id),categoryOf(t.category_id)?.name].some(x=>String(x||'').toLowerCase().includes(s)));}return out;}
function navLink(name,label,iconName){return `<button class="nav-link ${S.view===name?'active':''}" data-action="nav" data-view="${name}" title="${safe(label)}">${ic(iconName)}<span>${safe(label)}</span></button>`}
function mobileLink(name,label,iconName){return `<button class="mobile-link ${S.view===name?'active':''}" data-action="nav" data-view="${name}">${ic(iconName)}<span>${safe(label)}</span></button>`}
function sideBar(){return `<aside class="sidebar"><div class="brand"><span class="brand-mark">${ic('logo','lg')}</span><span>WorkFlow<span class="brand-sub">PLANNER</span></span></div><div class="nav-label">WORKSPACE</div>${navLink('Dashboard','Dashboard','dashboard')}${navLink('Board','Board View','board')}${navLink('Grid','Grid View','grid')}${navLink('Gantt','Timeline / Gantt','gantt')}${navLink('Calendar','Calendar','calendar')}<div class="nav-label">MANAGEMENT</div>${navLink('Team','Team & Members','team')}${navLink('Settings','Settings','settings')}<div class="nav-spacer"></div><div class="sidebar-bottom"><div class="workspace-box"><div class="workspace-kicker">ACTIVE WORKSPACE</div><div class="workspace-row"><div class="workspace-name">${safe(workspace()?.name||'My Workspace')}</div><button class="icon-btn" data-action="switch-workspace" title="Switch workspace" style="color:#bed9c6;width:25px">${ic('down','sm')}</button></div></div><button class="side-bottom-btn" data-action="profile">${avatar(S.profile?.full_name||'?','gold')}<span>${safe(S.profile?.full_name||'My Profile')}</span></button>${isConnected?`<button class="side-bottom-btn" data-action="logout">${ic('logout')}<span>Sign out</span></button>`:''}</div></aside>`}
function topBar(){return `<header class="topbar"><div class="breadcrumb"><span>${safe(workspace()?.name||'Workspace')}</span><span class="divider"></span><strong>${safe(S.view)}</strong></div><div class="top-actions"><label class="search-box">${ic('search','sm')}<input id="globalSearch" placeholder="Search work items..." value="${safe(S.search)}" aria-label="Search work items"/></label><button class="icon-btn" data-action="notifications" aria-label="Notifications">${ic('bell')}<span id="notice-count" class="notif-count" ${S.noticeItems.filter(n=>!n.is_read).length?'':'hidden'}>${S.noticeItems.filter(n=>!n.is_read).length}</span></button><button class="top-avatar" data-action="profile" title="My profile">${safe(initials(S.profile?.full_name||'Me'))}</button></div>${S.notifications?renderNotification():''}</header>`}
function renderNotification(){const notices=S.noticeItems||[],alerts=S.tasks.filter(t=>overdue(t)).slice(0,3);return `<div class="notification-pop" id="notice-pop"><div class="flex between acenter"><h3>Notifications</h3><button class="icon-btn" data-action="notifications">${ic('x','sm')}</button></div>${notices.length?notices.slice(0,30).map(n=>`<button class="notification-row ${n.is_read?'':'unread'}" data-action="open-notification" data-id="${safe(n.id)}"><strong>${n.kind==='mention'?'Anda di-mention':'Komentar pada tugas'} · ${safe(nameOf(n.actor_id))}</strong><small>${safe(S.tasks.find(t=>t.id===n.task_id)?.title||'Work Item')}</small><small>${safe(n.body_preview||'')}</small><small>${safe(new Date(n.created_at).toLocaleString('id-ID'))}</small></button>`).join(''):'<p>Belum ada komentar atau mention baru.</p>'}${alerts.length?'<h4 style="margin:12px 3px">Overdue</h4>'+alerts.map(t=>`<p>${ic('warning','sm')} <b>${safe(t.title)}</b> · ${safe(dateLabel(t.due_date))}</p>`).join(''):''}</div>`}
function pageHead(label,title,desc,buttons=''){return `<div class="page-top"><div><div class="page-eyebrow">${safe(label)}</div><h1 class="page-title">${safe(title)}</h1><p class="page-desc">${safe(desc)}</p></div><div class="toolbar">${buttons}</div></div>`}
function commonToolbar(){const f=taskFilter();return `<div class="filterbar"><label class="search-box mobile-search">${ic('search','sm')}<input id="mobileSearch" value="${safe(S.search)}" placeholder="Search work items..." aria-label="Search work items"/></label>${ic('filter','sm')}<select aria-label="Filter project" data-filter="project">${listOptions(S.projects,f.project,'All projects')}</select><select aria-label="Filter status" data-filter="status"><option value="">All statuses</option>${STATUSES.map(s=>`<option ${s===f.status?'selected':''}>${s}</option>`).join('')}</select><select aria-label="Filter priority" data-filter="priority"><option value="">All priorities</option>${PRIORITIES.map(s=>`<option ${s===f.priority?'selected':''}>${s}</option>`).join('')}</select><select aria-label="Filter category" data-filter="category">${listOptions(S.categories,f.category,'All categories')}</select><select aria-label="Filter assignee" data-filter="assignee">${listOptions(S.people,f.assignee,'All assignees',x=>x.full_name)}</select>${Object.values(S.filter).some(Boolean)||S.search?button('Clear filters','clear-filters','flat'):''}</div>`}
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
function dashboard(){
 const data=scopeTasks(S.tasks,'dashboard'),m=metrics(data);
 const ordered=data.filter(t=>t.due_date&&t.status!=='Completed').sort((a,b)=>a.due_date.localeCompare(b.due_date));
 const requests=data.filter(t=>t.completion_requested_at&&t.status!=='Completed');
 const kpis=[['Total Work Items',m.total,'briefcase','#073b2d'],['In Progress',m.inProgress,'activity','#3f6276'],['On Hold',m.onHold,'clock','#c89b55'],['Completed',m.completed,'check','#009b4c'],['Pending Approval',m.pending,'warning','#b7791f'],['Overdue Tasks',m.late,'warning','#bd5548']];const kpiKeys=['total','progress','hold','completed','pending','overdue'];
 const workload=workloadMembers(data).filter(x=>!S.dashboardTeam||teamOf(x.u.id)===S.dashboardTeam).filter(x=>!S.dashboardUser||x.u.id===S.dashboardUser);
 return pageHead('WELCOME BACK','Workspace Overview',`Ringkasan pekerjaan dan tim · ${safe(roleLabel(role()))}`,button(ic('download')+' Download Laporan','download-report','alt')+(canEdit()?button(ic('plus')+' Create Task','new-task'):''))+
 userTeamFilter('dashboard')+
 `<div class="kpi-grid v11-kpi" data-dashboard-zone="kpis">${kpis.map(([label,v,icon,color],i)=>`<div class="card kpi dashboard-tile" data-dashboard-card="${kpiKeys[i]}"><div class="kpi-icon" style="color:${color};background:${color}14">${ic(icon)}</div><div class="kpi-label">${label}</div><div class="kpi-value">${v}</div></div>`).join('')}</div>
 <div class="dashboard-grid" data-dashboard-zone="panels">${dashboardCalendar(data)}<section class="card panel-pad dashboard-tile" data-dashboard-card="deadlines"><div class="panel-heading"><h2 class="section-title">Upcoming Deadlines</h2><span class="panel-note">${ordered.length} open deadlines</span></div><div class="task-list">${ordered.slice(0,8).map(t=>`<div class="task-line" data-action="edit-task" data-id="${safe(t.id)}"><div class="flex acenter gap12 grow">${avatar(nameOf(t.assigned_to))}<div class="grow"><strong>${safe(t.title)}</strong><span class="sub">${safe(nameOf(t.assigned_to))} · ${safe(t.status)}</span></div></div><span class="date ${dateAlert(t)}">${dateLabel(t.due_date,true)}</span></div>`).join('')||'<p class="muted">No upcoming deadlines.</p>'}</div></section></div>
 <div class="dashboard-grid" data-dashboard-zone="panels-secondary"><section class="card panel-pad dashboard-tile" data-dashboard-card="workload"><div class="panel-heading"><h2 class="section-title">Member Workload</h2><span class="panel-note">${workload.length} members ${canManage()?'· drag to arrange':''}</span></div>
 <div class="workload-donuts">${workload.map(x=>workloadCard(x,data)).join('')||'<p class="small-text muted">Belum ada tugas yang ditugaskan ke anggota.</p>'}</div></section>
 <section class="card panel-pad dashboard-tile" data-dashboard-card="approvals"><div class="panel-heading"><h2 class="section-title">Completion Approval Queue</h2><span class="panel-note">${requests.length} requests</span></div>${requests.length?requests.map(t=>`<div class="task-line" data-action="edit-task" data-id="${safe(t.id)}"><div class="grow"><strong>${safe(t.title)}</strong><span class="sub">${safe(nameOf(t.completion_requested_by))} · ${safe(nameOf(t.assigned_to))}</span></div><span class="badge status-hold">Pending</span></div>`).join(''):'<p class="small-text muted">Tidak ada permohonan Completed yang menunggu.</p>'}${!canApprove()?'<p class="small-text muted">Persetujuan diselesaikan oleh Manager.</p>':''}</section></div>`;
}
function taskCard(t){const cat=categoryOf(t.category_id);return `<article class="task-card" draggable="${canEditTask(t)}" data-task-id="${safe(t.id)}" data-action="edit-task" data-id="${safe(t.id)}"><div class="card-topline"><span class="category-pill" style="background:${safeColor(cat?.color)}18;color:${safeColor(cat?.color)}">${safe(cat?.name||'General')}</span>${taskPriority(t)}</div><div class="task-title">${safe(t.title)}</div>${t.completion_requested_at&&t.status!=='Completed'?'<span class="badge status-hold">Approval Pending</span>':''}<div class="task-desc">${safe(t.notes||projectOf(t.project_id))}</div><div class="task-footer"><div class="flex acenter gap8">${avatar(nameOf(t.assigned_to))}<span class="small-text muted" style="max-width:120px;white-space:nowrap;text-overflow:ellipsis;overflow:hidden">${safe(nameOf(t.assigned_to))}</span></div><span class="due ${dateAlert(t)}">${ic('calendar','sm')}${dateLabel(t.due_date,true)}</span></div></article>`}
function board(){const tasks=filteredTasks();return pageHead('WORK MANAGEMENT','Kanban Board','Drag cards between columns to update progress.',canEdit()?button(ic('plus')+' New Task','new-task'):'')+commonToolbar()+`<div class="kanban">${STATUSES.map(status=>{const column=tasks.filter(t=>t.status===status);return `<div class="kanban-col" data-drop-status="${status}"><div class="col-top"><div class="col-heading"><span class="dot" style="color:${STATUS_COLORS[status]}"></span>${status}<span class="counter">${column.length}</span></div>${canEdit()?`<button class="icon-btn" data-action="new-task" data-status="${status}" title="Add task">${ic('plus','sm')}</button>`:''}</div>${column.map(taskCard).join('')||'<div class="kanban-drop-hint">Drop a task here or create a new one</div>'}</div>`}).join('')}</div>`}
function groupTasksByProject(tasks){
 const groups=new Map();
 for(const t of tasks){
  const project=t.project_id||'__unassigned__';
  if(!groups.has(project))groups.set(project,{id:project,name:t.project_id?projectOf(t.project_id):'Tanpa Project',items:[]});
  groups.get(project).items.push(t);
 }
 return [...groups.values()].sort((a,b)=>a.name.localeCompare(b.name,'id'));
}
function grid(){const data=filteredTasks().slice().sort((a,b)=>{const av=String(a[S.sort]||''),bv=String(b[S.sort]||'');return av.localeCompare(bv,undefined,{numeric:true})*S.sortDir;});const header=(label,key)=>`<button class="table-sort" data-action="sort" data-col="${key}">${label} ${S.sort===key?(S.sortDir===1?'↑':'↓'):''}</button>`;
 return pageHead('TASK REGISTER','Grid View','Work Items grouped under their respective Projects.',button(ic('download')+' Export CSV','export-csv','alt')+button(ic('download')+' Download Laporan','download-report','alt')+(canEdit()?button(ic('plus')+' New Task','new-task'):''))+commonToolbar()+`<div class="table-wrap"><table class="data-table"><thead><tr><th>${header('Work Item','title')}</th><th>Assigned To</th><th>Category</th><th>${header('Status','status')}</th><th>${header('Priority','priority')}</th><th>${header('Start Date','start_date')}</th><th>${header('Due Date','due_date')}</th><th>Project</th></tr></thead><tbody>${groupTasksByProject(data).map(group=>`<tr class="project-group-row"><td colspan="8">${ic('folder','sm')} ${safe(group.name)} <span class="project-group-count">(${group.items.length} Work Items)</span></td></tr>`+group.items.map(t=>`<tr data-action="edit-task" data-id="${safe(t.id)}"><td class="title-cell">${safe(t.title)}</td><td><span class="flex acenter gap8">${avatar(nameOf(t.assigned_to))}${safe(nameOf(t.assigned_to))}</span></td><td>${safe(categoryOf(t.category_id)?.name||'—')}</td><td>${taskStatus(t)}</td><td>${taskPriority(t)}</td><td>${dateLabel(t.start_date)}</td><td class="${dateAlert(t)}">${dateLabel(t.due_date)}</td><td>${safe(projectOf(t.project_id))}</td></tr>`).join('')).join('')||`<tr><td colspan="8">${empty('No matching tasks','Try adjusting your filters.')}</td></tr>`}</tbody></table></div><p class="small-text muted" style="margin-top:13px">Showing ${data.length} of ${S.tasks.length} total work items. Click a row to view details.</p>`;
}
function gantt(){const data=scopeTasks(filteredTasks(),'gantt').filter(t=>t.start_date||t.due_date).slice().sort((a,b)=>String(a.start_date||a.due_date).localeCompare(String(b.start_date||b.due_date)));const dates=Array.from({length:S.ganttDays},(_,i)=>plusDays(S.ganttStart,i));const cell=34;const dateHead=dates.map(date=>{const day=+date.slice(-2),d=parseDateSafe(date),weekend=[0,6].includes(d.getDay());return `<div class="gantt-day ${weekend?'weekend':''} ${date===today()?'today':''}"><span>${WEEKDAYS[(d.getDay()+6)%7]}</span><strong>${day}</strong></div>`}).join('');
 const rows=groupTasksByProject(data).map(group=>`<div class="gantt-project-heading"><div class="gantt-task-label">${ic('folder','sm')} ${safe(group.name)} <small>(${group.items.length})</small></div><div class="gantt-timeline" style="width:${S.ganttDays*cell}px"></div></div>`+group.items.map(t=>{const start=t.start_date||t.due_date,end=t.due_date||t.start_date,offset=dayDiff(S.ganttStart,start),length=dayDiff(start,end)+1;const left=Math.max(0,offset)*cell,right=Math.min(S.ganttDays,offset+length)*cell;const vis=right>left;const bg=STATUS_COLORS[t.status];return `<div class="gantt-task-row"><div class="gantt-task-label gantt-task-child" data-action="edit-task" data-id="${safe(t.id)}"><span class="dot" style="color:${bg}"></span><span title="${safe(t.title)}">${safe(t.title)}</span></div><div class="gantt-timeline" style="width:${S.ganttDays*cell}px"><div class="gantt-grid-cells">${dates.map(dt=>`<span class="gantt-cell ${[0,6].includes(parseDateSafe(dt).getDay())?'weekend':''} ${dt===today()?'today':''}"></span>`).join('')}</div>${vis?`<div class="gantt-bar" style="left:${left+3}px;width:${Math.max(right-left-6,6)}px;background:${bg}" title="${safe(t.title)} · ${dateLabel(start)} — ${dateLabel(end)}" data-action="edit-task" data-id="${safe(t.id)}">${safe(t.title)}</div>`:''}</div></div>`}).join('')).join('');
 let startIndex=0;const months=[];while(startIndex<dates.length){const d=parseDateSafe(dates[startIndex]);const m=d.getMonth(),y=d.getFullYear();let n=1;while(startIndex+n<dates.length){const z=parseDateSafe(dates[startIndex+n]);if(z.getMonth()!==m||z.getFullYear()!==y)break;n++;}months.push(`<div class="gantt-month-cell" style="width:${n*cell}px">${MONTHS[m]} ${y}</div>`);startIndex+=n;}
 return pageHead('PLANNING & SCHEDULING','Timeline / Gantt','Visualize activity windows, deadlines and dependencies over time.',`<button class="btn alt" data-action="gantt-prev">${ic('left','sm')}</button><button class="btn alt" data-action="gantt-today">Today</button><button class="btn alt" data-action="gantt-next">${ic('right','sm')}</button><select class="btn alt" data-change="gantt-zoom" aria-label="Zoom timeline"><option value="28" ${S.ganttDays===28?'selected':''}>4 weeks</option><option value="42" ${S.ganttDays===42?'selected':''}>6 weeks</option><option value="84" ${S.ganttDays===84?'selected':''}>12 weeks</option></select>`)+userTeamFilter('gantt')+commonToolbar()+`<div class="gantt-scroller"><div class="gantt-board"><div class="gantt-head"><div class="gantt-label">Work Item</div><div><div class="gantt-month-row">${months.join('')}</div><div class="gantt-days">${dateHead}</div></div></div>${rows||`<div class="gantt-task-row"><div class="gantt-task-label">No tasks with dates</div></div>`}</div></div><p class="gantt-foot">Timeline ranges are inclusive of start and due dates. Scroll horizontally to see the full period. Tasks without dates are excluded.</p>`;
}
function parseDateSafe(s){return new Date(s+'T12:00:00');}
function calItem(t){return `<button class="cal-item" style="border-left-color:${STATUS_COLORS[t.status]}" data-action="edit-task" data-id="${safe(t.id)}" title="${safe(t.title)}">${safe(t.title)}</button>`;}
function monthCells(y,m,items,mini=false){
 const start=new Date(y,m,1),offset=(start.getDay()+6)%7,days=new Date(y,m+1,0).getDate(),n=Math.ceil((offset+days)/7)*7;
 return Array.from({length:n},(_,i)=>{const d=new Date(y,m,i-offset+1),ds=isoDate(d),tasks=items.filter(t=>taskActiveOnDate(t,ds));return `<div class="cal-cell ${mini?'year-cell':''} ${d.getMonth()!==m?'other':''} ${ds===today()?'today':''}" data-action="calendar-day" data-date="${ds}"><div class="cal-date">${d.getDate()}</div>${mini?(tasks.length?`<span class="year-dot" title="${tasks.length} tasks"></span>`:''):tasks.slice(0,3).map(calItem).join('')}${!mini&&tasks.length>3?`<div class="cal-more">+${tasks.length-3} more</div>`:''}</div>`}).join('');
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
function settings(){return pageHead('CONTROL CENTER','Workspace Settings','Manage your workspace, projects, categories, and profile.')+`<div class="setting-grid"><section class="card setting-block"><h3>Workspace</h3><p>Your active workspace and project environment.</p><div class="field"><label>Current workspace</label><select id="settingsWorkspace" data-change="switch-workspace">${S.workspaces.map(w=>`<option value="${safe(w.id)}" ${w.id===S.workspaceId?'selected':''}>${safe(w.name)}</option>`).join('')}</select></div><div style="margin-top:17px">${button(ic('plus')+' Create workspace','create-workspace','alt')}</div></section>
 <section class="card setting-block"><h3>My Profile</h3><p>Update your personal information and work identity.</p><div class="flex acenter gap12">${avatar(S.profile?.full_name||'?','gold')}<div><strong style="color:var(--forest)">${safe(S.profile?.full_name||'User')}</strong><p style="margin:4px 0 0">${safe(S.profile?.email||'')}</p></div></div><div style="margin-top:17px">${button('Edit profile','profile','alt')}</div></section>
 <section class="card setting-block"><h3>Projects <span class="badge status-not">${S.projects.length}</span></h3><p>Organize work items by projects and programs.</p><div class="tag-list">${S.projects.map(p=>`<span class="management-chip"><span class="category-pill" style="background:${safeColor(p.color)}20;color:${safeColor(p.color)}">${safe(p.name)}</span>${canManage()?`<button type="button" class="icon-btn chip-delete" data-action="delete-project" data-id="${safe(p.id)}" title="Delete project ${safe(p.name)}" aria-label="Delete project ${safe(p.name)}">${ic('trash','sm')}</button>`:''}</span>`).join('')}</div><div style="margin-top:18px">${canEdit()?button(ic('plus')+' Add project','new-project','alt'):''}</div></section>
 <section class="card setting-block"><h3>Categories <span class="badge status-not">${S.categories.length}</span></h3><p>Define a consistent task classification framework.</p><div class="tag-list">${S.categories.map(c=>`<span class="management-chip"><span class="category-pill" style="background:${safeColor(c.color)}20;color:${safeColor(c.color)}">${safe(c.name)}</span>${canManage()?`<button type="button" class="icon-btn chip-delete" data-action="delete-category" data-id="${safe(c.id)}" title="Delete category ${safe(c.name)}" aria-label="Delete category ${safe(c.name)}">${ic('trash','sm')}</button>`:''}</span>`).join('')}</div><div style="margin-top:18px">${canEdit()?button(ic('plus')+' Add category','new-category','alt'):''}</div></section>
 <section class="card setting-block"><h3>Timeline & Schedule</h3><p>Open time-based planning, Gantt tracking, or the team calendar.</p><div class="flex gap8 wrap">${button(ic('gantt')+' Timeline / Gantt','nav-gantt','alt')}${button(ic('calendar')+' Calendar','nav-calendar','alt')}</div></section>
 <section class="card setting-block"><h3>Team Access</h3><p>Control who has access to your workspace and their roles.</p>${button(ic('team')+' Manage members','nav-team','alt')}${canManage()?`<div style="margin-top:12px">${button(ic('copy')+' Invite by code','invite','alt')}</div>`:''}</section>
 <section class="card setting-block"><h3>Data & Deployment</h3><p>${isConnected?'Your data is stored in Supabase and protected by database Row Level Security.':'This workspace uses browser localStorage demo data. Other devices do not share these tasks.'}</p>${button(ic('download')+' Export tasks CSV','export-csv','alt')}<div style="margin-top:10px">${button(ic('download')+' Download Laporan','download-report','alt')}${button(ic('download')+' Simpan PDF','print-report','alt')}</div>${!isConnected?`<div style="margin-top:12px">${button(ic('refresh')+' Reset sample data','reset-demo','flat')}</div>`:''}</section></div>`;
}
function layout(){const m={Dashboard:dashboard,Board:board,Grid:grid,Gantt:gantt,Calendar:calendar,Team:team,Settings:settings};return `<div class="app-shell">${sideBar()}<main class="workspace-main">${topBar()}${!isConnected?`<div class="demo-strip">${ic('warning','sm')}<span><b>DEMO MODE</b> · Data tersimpan di browser ini. Hubungkan Supabase untuk akun dan kolaborasi sungguhan.</span></div>`:''}<div class="content" id="view-content">${(m[S.view]||dashboard)()}</div></main><nav class="mobile-nav">${mobileLink('Dashboard','Home','dashboard')}${mobileLink('Board','Board','board')}${mobileLink('Grid','Tasks','grid')}${mobileLink('Calendar','Calendar','calendar')}${mobileLink('Settings','More','settings')}</nav></div><div id="modal-root"></div>`}
function renderContent(){const el=$('#view-content');if(el){const f=document.activeElement?.id==='globalSearch';el.innerHTML=({Dashboard:dashboard,Board:board,Grid:grid,Gantt:gantt,Calendar:calendar,Team:team,Settings:settings}[S.view]||dashboard)();if(f)$('#globalSearch')?.focus();applyDashboardLayout();}else render();}
function render(){if(!S.isReady){root.innerHTML='<div class="splash"><img src="/icon.svg" width="60" height="60" alt=""/>WorkFlow Planner</div>';return;}if(isConnected&&!store.user){root.innerHTML=authScreen();return;}if(!S.workspaceId){root.innerHTML=onboarding();return;}root.innerHTML=layout();applyDashboardLayout();drawModal();}
function authScreen(){return `<div class="auth-screen"><div class="auth-hero"><div class="brand" style="padding:0">${ic('logo','xl')}<span>WorkFlow<span class="brand-sub">PLANNER</span></span></div><div><h1>Great work starts with <em>great planning.</em></h1><p>Manage your tasks, team, timelines, and approvals in one workspace.</p></div><small>PLAN. EXECUTE. MONITOR. DELIVER.</small></div><div class="auth-panel"><div class="auth-form"><div class="page-eyebrow">WORKFLOW PLANNER V1.5</div><h2>${S.authTab==='signup'?'Create an account':'Welcome back'}</h2><p>${S.authTab==='signup'?'Register with a unique username and verified email.':'Login using username or existing email address.'}</p><form id="authForm">${S.authTab==='signup'?`${formField('Full Name','full_name','','text','required maxlength="100"')}${formField('Username','username','','text','required minlength="3" maxlength="30" pattern="[a-z][a-z0-9_]{2,29}" placeholder="nama_pengguna" title="Huruf kecil, angka, underscore; dimulai huruf"')}${formField('Email Address','email','','email','required autocomplete="email"')}`:formField('Username or Email','identifier','','text','required autocomplete="username" placeholder="username atau email"')}${formField('Password','password','','password',`required minlength="6" autocomplete="${S.authTab==='login'?'current-password':'new-password'}"`)}<button type="submit" class="btn block" style="margin-top:15px">${S.authTab==='signup'?'Create account':'Sign in'} ${ic('right','sm')}</button></form><div class="auth-extra">${S.authTab==='signup'?'Already have an account?':'New to WorkFlow?'} <button class="link-btn" data-action="auth-toggle">${S.authTab==='signup'?'Sign in':'Create account'}</button></div><div class="auth-demo"><p class="small-text muted">${button('Open Demo Preview','demo-preview','flat')}</p></div></div></div></div>`}
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
 try{const items=await store.listTaskChecklist(taskId);if(S.modal==='task'&&S.modalTask?.id===taskId){S.checklistItems=items;S.checklistLoading=false;const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(S.modalTask,!canEditTask(S.modalTask));}}
 catch(err){S.checklistLoading=false;toast('Checklist gagal dimuat: '+err.message,'error');}
}
function commentsPanel(){
 const t=S.modalTask;
 if(!t?.id)return '<p class="small-text muted">Simpan Work Item terlebih dahulu untuk memulai komentar.</p>';
 return `<section class="discussion-panel"><div class="comment-list" aria-live="polite">${S.commentLoading?'<p class="muted">Memuat komentar…</p>':S.taskComments.length?S.taskComments.map(c=>`<article class="comment-entry">${avatar(nameOf(c.author_id))}<div class="comment-main"><div class="comment-header"><strong>${safe(nameOf(c.author_id))}</strong><time>${safe(new Date(c.created_at).toLocaleString('id-ID'))}</time></div><div class="comment-body">${formattedCommentBody(c.body)}</div></div></article>`).join(''):'<p class="muted">Belum ada komentar. Mulai diskusi atau mention anggota menggunakan @username.</p>'}</div><form id="commentForm"><div class="comment-compose"><label for="commentBody">Tulis komentar</label><textarea id="commentBody" name="body" rows="4" minlength="1" maxlength="5000" required placeholder="Tulis pesan… ketik @ untuk mention anggota">${safe(S.commentDraft)}</textarea><div class="mention-suggestions" id="mention-suggestions" ${mentionSuggestionMarkup()?'':'hidden'}>${mentionSuggestionMarkup()}</div><small>@mention akan mengirim notifikasi kepada anggota terkait; penanggung jawab dan pembuat tugas juga mendapat notifikasi komentar.</small></div><div style="margin-top:12px;text-align:right"><button type="submit" class="btn">Kirim Komentar</button></div></form></section>`;
}
function taskDetailContent(){
 return `<div class="task-detail-layout ${S.chatOpen?'chat-open':''}"><div class="task-detail-main">
 <div class="task-detail-tabs"><span class="task-tab active">Work Item Details</span><button type="button" class="task-tab task-chat-toggle ${S.chatOpen?'active':''}" data-action="task-tab" data-tab="comments" aria-expanded="${S.chatOpen}" aria-controls="task-chat-panel">Task Chat ${S.taskComments.length?'<span class="task-tab-count">'+S.taskComments.length+'</span>':''} ${ic('mail','sm')}</button></div>
 ${taskModal()}</div>
 <aside class="task-chat-aside" id="task-chat-panel" aria-label="Task Chat"><div class="task-chat-heading"><strong>Task Chat</strong><button type="button" class="icon-btn" data-action="close-chat" aria-label="Tutup Task Chat">${ic('x','sm')}</button></div>${commentsPanel()}</aside>
 </div>`;
}
async function loadTaskComments(taskId){
 S.commentLoading=true;
 try{const comments=await store.listTaskComments(taskId);
   if(S.modal==='task'&&S.modalTask?.id===taskId){S.taskComments=comments;S.commentLoading=false;const panel=$('#task-chat-panel .discussion-panel');if(panel)panel.outerHTML=commentsPanel();}
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
function attachmentRow(url='',removable=true){
 const link=String(url||'');
 return `<div class="attachment-link-row" data-attachment-row>
 <input data-attachment-input type="url" inputmode="url" maxlength="2048" value="${safe(link)}" placeholder="https://drive.google.com/..." aria-label="Attachment URL (HTTPS)" />
 ${validAttachment(link)&&link?`<a class="attachment-open" href="${safe(link)}" target="_blank" rel="noopener noreferrer">${ic('folder','sm')} Buka</a>`:''}
 ${removable?`<button type="button" class="btn alt small attachment-remove" data-action="remove-attachment" aria-label="Hapus attachment link">${ic('trash','sm')} Hapus</button>`:''}
 </div>`;
}
function taskModal(){
 const t=S.modalTask||{},ro=!canEditTask(t),isPending=!!t.completion_requested_at&&t.status!=='Completed';
  const attachmentLinks=t.attachment_urls??(t.attachment_url?[t.attachment_url]:[]);
 const opts=(data,name,empty,key)=>formSelect(name==='project_id'?'Project':name==='category_id'?'Category':'Assigned To',name,[{value:'',label:empty},...data.map(x=>({value:x.id,label:x[key]}))],t[name]||'');
 const statuses=STATUSES.map(x=>({value:x,label:x==='Completed'&&!canApprove()?'Completed — Request Manager Approval':x}));
 return `<form id="taskForm" class="stack"><fieldset class="task-fields" ${ro?'disabled':''}>
 <div class="field"><label>Work Item <span class="required">*</span></label><input name="title" required maxlength="300" value="${safe(t.title||'')}" placeholder="What needs to be accomplished?"/></div>
 <div class="field-row">${opts(S.people,'assigned_to','Unassigned','full_name')}${opts(S.categories,'category_id','No category','name')}</div>
 <div class="field-row">${opts(S.projects,'project_id','No project','name')}${formSelect('Status Progress','status',statuses,t.status||'Not Started')}</div>
 <div class="field-row">${formSelect('Priority','priority',PRIORITIES.map(x=>({value:x,label:x})),t.priority||'Medium')}${formField('Start Date','start_date',t.start_date||(t.id?'':today()),'date')}</div>
 <div class="field-row">${formField('Due Date','due_date',t.due_date||'','date')}${formField('Key Stakeholders','stakeholders',t.stakeholders||'','text','maxlength="500"')}</div>
 <div class="field"><label>Notes</label><textarea name="notes" rows="4" placeholder="Background, deliverables, next steps...">${safe(t.notes||'')}</textarea></div>
 <div id="checklist-section">${checklistPanel(t,ro)}</div>
 <div class="field" data-attachment-section ${t.status==='In Progress'?'':'hidden'}>
  <label>Attachment Links (HTTPS)</label>
  <div id="attachment-link-list" class="attachment-link-list">${attachmentLinks.map(url=>attachmentRow(url,!ro)).join('')}</div>
  ${!ro?`<button type="button" class="btn alt small" data-action="add-attachment">${ic('plus','sm')} Add Link</button>`:''}
  <small>Tambahkan atau hapus tautan HTTPS, lalu klik <b>Save Work Item</b> untuk menyimpan perubahan. Maksimal 20 tautan. Attachment hanya ditampilkan saat status In Progress. Tidak ada file yang diunggah ke server.</small>
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
function reportModal(){
 return `<form id="reportForm" class="stack">
 <p class="small-text muted">Satu berkas PDF berisi 6 KPI, Timeline/Gantt, dan Grid seluruh Work Item sesuai filter.</p>
 <div class="field"><label>Laporan berdasarkan</label><select name="report_scope" data-change="report-scope"><option value="all" ${S.reportType==='all'?'selected':''}>All Work Items</option><option value="user" ${S.reportType==='user'?'selected':''}>User / Member</option><option value="project" ${S.reportType==='project'?'selected':''}>Project</option><option value="category" ${S.reportType==='category'?'selected':''}>Categories</option></select></div>
 <div id="reportTargetField">${reportTargetField()}</div>
 <div class="notice-box">KPI: Total Work Items, In Progress, On Hold, Completed, Pending Approval dan Overdue Tasks. Jadwal ditampilkan sebagai Gantt dan daftar Grid dalam PDF yang sama.</div>
 </form>`;
}
function createWorkspaceModal(){return `<form id="workspaceModalForm" class="stack">${formField('Workspace name','name','','text','required minlength="2" maxlength="120" placeholder="Example: Operations PMO"')}<p class="small-text muted">Setiap workspace memiliki proyek, kategori, tugas dan anggota tersendiri.</p></form>`}
function createNamedModal(kind){return `<form id="${kind==='project'?'projectForm':'categoryForm'}" class="stack">${formField(kind==='project'?'Project Name':'Category Name','name','','text',`required maxlength="${kind==='project'?120:80}" placeholder="Name"`)}<div class="field"><label>Color</label><input name="color" type="color" value="${kind==='project'?'#3f6276':'#c89b55'}" style="height:50px;padding:7px;width:100%"/></div></form>`}
function switchModal(){return `<div class="stack"><p class="small-text muted">Select a workspace to switch projects, tasks, and team.</p><div class="workspace-switcher">${S.workspaces.map(w=>`<button class="workspace-choice ${S.workspaceId===w.id?'selected':''}" data-action="select-workspace" data-id="${safe(w.id)}">${safe(w.name)}</button>`).join('')}</div>${button(ic('plus')+' New Workspace','create-workspace','alt')}</div>`}
function drawModal(){const el=$('#modal-root');if(!el)return;if(!S.modal){el.innerHTML='';return;}const def={task:{title:S.modalTask?.id?'Work Item Details':'Create New Task',content:taskDetailContent(),form:'taskForm',save:'Save Work Item'},invite:{title:'Invite Team Members',content:inviteModal()},profile:{title:'Edit My Profile',content:profileModal(),form:'profileForm',save:'Save Profile'},member:{title:'Edit Team Member',content:editMemberModal(),form:'memberForm',save:'Save Member'},workspace:{title:'Create Workspace',content:createWorkspaceModal(),form:'workspaceModalForm',save:'Create Workspace'},project:{title:'Add New Project',content:createNamedModal('project'),form:'projectForm',save:'Create Project'},category:{title:'Add New Category',content:createNamedModal('category'),form:'categoryForm',save:'Create Category'},report:{title:'Download Integrated PDF Report',content:reportModal(),form:'reportForm',save:'Download PDF'},switch:{title:'Switch Workspace',content:switchModal()}}[S.modal];if(!def)return;
 const buttons=`${S.modal==='task'&&S.modalTask?.id&&canEditTask(S.modalTask)?`<button class="btn danger small" type="button" data-action="delete-task">${ic('trash','sm')} Delete</button>`:'<span></span>'}<div class="flex gap8">${S.modal==='invite'&&isConnected?button(ic('refresh','sm')+' Rotate Code','rotate-code','alt'):''}<button class="btn alt" type="button" data-action="close-modal">Close</button>${S.modal==='task'&&S.modalTask?.id&&S.modalTask.completion_requested_at&&canApprove()?`${button(ic('x','sm')+' Reject','reject-completion','alt')}${button(ic('check','sm')+' Approve Completed','approve-completion','primary')}`:''}${S.modal==='task'&&S.modalTask?.id&&!S.modalTask.completion_requested_at&&S.modalTask.status==='In Progress'&&!canApprove()&&canEditTask(S.modalTask)?button('Request Completed','request-completion','alt'):''}${def.form&&!(S.modal==='task'&&!canEditTask(S.modalTask))?`<button type="submit" form="${def.form}" class="btn">${def.save}</button>`:''}</div>`;
 el.innerHTML=`<div class="modal-shade" data-action="close-if-shade"><div class="modal ${S.modal==='task'?'task-modal':''}" role="dialog" aria-modal="true" aria-label="${safe(def.title)}"><div class="modal-head"><h2>${safe(def.title)}</h2><button class="icon-btn" data-action="close-modal" aria-label="Close">${ic('x')}</button></div><div class="modal-body">${def.content}</div><div class="modal-actions">${buttons}</div></div></div>`;
}
function openModal(type,task=null){S.modal=type;S.modalTask=task;S.taskTab='work';S.chatOpen=false;S.checklistItems=[];S.draftChecklist=[];S.checklistLoading=!!task?.id;S.taskComments=[];S.commentDraft='';S.commentCaret=0;S.commentLoading=!!task?.id;drawModal();if(type==='task'&&task?.id){void loadTaskComments(task.id);void loadTaskChecklist(task.id);}setTimeout(()=>$('#modal-root input[name=title]')?.focus(),0)}
function closeModal(){S.modal=null;S.modalTask=null;drawModal()}
async function refreshWorkspace(){if(!S.workspaceId)return;const w=await store.loadWorkspace(S.workspaceId);Object.assign(S,w);render()}
async function reloadWorkspaces(id=null){S.workspaces=await store.listWorkspaces();S.profile=await store.getProfile();const chosen=id||S.workspaceId;S.workspaceId=S.workspaces.some(w=>w.id===chosen)?chosen:(S.workspaces[0]?.id||null);if(S.workspaceId){Object.assign(S,await store.loadWorkspace(S.workspaceId));}else{S.members=[];S.people=[];S.projects=[];S.categories=[];S.tasks=[];}S.filter={status:'',priority:'',category:'',assignee:'',project:''};S.viewFilters={};S.dashboardTeam='';S.dashboardUser='';S.ganttTeam='';S.ganttUser=store.user?.id||'';S.search='';S.noticeItems=[];render();void refreshNotices();}
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
 case 'new-task':if(canEdit())openModal('task',{status:node.dataset.status||'Not Started',assigned_to:store.user?.id||'',start_date:node.dataset.date||today(),due_date:node.dataset.date||'',project_id:taskFilter().project||''});break;
 case 'edit-task':{const t=S.tasks.find(x=>x.id===node.dataset.id);if(t)openModal('task',{...t});break;}
  case 'add-attachment':{
    if(S.modal!=='task'||!canEditTask(S.modalTask))break;
    const form=$('#taskForm'),list=$('#attachment-link-list');
    if(!list||form?.elements?.status?.value!=='In Progress')break;
    if(list.querySelectorAll('[data-attachment-row]').length>=20){toast('Maksimal 20 Attachment Link per Work Item','error');break;}
    list.insertAdjacentHTML('beforeend',attachmentRow('',true));
    list.lastElementChild?.querySelector('input')?.focus();
    break;
  }
  case 'remove-attachment':{
    if(S.modal!=='task'||!canEditTask(S.modalTask))break;
    node.closest('[data-attachment-row]')?.remove();
    break;
  }
 case 'close-modal':closeModal();break;
 case 'close-if-shade':if(node===eventTargetCache)closeModal();break;
 case 'profile':openModal('profile');break;
  case 'edit-member':{if(node.dataset.id===store.user?.id){openModal('profile');break;}if(!canManage())break;const m=S.members.find(x=>x.user_id===node.dataset.id);if(!m||(!isOwner()&&m.role==='super_admin'))break;S.modalMemberId=m.user_id;openModal('member');break;}
  case 'delete-project':{if(!canManage())break;const p=S.projects.find(x=>x.id===node.dataset.id);if(!p)break;const count=S.tasks.filter(t=>t.project_id===p.id).length;if(!confirm(`Hapus project "${p.name}"?\n${count} Work Item tetap tersimpan, tetapi akan kehilangan label Project. Tindakan ini tidak dapat dibatalkan.`))break;await busy(async()=>{await store.deleteProject(S.workspaceId,p.id);if(S.filter.project===p.id)S.filter.project='';await refreshWorkspace();toast('Project deleted. Work Items tetap tersimpan.');});break;}
  case 'delete-category':{if(!canManage())break;const c=S.categories.find(x=>x.id===node.dataset.id);if(!c)break;const count=S.tasks.filter(t=>t.category_id===c.id).length;if(!confirm(`Hapus category "${c.name}"?\n${count} Work Item tetap tersimpan, tetapi akan kehilangan label Category. Tindakan ini tidak dapat dibatalkan.`))break;await busy(async()=>{await store.deleteCategory(S.workspaceId,c.id);if(S.filter.category===c.id)S.filter.category='';await refreshWorkspace();toast('Category deleted. Work Items tetap tersimpan.');});break;}
 case 'invite':if(canManage())openModal('invite');break;
 case 'switch-workspace':openModal('switch');break;
 case 'create-workspace':openModal('workspace');break;
 case 'new-project':if(canEdit())openModal('project');break;
 case 'new-category':if(canEdit())openModal('category');break;
 case 'select-workspace':S.modal=null;await busy(()=>reloadWorkspaces(node.dataset.id));break;
 case 'clear-filters':if(['Board','Grid','Gantt'].includes(S.view))S.viewFilters[S.view]={status:'',priority:'',category:'',assignee:'',project:''};else S.filter={status:'',priority:'',category:'',assignee:'',project:''};if(S.view==='Gantt'){S.ganttUser='';S.ganttTeam='';}S.search='';render();break;
 case 'sort':if(S.sort===node.dataset.col)S.sortDir=-S.sortDir;else {S.sort=node.dataset.col;S.sortDir=1;}renderContent();break;
 case 'download-report':S.reportType='all';S.reportId='';openModal('report');break;
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
document.addEventListener('click',async e=>{const node=e.target.closest('[data-action]');if(!node)return;eventTargetCache=e.target;await act(node.dataset.action,node);});
document.addEventListener('change',async e=>{
 const target=e.target;
 if(target.dataset.filter){taskFilter()[target.dataset.filter]=target.value;if(S.view==='Gantt'&&target.dataset.filter==='assignee')S.ganttUser=target.value;renderContent();return;}
 if(target.dataset.scope){S[target.dataset.scope]=target.value;const prefix=target.dataset.scope.startsWith('dashboard')?'dashboard':'gantt';if(target.dataset.scope.endsWith('Team'))S[prefix+'User']='';if(prefix==='gantt')taskFilter().assignee=S.ganttUser||'';renderContent();return;}
 if(target.dataset.change==='gantt-zoom'){S.ganttDays=Number(target.value);renderContent();return;}
 if(target.dataset.change==='cal-view'){S.calView=target.value;renderContent();return;}
 if(target.dataset.change==='report-scope'){S.reportType=target.value;S.reportId='';const panel=$('#reportTargetField');if(panel)panel.innerHTML=reportTargetField();return;}
 if(target.dataset.change==='switch-workspace'){await busy(()=>reloadWorkspaces(target.value));return;}
 if(target.dataset.checklistToggle){const t=S.modalTask;if(!canEditTask(t))return;if(!t?.id){const item=S.draftChecklist.find(x=>x.id===target.dataset.checklistToggle);if(item)item.is_done=target.checked;const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(t,false);return;}const item=S.checklistItems.find(x=>x.id===target.dataset.checklistToggle);if(!item)return;await busy(async()=>{await store.setChecklistDone(t.id,item.id,target.checked);S.checklistItems=await store.listTaskChecklist(t.id);const panel=$('#checklist-section');if(panel)panel.innerHTML=checklistPanel(t,!canEditTask(t));});return;}
 if(target.name==='status'&&target.closest('#taskForm')){const section=document.querySelector('[data-attachment-section]');if(section)section.hidden=target.value!=='In Progress';return;}
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
document.addEventListener('input',e=>{if(e.target.id==='commentBody'){S.commentDraft=e.target.value;S.commentCaret=e.target.selectionStart;const sugg=$('#mention-suggestions');if(sugg){sugg.innerHTML=mentionSuggestionMarkup();sugg.hidden=!sugg.innerHTML;}return;}if(e.target.id==='globalSearch'||e.target.id==='mobileSearch'){const mobile=e.target.id==='mobileSearch';const cursor=e.target.selectionStart;S.search=e.target.value;renderContent();if(mobile){const input=$('#mobileSearch');input?.focus();if(input&&cursor!==null)input.setSelectionRange(cursor,cursor);}}});
document.addEventListener('submit',async e=>{const form=e.target;if(!['authForm','taskForm','profileForm','workspaceForm','joinForm','workspaceModalForm','projectForm','categoryForm','commentForm','memberForm','reportForm'].includes(form.id))return;e.preventDefault();const data=Object.fromEntries(new FormData(form).entries());
 await busy(async()=>{
  if(form.id==='reportForm'){
  const scope=String(data.report_scope||'all'),id=String(data.report_id||'');
  const selected=filterPlannerReport(S.tasks,{scope,id});
  const names={all:'All Work Items',user:'Member: '+(S.people.find(x=>x.id===id)?.full_name||''),project:'Project: '+(S.projects.find(x=>x.id===id)?.name||''),category:'Category: '+(S.categories.find(x=>x.id===id)?.name||'')};
  await downloadPlannerPDF({tasks:selected,people:S.people,projects:S.projects,categories:S.categories,workspaceName:workspace()?.name||'Workspace',selectionLabel:names[scope]||'All Work Items'});
  S.modal=null;drawModal();toast('Laporan PDF berhasil dibuat ('+selected.length+' Work Items).');return;
 }
 if(form.id==='commentForm'){const t=S.modalTask;if(!t?.id||!S.workspaceId)throw Error('Work Item belum tersimpan');const text=String(data.body||'').trim();if(!text)throw Error('Tuliskan komentar terlebih dahulu');await store.addTaskComment(t,text,mentionedUserIds(text,S.people));S.commentDraft='';S.commentCaret=0;S.taskComments=await store.listTaskComments(t.id);S.commentLoading=false;S.taskTab='comments';S.chatOpen=true;const body=$('#task-chat-panel .discussion-panel');if(body)body.outerHTML=commentsPanel();toast('Komentar tersimpan dan notifikasi terkirim');return;}
  if(form.id==='authForm'){if(S.authTab==='login'){if(data.identifier.includes('@'))await store.login(data.identifier.trim(),data.password);else await store.loginByUsername(data.identifier.trim().toLowerCase(),data.password);await reloadWorkspaces();toast('Welcome back!');}else{const response=await store.signup(data.full_name,data.email,data.password,data.username.trim().toLowerCase());if(response?.access_token){await reloadWorkspaces();toast('Your account is ready!');}else{S.authTab='login';render();toast('Account created. Check your inbox to confirm your email before signing in.');}}return;}
  if(form.id==='joinForm'){S.pendingJoin=data.code;const wsId=await store.joinWorkspace(data.code);S.pendingJoin='';await reloadWorkspaces(wsId);toast('You joined the workspace!');return;}
  if(form.id==='workspaceForm'||form.id==='workspaceModalForm'){const ws=await store.createWorkspace(data.name.trim());S.modal=null;await reloadWorkspaces(ws.id);toast('Workspace created');return;}
  if(form.id==='memberForm'){const m=S.members.find(x=>x.user_id===S.modalMemberId);if(!canManage()||!m||m.user_id===store.user?.id||(!isOwner()&&m.role==='super_admin'))throw Error('Anda tidak memiliki izin untuk mengedit member ini.');const full_name=String(data.full_name||'').trim(),job_title=String(data.job_title||'').trim();if(full_name.length<2||full_name.length>100||job_title.length>120)throw Error('Nama 2–100 karakter, Job/Position maksimal 120 karakter.');await store.updateMemberDetails(S.workspaceId,m.user_id,full_name,job_title);S.modal=null;S.modalMemberId=null;await refreshWorkspace();toast('Identitas member berhasil diperbarui.');return;}
   if(form.id==='profileForm'){if(!data.full_name.trim())throw Error('Full name is required');if(!/^[a-z][a-z0-9_]{2,29}$/.test(data.username))throw Error('Username: 3–30 karakter, huruf kecil/angka/underscore');await store.updateProfile({username:data.username.trim(),full_name:data.full_name.trim(),job_title:data.job_title.trim()});S.modal=null;await reloadWorkspaces(S.workspaceId);toast('Profile updated');return;}
  if(form.id==='projectForm'){await store.createProject({workspace_id:S.workspaceId,name:data.name.trim(),color:data.color});S.modal=null;await refreshWorkspace();toast('Project created');return;}
  if(form.id==='categoryForm'){await store.createCategory({workspace_id:S.workspaceId,name:data.name.trim(),color:data.color});S.modal=null;await refreshWorkspace();toast('Category created');return;}
  if(form.id==='taskForm'){
   if(!canEditTask(S.modalTask))throw Error('Read-only access');
   if(!data.title?.trim())throw Error('Work Item cannot be empty');
   if(data.start_date&&data.due_date&&data.due_date<data.start_date)throw Error('Due Date cannot be earlier than Start Date');
   const attachment_urls=normalizeAttachmentUrls([...(form.querySelectorAll?.('[data-attachment-input]')||[])].map(input=>input.value));
   const needsRequest=data.status==='Completed'&&!canApprove();
   const task={workspace_id:S.workspaceId,project_id:data.project_id||null,title:data.title.trim(),assigned_to:data.assigned_to||null,category_id:data.category_id||null,status:needsRequest?'In Progress':data.status,priority:data.priority,start_date:data.start_date||null,due_date:data.due_date||null,notes:data.notes||'',stakeholders:data.stakeholders||'',attachment_url:attachment_urls[0]||'',attachment_urls};
   if(S.modalTask?.id)task.id=S.modalTask.id;else task.created_by=store.user.id;
   const saved=!task.id?await store.saveNewTaskWithChecklist(task,S.draftChecklist):await store.saveTask(task);if(needsRequest){await store.requestCompletion(saved);};S.modal=null;S.draftChecklist=[];await refreshWorkspace();toast(needsRequest?'Completed diajukan ke Manager':(S.modalTask?.id?'Work item updated':'New work item created'));S.modalTask=null;return;
  }
 });
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
