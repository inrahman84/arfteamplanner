export const STATUSES=['Not Started','In Progress','On Hold','Completed'];
export const PRIORITIES=['Low','Medium','High','Critical'];
export const MONTHS=['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
export const WEEKDAYS=['Sen','Sel','Rab','Kam','Jum','Sab','Min'];
export const STATUS_COLORS={'Not Started':'#89958b','In Progress':'#3f6276','On Hold':'#c89b55','Completed':'#009b4c'};
export const PRIORITY_COLORS={Low:'#809789',Medium:'#608bb1',High:'#c89b55',Critical:'#c45a52'};
export const safe=(value='')=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
export const safeColor=(value)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?value:'#3f6276';
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
  const rows=tasks.map(t=>[t.title,peopleMap[t.assigned_to]||'',categoryMap[t.category_id]||'',projectMap[t.project_id]||'',t.status,t.priority,t.start_date||'',t.due_date||'',t.notes||'',t.stakeholders||'',t.status==='In Progress'?(t.attachment_url||''):'',t.completion_requested_at?'Pending':'']);
  return '\uFEFF'+[keys,...rows].map(row=>row.map(csvQuote).join(',')).join('\r\n');
}

export const ROLES=[['super_admin','Super Admin'],['manager','Manager'],['assistant_manager','Asisten Manager'],['specialist','Specialist'],['admin','Admin'],['officer','Officer']];
export const roleLabel=r=>ROLES.find(x=>x[0]===r)?.[1]||r;
export const validAttachment=u=>!u || (/^https:\/\/[^\s]+$/i.test(u) && u.length<=2048);
