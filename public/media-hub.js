import {safe} from './core.js';
import {PLATFORMS,STATUSES,FORMATS,PILLARS,jakartaDate,shift,weekStart,schoolPerformance,validPost,csvCell,monthRange,inContentRange,resolvePublicationStatus,analyticsSummary} from './media-core.js';
const roleLabel={arf_manager:'ARF Manager',arf_media_coordinator:'Koordinator Media Sosial ARF',school_media_coordinator:'Koordinator Media Sosial Sekolah'};
const esc=v=>safe(String(v??''));
const opts=(values,current)=>values.map(v=>'<option value="'+esc(typeof v==='string'?v:v.id)+'" '+((typeof v==='string'?v:v.id)===current?'selected':'')+'>'+esc(typeof v==='string'?v:v.name)+'</option>').join('');
const field=(label,name,value='',type='text',extra='')=>'<label class="mh-field">'+esc(label)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const select=(label,name,values,current)=>'<label class="mh-field">'+esc(label)+'<select name="'+name+'">'+opts(values,current)+'</select></label>';
const area=(label,name,value)=>'<label class="mh-field">'+esc(label)+'<textarea name="'+name+'" rows="3">'+esc(value)+'</textarea></label>';
const button=(text,action,id='',extra='')=>'<button type="button" class="btn alt" data-mh="'+action+'" data-id="'+esc(id)+'" '+extra+'>'+esc(text)+'</button>';
export async function mediaMembership(store){
 if(!store.connected||!store.user)return null;
 try{const rows=await store.rest('media_members','GET','?select=user_id,role,school_id,active,display_name&user_id=eq.'+encodeURIComponent(store.user.id)+'&active=eq.true');return rows[0]||null;}catch(e){console.warn('Media Hub unavailable',e.message);return null;}
}
async function all(store,table,order){
 const rows=[];for(let offset=0;;offset+=500){const part=await store.rest(table,'GET','?select=*&order='+order+'&limit=500&offset='+offset);rows.push(...part);if(part.length<500)return rows;}
}
function downloadCSV(rows,filename){
 const url=URL.createObjectURL(new Blob(['\ufeff'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),500);
}
export async function plannerUserDirectory(store){
 if(store.isDemo)return store.plannerDirectory();
 const workspaces=await store.listWorkspaces(), users=new Map();
 for(const w of workspaces){
  const id=encodeURIComponent(w.id);
  const self=await store.rest('workspace_members','GET','?select=role&workspace_id=eq.'+id+'&user_id=eq.'+encodeURIComponent(store.user.id));
  if(!self.some(m=>['manager','super_admin'].includes(m.role)))continue;
  for(let offset=0;;offset+=250){
   const rows=await store.rest('workspace_members','GET','?select=user_id,role,display_name&workspace_id=eq.'+id+'&order=user_id.asc&limit=250&offset='+offset);
   for(let i=0;i<rows.length;i+=50){
    const chunk=rows.slice(i,i+50);
    const profiles=await store.rest('profiles','GET','?select=id,full_name,username&id=in.('+chunk.map(m=>encodeURIComponent(m.user_id)).join(',')+')');
    for(const m of chunk){
     const p=profiles.find(p=>p.id===m.user_id);if(!p)continue;
     const u=users.get(p.id)||{id:p.id,name:p.full_name||m.display_name||p.username||'Unnamed user',username:p.username||'',planner_roles:[]};
     u.planner_roles.push({workspace:w.name,role:m.role});users.set(p.id,u);
    }
   }
   if(rows.length<250)break;
  }
 }
 return [...users.values()].sort((a,b)=>a.name.localeCompare(b.name));
}
export function mountMediaHub(root,{store,membership,onPlanner,onLogout,hasPlanner,demo}){
 const host=document.createElement('section');host.className='mh-shell';root.replaceChildren(host);
 const uid=store.user?.id;let member=membership,schools=[],contents=[],members=[],view='Dashboard',week=weekStart(jakartaDate()),schoolFilter='',platformFilter='',editId='',editingSchool='',editingMember='',loading=true,error='',notice='',busy=false;
 const central=()=>member?.role==='arf_manager'||member?.role==='arf_media_coordinator';const manager=()=>member?.role==='arf_manager';
 let directory=[],directoryError='',userQuery='',selectedUser='',draftRole='school_media_coordinator',draftSchool='',draftActive=true,draftName='';
 let rangeMode='month',registryMonth=jakartaDate().slice(0,7),rangeStart=week,rangeEnd=shift(week,6),registryStatus='',registryPillar='',registryQuery='';
 let scope=membership?.role==='arf_media_coordinator'?'foundation':'schools';
 const accountKind=id=>schools.find(s=>s.id===id)?.kind;
 const scopeSchools=()=>schools.filter(s=>!central()||s.kind===(scope==='foundation'?'foundation':'school'));
 const canProduce=id=>manager()||(member?.role==='arf_media_coordinator'&&accountKind(id)==='foundation')||(member?.role==='school_media_coordinator'&&id===member.school_id);
 const canReview=c=>central()&&c.created_by!==uid&&c.status==='Published'&&(manager()||accountKind(c.school_id)==='school');
 const canNew=()=>scopeSchools().some(s=>s.active&&canProduce(s.id));
 const alive=()=>host.isConnected&&store.user?.id===uid;
 const schoolName=id=>schools.find(s=>s.id===id)?.name||'Sekolah';
 const current=()=>contents.filter(c=>scopeSchools().some(s=>s.id===c.school_id)&&(!schoolFilter||c.school_id===schoolFilter)&&(!platformFilter||c.platform===platformFilter));
 const period=c=>{const d=c.actual_date||c.planned_date;return d>=week&&d<=shift(week,6);};
 const perf=()=>schoolPerformance(scopeSchools().filter(s=>!schoolFilter||s.id===schoolFilter),contents,week);
 function table(headers,rows){return '<div class="mh-table"><table><thead><tr>'+headers.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+x+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
 const link=c=>demo&&validPost(c.platform,c.published_url)?'<span title="Tautan simulasi, bukan unggahan sungguhan">Bukti demo</span>':validPost(c.platform,c.published_url)?'<a target="_blank" rel="noopener noreferrer" href="'+esc(c.published_url)+'">Buka publikasi</a>':'—';
 function actions(c){return button('Detail','edit',c.id)+(canReview(c)?button('Verifikasi','verify',c.id)+button('Revisi','revise',c.id):'');}
 function gridRows(list){return table(['Judul / Akun','PIC / Pelaksana','Platform','Rencana','Aktual','Status','Bukti','Tindakan'],list.map(c=>['<b>'+esc(c.title)+'</b><br><small>'+esc(schoolName(c.school_id))+'</small>',esc(c.pic_name||'Belum diisi'),esc(c.platform)+'<br>'+esc(c.format),esc(c.planned_date),esc(c.actual_date||'—'),'<span class="mh-status">'+esc(c.status)+'</span>',link(c),actions(c)]));}
 function registryRange(){return rangeMode==='month'?monthRange(registryMonth):{start:rangeStart,end:rangeEnd};}
 function registryRows(){const {start,end}=registryRange();const q=registryQuery.toLowerCase().trim();return current().filter(c=>inContentRange(c,start,end)&&(!registryStatus||c.status===registryStatus)&&(!registryPillar||c.pillar===registryPillar)&&(!q||[c.title,c.pic_name,schoolName(c.school_id)].some(v=>String(v||'').toLowerCase().includes(q)))).sort((a,b)=>String(b.actual_date||b.planned_date).localeCompare(String(a.actual_date||a.planned_date)));}
 function filters(){
 const registry=view==='Content Table';
 const time=registry?'<label>Period Type<select id="mh-range-mode">'+opts([{id:'month',name:'Month'},{id:'range',name:'Custom Date Range'}],rangeMode)+'</select></label>'+(rangeMode==='month'?'<label>Month<input type="month" id="mh-month" value="'+esc(registryMonth)+'"></label>':'<label>Start Date<input type="date" id="mh-start" value="'+esc(rangeStart)+'"></label><label>End Date<input type="date" id="mh-end" value="'+esc(rangeEnd)+'"></label>'):'<div class="mh-week-group"><label>Week<input type="date" id="mh-week" value="'+esc(week)+'"></label><div class="mh-week-buttons">'+button('‹','prev','','aria-label="Previous week"')+button('›','next','','aria-label="Next week"')+'</div></div>';
 const extra=registry?'<label>Status<select id="mh-reg-status"><option value="">All statuses</option>'+opts(STATUSES,registryStatus)+'</select></label><label>Content Pillar<select id="mh-reg-pillar"><option value="">All pillars</option>'+opts(PILLARS,registryPillar)+'</select></label><label>Search / PIC<input type="search" id="mh-reg-query" value="'+esc(registryQuery)+'" placeholder="Title or PIC"></label>':'';
 const dates=registry?registryRange():{start:week,end:shift(week,6)};
 return '<div class="mh-filter">'+time+(central()&&scope==='schools'?'<label>School<select id="mh-school"><option value="">All schools</option>'+opts(scopeSchools(),schoolFilter)+'</select></label>':'')+'<label>Platform<select id="mh-platform"><option value="">All platforms</option>'+opts(PLATFORMS,platformFilter)+'</select></label>'+extra+button('Refresh','refresh')+'</div><p class="mh-muted">Period: '+esc(dates.start)+' – '+esc(dates.end)+' · WIB · '+(central()&&scope==='foundation'?'Official ARF accounts · publication target not set.':'School target: 2 Instagram + 2 TikTok per week.')+'</p>';
 }
 function registry(){
 const rows=registryRows(),d=registryRange();
 if(d.start>d.end)return '<p class="mh-error">Start date must be on or before end date.</p>';
 return '<section class="card mh-panel"><div class="mh-actions"><h2>Content Table</h2>'+button('Export CSV','registry-export')+(canNew()?button('Add Content','new'):'')+'</div><p class="mh-muted">'+rows.length+' content records · all statuses · planned or actual publication date in selected period.</p>'+table(['No.','Content Title / Account','PIC','Platform','Format','Content Pillar','Planned Date','Actual Date','Status','Published URL','Views','Likes','Comments','Shares','Actions'],rows.map((c,i)=>[String(i+1),'<b>'+esc(c.title)+'</b><br><small>'+esc(schoolName(c.school_id))+'</small>',esc(c.pic_name||'—'),esc(c.platform),esc(c.format),esc(c.pillar),esc(c.planned_date),esc(c.actual_date||'—'),'<span class="mh-status">'+esc(c.status)+'</span>',link(c),esc(c.views??'—'),esc(c.likes??'—'),esc(c.comments??'—'),esc(c.shares??'—'),actions(c)]))+(rows.length?'':'<p>No content matches the selected filters.</p>')+'</section>';
 }
 function bars(title,items,suffix='',fixedMax=0){
 const max=Math.max(1,fixedMax,...items.map(x=>Number(x.value)||0));
 return '<section class="card mh-chart"><h3>'+esc(title)+'</h3>'+(!items.length?'<p class="mh-muted">No data for this period.</p>':items.map(x=>'<div class="mh-bar-row"><div><span>'+esc(x.label)+'</span><strong>'+esc(Number(x.value).toLocaleString('en-US')+suffix)+'</strong></div><div class="mh-bar-track"><span style="width:'+Math.max(0,Math.min(100,Number(x.value)/max*100))+'%;background:'+(x.label==='TikTok'?'#3f6276':'#009b4c')+'"></span></div></div>').join(''))+'</section>';
 }
 function dashboardVisuals(){
 const rows=current(),end=shift(week,6),a=analyticsSummary(rows,week,end);
 const trend=Array.from({length:6},(_,i)=>{const s=shift(week,(i-5)*7),t=analyticsSummary(rows,s,shift(s,6));return {label:s.slice(5),value:t.published};});
 const metrics=[['Views',a.views],['Likes',a.likes],['Comments',a.comments],['Shares',a.shares]];
 const top=a.top;
 return '<section class="card mh-panel"><h2>Performance Overview</h2><p class="mh-muted">Selected week · Published and Verified records · manually recorded metrics; '+a.measured+' of '+a.published+' publications have metrics.</p><div class="mh-kpis">'+[['Total Content',a.total],['Published Content',a.published],['Verified Content',a.verified],...metrics.map(x=>[x[0],a.measured?x[1].toLocaleString('en-US'):'—'])].map(x=>'<div class="card mh-kpi"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('')+'</div><div class="mh-chart-grid">'+bars('Publication by Platform',a.platforms)+bars('Content Status Distribution',a.statuses)+bars('Weekly Publication Trend · Last 6 Weeks',trend)+bars('Content Pillar Distribution',a.pillars)+(scope==='schools'?bars('School Compliance Score',perf().map(s=>({label:s.name,value:s.score})),'%',100):'')+(scope==='schools'?bars('Verified Posts by School',perf().map(s=>({label:s.name,value:s.ig+s.tt}))):'')+'</div><h3>Top Performing Content · by Views</h3>'+ (top.length?table(['Content','Account','PIC','Platform','Views','Likes','Comments','Shares'],top.map(c=>[esc(c.title),esc(schoolName(c.school_id)),esc(c.pic_name||'—'),esc(c.platform),esc(c.views??'—'),esc(c.likes??'—'),esc(c.comments??'—'),esc(c.shares??'—')])):'<p class="mh-muted">No recorded views for this period.</p>')+'</section>';
 }
 function dashboard(){
 if(central()&&scope==='foundation'){
 const list=current().filter(c=>c.actual_date>=week&&c.actual_date<=shift(week,6)&&['Published','Verified'].includes(c.status));
 const counts=PLATFORMS.map(p=>[p,list.filter(c=>c.platform===p).length]);
 return '<div class="mh-kpis">'+[...counts,['Terverifikasi',list.filter(c=>c.status==='Verified').length],['Menunggu review Manager',list.filter(c=>c.status==='Published').length]].map(x=>'<div class="card mh-kpi"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('')+'</div><section class="card mh-panel"><h2>ARF Official Account Performance</h2><p>Publikasi Instagram dan TikTok resmi ARF. Target minimum akun pusat belum ditetapkan dan tidak dicampur dengan KPI sekolah.</p>'+gridRows(list)+button('Export CSV','report')+'</section>';
 }
 const p=perf(),n=p.length,avg=n?Math.round(p.reduce((a,s)=>a+s.score,0)/n):0,complete=p.filter(s=>s.score===100).length,pending=p.reduce((a,s)=>a+s.pending,0);
 return '<div class="mh-kpis">'+[['Sekolah aktif',n],['Target terpenuhi',complete+'/'+n],['Capaian rata-rata',avg+'%'],['Menunggu verifikasi',pending]].map(x=>'<div class="card mh-kpi"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('')+'</div><section class="card mh-panel"><h2>School Performance</h2><p>Hanya bukti berstatus Verified yang dihitung. Kelebihan tidak menutupi kekurangan platform lain.</p>'+table(['Sekolah','Instagram','TikTok','Capaian','Menunggu'],p.map(s=>[esc(s.name),esc(s.ig)+'/2',esc(s.tt)+'/2','<b>'+s.score+'%</b><div class="mh-progress"><i style="width:'+s.score+'%"></i></div>',esc(s.pending)]))+button('Export CSV','report')+'</section>';
 }
 function calendar(){const cs=current();return '<div class="mh-calendar">'+Array.from({length:7},(_,i)=>{const d=shift(week,i);return '<section class="card mh-day"><h3>'+esc(d)+'</h3>'+cs.filter(c=>c.planned_date===d).map(c=>'<div class="mh-item"><b>'+esc(c.title)+'</b><small>'+esc(c.platform)+' · '+esc(schoolName(c.school_id))+'</small><small>PIC: '+esc(c.pic_name||'Belum diisi')+'</small>'+actions(c)+'</div>').join('')+'</section>';}).join('')+'</div>';}
 function board(){return '<div class="mh-board">'+STATUSES.map(status=>'<section class="mh-lane"><h3>'+esc(status)+'</h3>'+current().filter(c=>c.status===status&&period(c)).map(c=>'<article class="card mh-item"><b>'+esc(c.title)+'</b><small>'+esc(c.platform)+' · '+esc(schoolName(c.school_id))+'</small><small>PIC: '+esc(c.pic_name||'Belum diisi')+'</small><small>'+esc(c.planned_date)+'</small>'+actions(c)+'</article>').join('')+'</section>').join('')+'</div>';}
 function analytics(){return '<section class="card mh-panel"><h2>Performance Analytics</h2><p>Input manual metrik per publikasi. Tanggal pengamatan wajib diisi; angka kosong bukan nol.</p>'+table(['Konten','PIC / Pelaksana','Platform','Tanggal metrik','Views','Likes','Comments','Shares','Detail'],current().filter(c=>c.status==='Verified'&&period(c)).map(c=>[esc(c.title),esc(c.pic_name||'Belum diisi'),esc(c.platform),esc(c.metrics_date||'—'),esc(c.views??'—'),esc(c.likes??'—'),esc(c.comments??'—'),esc(c.shares??'—'),button(canProduce(c.school_id)?'Edit metrik':'Detail','edit',c.id)]))+'</section>';}
 function editContent(){
 const c=contents.find(x=>x.id===editId)||{school_id:schoolFilter||member.school_id||scopeSchools().find(s=>s.active&&canProduce(s.id))?.id,pic_name:member.display_name||'',platform:'Instagram',format:'Feed',planned_date:jakartaDate(),status:'Planned',pillar:PILLARS[0]};
 const locked=c.status==='Verified',own=canProduce(c.school_id)&&(!c.id||c.created_by===uid||central());
 return '<section class="card mh-panel"><h2>'+esc(c.id?'Content Details':'Add Content')+'</h2>'+(c.feedback?'<p class="mh-feedback"><b>Feedback:</b> '+esc(c.feedback)+'</p>':'')+'<form id="mh-content"><input type="hidden" name="id" value="'+esc(c.id)+'"><fieldset '+(locked||!own?'disabled':'')+'>'+(c.id?'<p><b>Account:</b> '+esc(schoolName(c.school_id))+'</p>':select('Account / School','school_id',scopeSchools().filter(s=>s.active&&canProduce(s.id)),c.school_id))+field('Content Title','title',c.title,'text','required maxlength="200"')+field('Person in Charge (PIC) / Content Creator','pic_name',c.pic_name,'text','required maxlength="150" placeholder="Enter the name of the person responsible for this content"')+select('Platform','platform',PLATFORMS,c.platform)+select('Content Format','format',FORMATS[c.platform],c.format)+select('Content Pillar','pillar',PILLARS,c.pillar)+area('Content Brief','brief',c.brief)+area('Caption / Script','caption',c.caption)+field('Asset Link (HTTPS)','asset_url',c.asset_url,'url')+field('Planned Publication Date','planned_date',c.planned_date,'date','required')+select('Status','status',['Idea','Planned','In Production','Ready','Scheduled','Published',...(c.status==='Revision'?['Revision']:[]),...(locked?['Verified']:[])],c.status)+field('Actual Publication Date (WIB)','actual_date',c.actual_date,'date')+field('Published Content URL','published_url',c.published_url,'url')+'<small class="mh-muted">A valid publication URL automatically sets Published on save. Actual publication date and media consent are required.</small>'+'<label><input type="checkbox" name="permission_checked" '+(c.permission_checked?'checked':'')+'> Media consent, child privacy, and copyright have been checked</label></fieldset>'+(locked&&own?'<fieldset><legend>Publication Metrics</legend>'+['views','likes','comments','shares'].map(k=>field(k[0].toUpperCase()+k.slice(1),k,c[k],'number','min="0" step="1"')).join('')+field('Metrics Recording Date','metrics_date',c.metrics_date,'date')+'</fieldset>':'')+'<div class="mh-actions">'+(own?'<button class="btn" type="submit">Save</button>':'')+button('Back','close-edit')+'</div></form></section>';
 }
 function administration(){
 const s=schools.find(x=>x.id===editingSchool)||{},m=members.find(x=>x.user_id===editingMember)||{};
 return '<section class="card mh-panel"><h2>School & Account Management</h2>'+table(['Nama','Jenis','Regional (filter)','Instagram','TikTok','Aktif',''],schools.map(x=>[esc(x.name),esc(x.kind),esc(x.regional),esc(x.instagram_handle),esc(x.tiktok_handle),x.active?'Ya':'Tidak',button('Edit','edit-school',x.id)]))+'<form id="mh-school-form"><h3>'+esc(s.id?'Edit sekolah':'Tambah sekolah / akun ARF')+'</h3>'+field('Nama','name',s.name,'text','required maxlength="180"')+select('Jenis','kind',[{id:'school',name:'Sekolah'},{id:'foundation',name:'Akun resmi ARF'}],s.kind||'school')+field('Regional (atribut saja)','regional',s.regional)+field('Instagram handle','instagram_handle',s.instagram_handle)+field('TikTok handle','tiktok_handle',s.tiktok_handle)+'<label><input name="active" type="checkbox" '+(s.active===false?'':'checked')+'> Aktif</label><button class="btn">Simpan sekolah</button>'+button('Reset','reset-school')+'</form></section>';
 }
 function userManagement(){
 const byId=new Map(directory.map(u=>[u.id,u]));
 const ids=[...new Set([...directory.map(u=>u.id),...members.map(m=>m.user_id)])];
 const roleText=r=>({super_admin:'Super Admin',manager:'Manager',assistant_manager:'Assistant Manager',specialist:'Specialist',admin:'Admin',officer:'Officer'}[r]||r);
 const rolesFor=u=>u?.planner_roles?.map(r=>r.workspace+' — '+roleText(r.role)).join('; ')||'—';
 const label=id=>byId.get(id)?.name||members.find(m=>m.user_id===id)?.display_name||id;
 const q=userQuery.trim().toLowerCase();
 const matching=ids.filter(id=>!q||[label(id),byId.get(id)?.username,rolesFor(byId.get(id)),roleLabel[members.find(m=>m.user_id===id)?.role]].some(v=>String(v||'').toLowerCase().includes(q)));
 const target=members.find(m=>m.user_id===editingMember),chosen=byId.get(selectedUser);
 const available=directory.filter(u=>!members.some(m=>m.user_id===u.id));
 const options=[{id:'',name:'Select an existing Workflow Planner user'},...available.map(u=>({id:u.id,name:u.name+(u.username?' (@'+u.username+')':'')+' · '+rolesFor(u)}))];
 const rows=matching.map(id=>{
  const u=byId.get(id),m=members.find(m=>m.user_id===id);
  return ['<b>'+esc(label(id))+'</b>'+(u?.username?'<br><small>@'+esc(u.username)+'</small>':''),esc(rolesFor(u)),m?.active?'<span class="mh-access-on">Active</span>':m?'<span class="mh-access-off">Revoked</span>':'<span class="mh-access-off">Not assigned</span>',esc(roleLabel[m?.role]||'—'),esc(m?.school_id?schoolName(m.school_id):m?'All ARF':'—'),m?.role==='arf_manager'?'Protected':m?button('Edit','edit-member',id)+(m.active?button('Revoke','revoke-member',id):button('Restore','edit-member',id)):button('Grant Access','grant-member',id)];
 });
 const schoolRequired=draftRole==='school_media_coordinator';
 return '<section class="card mh-panel"><h2>User & Role Management</h2><p>One user account, separate module permissions. Existing Workflow Planner roles are never changed here.</p>'+(directoryError?'<p class="mh-error">'+esc(directoryError)+'</p>':'')+'<div class="mh-kpis">'+[['Planner users in managed workspaces',directory.length],['Active Media Hub users',members.filter(m=>m.active).length],['Dual access',members.filter(m=>m.active&&byId.has(m.user_id)).length]].map(([k,v])=>'<div class="card mh-kpi"><small>'+esc(k)+'</small><strong>'+v+'</strong></div>').join('')+'</div><div class="mh-filter"><label>Search Users<input type="search" id="mh-user-query" value="'+esc(userQuery)+'" placeholder="Name, username or role"></label>'+button('Refresh','refresh')+'</div>'+table(['User','Workflow Planner Role / Workspace','Media Hub Access','Media Hub Role','School / Scope','Actions'],rows)+(rows.length?'':'<p>No matching users.</p>')+'<p class="mh-muted">Planner roles reflect workspaces you manage. A dash means no visible membership in those workspaces, not necessarily no Planner access elsewhere.</p></section><section class="card mh-panel"><h2>'+esc(target?'Edit Media Hub Access':'Grant Media Hub Access')+'</h2><form id="mh-member-form">'+(target?'<p><b>User:</b> '+esc(label(target.user_id))+'</p>':select('Existing Workflow Planner User','user_id',options,selectedUser))+(chosen||target?'<p class="mh-muted">Workflow Planner: '+esc(rolesFor(chosen||byId.get(target?.user_id)))+'</p>':'')+field('Display Name','display_name',draftName,'text','maxlength="100"')+select('Media Hub Role','role',[{id:'arf_media_coordinator',name:'ARF Social Media Coordinator'},{id:'school_media_coordinator',name:'School Social Media Coordinator'}],draftRole)+(schoolRequired?select('Assigned School','school_id',[{id:'',name:'Select a school'},...schools.filter(x=>x.kind==='school'&&(x.active||x.id===draftSchool))],draftSchool):'<p class="mh-muted">Access scope: all schools and official ARF accounts.</p>')+'<label><input name="active" type="checkbox" '+(draftActive?'checked':'')+'> Media Hub access active</label><div class="mh-actions"><button class="btn" type="submit" '+(!target&&!selectedUser?'disabled':'')+'>Save Access</button>'+button('Reset','reset-member')+'</div></form><p class="mh-muted">The initial ARF Manager is protected. Grants and revocations affect only ARF Media Hub.</p></section>';
 }
 function resetUserDraft(id='',grant=false){
 const m=members.find(x=>x.user_id===id),u=directory.find(x=>x.id===id);
 editingMember=grant?'':id;selectedUser=grant?id:'';
 draftRole=m?.role||'school_media_coordinator';draftSchool=m?.school_id||'';draftName=m?.display_name||u?.name||'';draftActive=m?.active??true;
 }

 function render(){
 if(!alive())return;
 const nav=['Dashboard','Content Workspace','Content Calendar','Content Table','Published Content',...(central()?['Review & Feedback']:[]),'Performance Analytics',...(manager()?['User & Role Management','Administration']:[])];
 let body=loading?'<p>Memuat data…</p>':!member?'<p>Akses ARF Media Hub ditolak atau telah dicabut.</p>':error?'<p class="mh-error">'+esc(error)+'</p>'+button('Coba lagi','refresh'):editId?editContent():view==='Dashboard'?dashboard()+dashboardVisuals():view==='Content Workspace'?board():view==='Content Calendar'?calendar():view==='Content Table'?registry():view==='Published Content'?gridRows(current().filter(c=>['Published','Verified','Revision'].includes(c.status)&&period(c))):view==='Review & Feedback'?gridRows(current().filter(c=>c.status==='Published'||c.status==='Revision')):view==='Performance Analytics'?analytics():view==='User & Role Management'?userManagement():administration();
 host.innerHTML=(demo?'<div class="mh-demo-bar" style="padding:12px 20px;background:#fff1d5;color:#603d0a;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><strong>DEMO · Data simulasi lokal</strong><label> Coba sebagai <select id="mh-demo-role">'+(typeof demo.roles==='function'?demo.roles():demo.roles).map(r=>'<option value="'+esc(r.id)+'" '+(r.id===demo.selected?'selected':'')+'>'+esc(r.display_name)+'</option>').join('')+'</select></label>'+button('Reset data demo','reset-demo')+'<small>Tidak tersambung ke database produksi.</small></div>':'')+'<header class="mh-header"><div><small>WORKFLOW PLANNER · MODULE 02</small><h1>ARF Media Hub</h1><p>'+esc(roleLabel[member?.role]||'Tidak berwenang')+'</p></div><div class="mh-actions">'+(hasPlanner?button('Workflow Planner','planner'):'')+button('Sign out','logout')+'</div></header>'+(member?'<nav class="mh-nav">'+nav.map(n=>button(n,'nav',n,n===view?'aria-current="page"':'')).join('')+'</nav>':'')+'<main class="mh-main">'+(central()&&member&&!loading?'<div class="mh-actions mh-scope-switch" style="margin-bottom:16px">'+button('Konten Resmi ARF','scope','foundation',scope==='foundation'?'aria-current="page"':'')+button('Monitoring Sekolah','scope','schools',scope==='schools'?'aria-current="page"':'')+'</div>':'')+(notice?'<p class="mh-notice" role="status">'+esc(notice)+'</p>':'')+(!loading&&!error&&member&&!editId&&!['Administration','User & Role Management'].includes(view)?filters()+(view==='Content Workspace'&&canNew()?button('+ Tambah konten','new'):view==='Content Workspace'&&scope==='foundation'&&central()&&!scopeSchools().some(s=>s.active)?'<p class="mh-muted">Akun resmi ARF belum tersedia. Manager perlu menambahkannya di Administration.</p>':''):'')+body+'</main>';
 }
 async function load(){
 if(!alive())return;loading=true;error='';render();
 try{member=await mediaMembership(store);if(!member){schools=[];contents=[];members=[];return;}
 [schools,contents]=await Promise.all([all(store,'media_schools','name.asc,id.asc'),all(store,'media_contents','created_at.desc,id.asc')]);
 members=manager()?await all(store,'media_members','display_name.asc,user_id.asc'):[];directory=[];directoryError='';if(manager()){try{directory=await plannerUserDirectory(store);}catch(e){directoryError='Could not load Workflow Planner users: '+e.message;}}
 }catch(e){error=e.message||'Gagal memuat ARF Media Hub';}finally{loading=false;render();}
 }
 async function save(tableName,id,key,payload){
 const result=await store.rest(tableName,id?'PATCH':'POST',id?'?'+key+'=eq.'+encodeURIComponent(id):'',payload);
 if(!Array.isArray(result)||!result.length)throw Error('Perubahan ditolak atau data tidak ditemukan.');
 }
 async function run(fn){if(busy||!alive())return;busy=true;notice='';try{await fn();}catch(e){notice=e.message||'Operasi gagal';render();}finally{busy=false;}}
 host.addEventListener('click',e=>{const b=e.target.closest('[data-mh]');if(!b)return;const a=b.dataset.mh,id=b.dataset.id;
 if(a==='reset-demo'&&demo){if(confirm('Reset seluruh data simulasi di browser ini?'))demo.onReset();return;}if(a==='planner'){onPlanner();return;}if(a==='logout'){onLogout();return;}
 if(a==='scope'&&central()){scope=id==='foundation'?'foundation':'schools';schoolFilter='';platformFilter='';editId='';notice='';view='Dashboard';render();return;}if(a==='nav'){view=id;editId='';notice='';render();return;}if(a==='prev'||a==='next'){week=shift(week,a==='prev'?-7:7);render();return;}
 if(a==='refresh'){void run(load);return;}if(a==='edit'||a==='new'){if(a==='new'&&!canNew())return;editId=a==='new'?'new':id;render();return;}if(a==='close-edit'){editId='';render();return;}
 if(a==='edit-school'||a==='reset-school'){editingSchool=id;render();return;}if(['edit-member','reset-member','grant-member'].includes(a)&&manager()){if(a==='edit-member'&&members.find(m=>m.user_id===id)?.role==='arf_manager')return;resetUserDraft(a==='reset-member'?'':id,a==='grant-member');render();return;}if(a==='revoke-member'&&manager()){const m=members.find(x=>x.user_id===id);if(!m||m.role==='arf_manager'||!confirm('Revoke ARF Media Hub access only? Workflow Planner access will remain unchanged.'))return;void run(async()=>{await save('media_members',id,'user_id',{active:false});resetUserDraft();notice='Media Hub access revoked.';await load();});return;}
 if(a==='registry-export'){const rows=registryRows(),d=registryRange();if(d.start>d.end)return;downloadCSV([['Content Title','Account','PIC','Platform','Format','Pillar','Planned Date','Actual Date','Status','Published URL','Views','Likes','Comments','Shares'],...rows.map(c=>[c.title,schoolName(c.school_id),c.pic_name,c.platform,c.format,c.pillar,c.planned_date,c.actual_date,c.status,c.published_url,c.views,c.likes,c.comments,c.shares])],'ARF-content-'+d.start+'-to-'+d.end+'.csv');return;}
 if(a==='report'&&scope==='foundation'&&central()){downloadCSV([['Judul','PIC','Platform','Tanggal aktual','Status'],...current().filter(c=>period(c)&&['Published','Verified'].includes(c.status)).map(c=>[c.title,c.pic_name,c.platform,c.actual_date,c.status])],'ARF-official-'+week+'.csv');return;}if(a==='report'){downloadCSV([['Sekolah','Instagram','TikTok','Capaian (%)','Menunggu verifikasi'],...perf().map(s=>[s.name,s.ig,s.tt,s.score,s.pending])],'ARF-media-'+week+'.csv');return;}
 if(a==='verify'||a==='revise'){const c=contents.find(x=>x.id===id);if(!c||!canReview(c))return;let feedback='';
 if(a==='verify'){if(!confirm('Pastikan tautan aktif, akun sekolah benar, tanggal dan jenis konten sesuai. Verifikasi publikasi ini?'))return;}else{feedback=prompt('Catatan revisi (wajib):')?.trim();if(!feedback)return;}
 void run(async()=>{await save('media_contents',id,'id',{status:a==='verify'?'Verified':'Revision',feedback});notice='Review tersimpan.';await load();});}
 });
 host.addEventListener('change',e=>{const t=e.target;if(t.id==='mh-demo-role'&&demo){demo.onRole(t.value);return;}if(t.id==='mh-user-query'){userQuery=t.value;render();return;}if(t.form?.id==='mh-member-form'){const f=t.form;draftName=f.elements.display_name.value;draftActive=f.elements.active.checked;draftRole=f.elements.role.value;draftSchool=f.elements.school_id?.value||'';if(t.name==='user_id'){selectedUser=t.value;draftName=directory.find(u=>u.id===selectedUser)?.name||'';render();return;}if(t.name==='role'){render();return;}}if(t.id==='mh-range-mode'){rangeMode=t.value;render();return;}if(t.id==='mh-month'&&t.value){registryMonth=t.value;render();return;}if(t.id==='mh-start'&&t.value){rangeStart=t.value;render();return;}if(t.id==='mh-end'&&t.value){rangeEnd=t.value;render();return;}if(t.id==='mh-reg-status'){registryStatus=t.value;render();return;}if(t.id==='mh-reg-pillar'){registryPillar=t.value;render();return;}if(t.id==='mh-reg-query'){registryQuery=t.value;render();return;}if(t.id==='mh-week'&&t.value){week=weekStart(t.value);render();}if(t.id==='mh-school'){schoolFilter=t.value;render();}if(t.id==='mh-platform'){platformFilter=t.value;render();}if(t.name==='platform'&&t.form?.id==='mh-content')t.form.elements.format.innerHTML=opts(FORMATS[t.value],FORMATS[t.value][0]);});
 host.addEventListener('input',e=>{const t=e.target,f=t.form;if(!f||f.id!=='mh-content'||!['published_url','actual_date','permission_checked','platform'].includes(t.name))return;const u=f.elements.published_url.value.trim();if(validPost(f.elements.platform.value,u))f.elements.status.value='Published';else if(f.elements.status.value==='Published')f.elements.status.value='Scheduled';});
 host.addEventListener('submit',e=>{const f=e.target;if(!f.id.startsWith('mh-'))return;e.preventDefault();const d=Object.fromEntries(new FormData(f));
 void run(async()=>{
 if(f.id==='mh-content'){
 const c=contents.find(x=>x.id===d.id);
 if(c?.status==='Verified'){const p={};for(const k of ['views','likes','comments','shares'])p[k]=d[k]===''?null:Number(d[k]);p.metrics_date=d.metrics_date||null;if(Object.values(p).some(v=>typeof v==='number')&&!p.metrics_date)throw Error('Metrics recording date is required.');await save('media_contents',c.id,'id',p);}
 else {const p={title:d.title.trim(),pic_name:(d.pic_name||'').trim(),platform:d.platform,format:d.format,pillar:d.pillar,brief:d.brief,caption:d.caption,asset_url:d.asset_url,planned_date:d.planned_date,actual_date:d.actual_date||null,published_url:d.published_url.trim(),permission_checked:d.permission_checked==='on',status:d.status};
 if(!c)p.school_id=d.school_id;
 if(!p.pic_name)throw Error('Person in Charge (PIC) / Content Creator is required.');if(!canProduce(c?.school_id||p.school_id))throw Error('Content production access denied.');
 p.status=resolvePublicationStatus(p);
 await save('media_contents',c?.id,'id',p);}
 editId='';notice='Content saved successfully.';
 }else if(f.id==='mh-school-form'&&manager()){await save('media_schools',editingSchool,'id',{name:d.name.trim(),kind:d.kind,regional:d.regional,instagram_handle:d.instagram_handle,tiktok_handle:d.tiktok_handle,active:d.active==='on'});editingSchool='';notice='Sekolah tersimpan.';}
 else if(f.id==='mh-member-form'&&manager()){if(!['arf_media_coordinator','school_media_coordinator'].includes(d.role))throw Error('Invalid Media Hub role.');if(d.role==='school_media_coordinator'&&!d.school_id)throw Error('Assigned School is required.');if(!editingMember&&!directory.some(u=>u.id===d.user_id))throw Error('Select an existing Workflow Planner user.');const p={role:d.role,display_name:d.display_name.trim(),school_id:d.role==='school_media_coordinator'?d.school_id:null,active:d.active==='on'};if(!editingMember)p.user_id=d.user_id;await save('media_members',editingMember,'user_id',p);resetUserDraft();notice='Media Hub access saved. Workflow Planner access unchanged.';}
 await load();
 });
 });
 render();void load();
}
