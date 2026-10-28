export const STATUSES=['Not Started','In Progress','On Hold','Completed'];
export const PRIORITIES=['Low','Medium','High','Critical'];
export const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const WEEKDAYS=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
export const STATUS_COLORS={'Not Started':'#89958b','In Progress':'#3f6276','On Hold':'#c89b55','Completed':'#009b4c'};
export const PRIORITY_COLORS={Low:'#809789',Medium:'#608bb1',High:'#c89b55',Critical:'#c45a52'};
export const safe=(value='')=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const safeColor=(value)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?value:'#3f6276';
export function parseUserColor(input){
 const value=String(input??'').trim();
 let match=value.match(/^#?([0-9a-f]{6})$/i);
 if(match)return '#'+match[1].toLowerCase();
 match=value.match(/^#?([0-9a-f]{3})$/i);
 if(match)return '#'+[...match[1].toLowerCase()].map(ch=>ch+ch).join('');
 match=value.match(/^(?:rgb\s*\(\s*)?(\d{1,3})\s*[,;]\s*(\d{1,3})\s*[,;]\s*(\d{1,3})\s*\)?$/i);
 if(match){
  const values=match.slice(1).map(Number);
  if(values.some(n=>n>255))throw Error('Nilai RGB harus 0–255');
  return '#'+values.map(n=>n.toString(16).padStart(2,'0')).join('');
 }
 throw Error('Gunakan kode HEX #RRGGBB atau RGB 0–255, 0–255, 0–255');
}
export function colorToRGB(hex){
 const value=parseUserColor(hex);
 return [1,3,5].map(i=>parseInt(value.slice(i,i+2),16)).join(', ');
}
export const isoDate=(d)=>{const x=new Date(d);return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0')};
export const today=()=>isoDate(new Date());
export const parseDate=(s)=>s?new Date(String(s).slice(0,10)+'T12:00:00'):null;
export const plusDays=(s,n)=>{const d=parseDate(s);if(!d)return today();d.setDate(d.getDate()+n);return isoDate(d)};
export const dayDiff=(a,b)=>Math.round((Date.parse(String(b).slice(0,10)+'T00:00:00Z')-Date.parse(String(a).slice(0,10)+'T00:00:00Z'))/86400000);
export const dateLabel=(s,short=false)=>{const d=parseDate(s);if(!d)return '—';return new Intl.DateTimeFormat('id-ID',short?{day:'numeric',month:'short'}:{day:'numeric',month:'short',year:'numeric'}).format(d)};
export const statusClass=(s)=>s==='Completed'?'status-done':s==='In Progress'?'status-prog':s==='On Hold'?'status-hold':'status-not';
export const priorityClass=(p)=>'priority-'+String(p||'Medium').toLowerCase();
export const overdue=(task,day=today())=>Boolean(task.due_date && task.due_date<day && task.status!=='Completed');
export const initials=(s='?')=>String(s).trim().split(/\s+/).slice(0,2).map(x=>x[0]?.toUpperCase()||'').join('')||'?';
export const uuid=()=>globalThis.crypto?.randomUUID?.()||'demo-'+Date.now()+'-'+Math.random().toString(36).slice(2);
// project_ids is canonical for V1.7; original project_id remains available
// for tasks created before the migration and older clients.
export function projectIds(task){
 const ids=Array.isArray(task?.project_ids)?task.project_ids.filter(Boolean):[];
 return ids.length?[...new Set(ids)]:task?.project_id?[task.project_id]:[];
}
export function projectProgress(tasks,projects){
 const rows=projects.map(project=>{
  const matching=tasks.filter(t=>projectIds(t).includes(project.id));
  const done=matching.filter(t=>t.status==='Completed').length;
  return {id:project.id,name:project.name,color:safeColor(project.color),total:matching.length,completed:done,percent:matching.length?Math.round(done/matching.length*100):0};
 });
 const projectSet=new Set(projects.map(p=>p.id));
 const unique=tasks.filter(t=>projectIds(t).some(id=>projectSet.has(id)));
 const completed=unique.filter(t=>t.status==='Completed').length;
 return {projects:rows,total:unique.length,completed,percent:unique.length?Math.round(completed/unique.length*100):0};
}
export const metrics=(tasks,day=today())=>{
  const total=tasks.length,notStarted=tasks.filter(t=>t.status==='Not Started').length,inProgress=tasks.filter(t=>t.status==='In Progress').length,onHold=tasks.filter(t=>t.status==='On Hold').length,completed=tasks.filter(t=>t.status==='Completed').length;
  const late=tasks.filter(t=>overdue(t,day)).length;
  const upcoming=tasks.filter(t=>t.due_date&&t.due_date>=day&&t.due_date<=plusDays(day,7)&&t.status!=='Completed').length;
  return {total,notStarted,inProgress,onHold,completed,pending:tasks.filter(t=>t.completion_requested_at&&t.status!=='Completed').length,late,upcoming,percent:total?Math.round(completed/total*100):0};
};
export const csvQuote=x=>'"'+String(x??'').replace(/"/g,'""')+'"';
export function csvExport(tasks,people,categories,projects){
  const peopleMap=Object.fromEntries(people.map(p=>[p.id,p.full_name]));
  const categoryMap=Object.fromEntries(categories.map(p=>[p.id,p.name]));
  const projectMap=Object.fromEntries(projects.map(p=>[p.id,p.name]));
  const keys=['Work Item','Assigned To','Category','Project','Status','Priority','Start Date','Due Date','Notes','Key Stakeholders','Attachment Link','Completion Requested'];
  const rows=tasks.map(t=>[t.title,peopleMap[t.assigned_to]||'',categoryMap[t.category_id]||'',projectIds(t).map(id=>projectMap[id]).filter(Boolean).join(' ; '),t.status,t.priority,t.start_date||'',t.due_date||'',t.notes||'',t.stakeholders||'',t.status==='In Progress'?(t.attachment_urls||[t.attachment_url].filter(Boolean)).join(' ; '):'',t.completion_requested_at?'Pending':'']);
  return '\uFEFF'+[keys,...rows].map(row=>row.map(csvQuote).join(',')).join('\r\n');
}

export const ROLES=[['super_admin','Super Admin'],['manager','Manager'],['assistant_manager','Asisten Manager'],['specialist','Specialist'],['admin','Admin'],['officer','Officer']];
export const roleLabel=r=>ROLES.find(x=>x[0]===r)?.[1]||r;
export const validAttachment=u=>!u || (/^https:\/\/[^\s]+$/i.test(u) && u.length<=2048);
export function normalizeAttachmentUrls(values){
 if(!Array.isArray(values))throw Error('Attachment links must be a list');
 const urls=values.map(value=>String(value||'').trim()).filter(Boolean);
 if(urls.length>20)throw Error('Maksimal 20 Attachment Link per Work Item');
 for(const u of urls)if(!validAttachment(u))throw Error('Attachment harus menggunakan HTTPS yang valid (maksimal 2048 karakter)');
 if(new Set(urls).size!==urls.length)throw Error('Attachment link tidak boleh duplikat');
 return urls;
}


// Calendar ranges are inclusive. A single populated date is a one-day work item.
export function taskActiveOnDate(task, date) {
  const start = task.start_date || task.due_date;
  const end = task.due_date || task.start_date;
  if (!start || !end || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date >= start && date <= end;
}
// Stable percentages for member-level workload charts.
export function workloadSegments(tasks) {
  const status = ['Not Started','In Progress','On Hold','Completed'];
  return status.map(name=>({status:name,count:tasks.filter(t=>t.status===name).length}));
}
