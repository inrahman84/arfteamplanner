
import {store,isConnected} from './store.js';
import {safe,validAttachment} from './core.js';
import {createMediaPerformanceXlsx} from './media-export.js';
import {loadJsPDF} from './pdf-report.js';
import {mediaWeekStart,mediaWeeklyScore,mediaMonthlyScore,mediaMonthMondays,mediaPeriodFor,mediaRoleLabel,mediaStatuses} from './media-utils.js';

const root=document.getElementById('media-root');
const PLATFORM=['Instagram','TikTok'];
const MENU=['Dashboard','Content Workspace','Content Calendar','Content Table','Published Content','Review & Feedback','Performance Analytics','Administration','User & Role Management'];
const statusOptions=['Planned','In Production','In Review','Revision','Approved','Scheduled','Published'];
const M={view:'Dashboard',member:null,profile:null,schools:[],accounts:[],targets:[],categories:[],contents:[],publications:[],metrics:[],reviews:[],members:[],people:[],school:'',platform:'',week:mediaWeekStart(),month:new Date().toISOString().slice(0,7),scope:'ALL',userFilter:'',modal:null,editing:null,busy:false,error:'',toast:'',mobileMenu:false};
const central=()=>['ARF_MANAGER','ARF_MEDIA_COORDINATOR'].includes(M.member?.role);
const manager=()=>M.member?.role==='ARF_MANAGER';
const userSchool=()=>M.member?.role==='SCHOOL_MEDIA_COORDINATOR'?M.member.school_id:null;
const schoolBy=id=>M.schools.find(s=>s.id===id);
const personBy=id=>M.people.find(p=>p.id===id)?.full_name||M.members.find(m=>m.user_id===id)?.user_id?.slice(0,8)||'—';
const schoolName=id=>schoolBy(id)?.name||'ARF';
const accountLabel=a=>(a?.scope==='ARF'?'ARF':schoolName(a?.school_id))+' · '+(a?.platform||'');
const latestMetrics=id=>M.metrics.find(m=>m.publication_id===id)||null;
const reviewFor=c=>c?.author_role==='ARF_MEDIA_COORDINATOR'?'ARF Manager':c?.author_role==='SCHOOL_MEDIA_COORDINATOR'?'Koordinator ARF':'ARF Manager';
const canReview=c=>central()&&!(c?.created_by===store.user?.id&&c?.author_role!=='ARF_MANAGER')&&(c?.author_role!=='ARF_MEDIA_COORDINATOR'||manager());
const formatOptions=['Video Reels','Photo Feed Tunggal','Photo Feed Carousel'];
const text=safe;
const fmt=date=>date?new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Pontianak',day:'2-digit',month:'short',year:'numeric'}).format(new Date(date)):'—';
const escapeId=id=>encodeURIComponent(id);
const textLink=(url,label)=>validAttachment(url)&&url?'<a class="mh-link" href="'+text(url)+'" target="_blank" rel="noopener noreferrer">'+text(label||url)+'</a>':'—';
const button=(label,action,attrs='')=>'<button type="button" class="mh-btn" data-mh-action="'+action+'" '+attrs+'>'+label+'</button>';
const options=(data,selected,empty='',name='name')=>(empty?'<option value="">'+text(empty)+'</option>':'')+data.map(x=>'<option value="'+text(x.id)+'" '+(String(x.id)===String(selected||'')?'selected':'')+'>'+text(x[name])+'</option>').join('');
const input=(label,name,value='',type='text',extra='')=>'<label class="mh-field"><span>'+text(label)+'</span><input type="'+type+'" name="'+name+'" value="'+text(value||'')+'" '+extra+' /></label>';
const select=(label,name,children,extra='')=>'<label class="mh-field"><span>'+text(label)+'</span><select name="'+name+'" '+extra+'>'+children+'</select></label>';
const fieldText=(label,name,value='',required=false)=>'<label class="mh-field"><span>'+text(label)+'</span><textarea name="'+name+'" rows="3" '+(required?'required':'')+'>'+text(value||'')+'</textarea></label>';
function busy(action){if(M.busy)return;M.busy=true;render();Promise.resolve().then(action).catch(err=>{M.error=err.message||'Permintaan gagal.';console.error(err);render();}).finally(()=>{M.busy=false;render()});}
function notify(value){M.toast=value;M.error='';render();}
async function refresh(){
 const id=store.user?.id;if(!id)throw Error('Silakan login menggunakan akun WorkFlow Planner.');
 const own=await store.rest('media_members','GET','?select=*&user_id=eq.'+escapeId(id)+'&active=eq.true&limit=1');
 M.member=own[0]||null;
 if(!M.member){M.schools=[];M.contents=[];render();return;}
 const data=await Promise.all([
  store.getProfile(),store.rest('media_schools','GET','?select=*&order=name.asc&limit=500'),
  store.rest('media_accounts','GET','?select=*&order=platform.asc&limit=500'),
  store.rest('media_targets','GET','?select=*&order=effective_from.desc&limit=500'),
  store.rest('media_categories','GET','?select=*&order=name.asc'),
  store.rest('media_contents','GET','?select=*&order=created_at.desc&limit=1200'),
  store.rest('media_publications','GET','?select=*&order=created_at.desc&limit=2000'),
  store.rest('media_metrics','GET','?select=*&order=updated_at.desc&limit=2000'),
  store.rest('media_reviews','GET','?select=*&order=created_at.desc&limit=500'),
  central()?store.rest('media_members','GET','?select=*&order=created_at.asc&limit=500'):Promise.resolve([]),
  central()?store.rest('profiles','GET','?select=id,username,full_name&order=full_name.asc&limit=500'):Promise.resolve([])
 ]);
 [M.profile,M.schools,M.accounts,M.targets,M.categories,M.contents,M.publications,M.metrics,M.reviews,M.members,M.people]=data;
 if(!central())M.people=[{id:store.user.id,full_name:M.profile?.full_name||'My Account'}];
 if(!central())M.school=M.member.school_id;
 else if(M.school&&!M.schools.some(s=>s.id===M.school))M.school='';
 render();
}
const contentSchool=c=>c.scope==='ARF'?'ARF':schoolName(c.school_id);
const SCOPE_VIEWS=['Content Workspace','Content Calendar','Content Table','Published Content','Performance Analytics'];
const contentFiltered=()=>SCOPE_VIEWS.includes(M.view);
const contentMatches=c=>{
 if(!c||c.archived_at)return false;
 if(!central()&&c.school_id!==userSchool())return false;
 if(central()){
  if(contentFiltered()&&M.scope==='ARF'&&c.scope!=='ARF')return false;
  if(contentFiltered()&&M.scope==='SCHOOL'&&c.scope!=='SCHOOL')return false;
  if(M.school&&c.school_id!==M.school)return false;
 }
 if(contentFiltered()&&M.userFilter&&c.created_by!==M.userFilter&&c.assigned_to!==M.userFilter)return false;
 return true;
};
const eligibleContents=()=>M.contents.filter(contentMatches);
const filteredPublications=()=>M.publications.filter(p=>
  (!M.platform||p.platform===M.platform)&&contentMatches(M.contents.find(c=>c.id===p.content_id)));
const publishedRecords=()=>filteredPublications().filter(p=>
 M.contents.some(c=>c.id===p.content_id&&c.status==='Published'&&!c.archived_at));
const targetPublications=()=>{
 if(!contentFiltered()||!M.userFilter)return M.publications;
 return M.publications.filter(p=>{
  const c=M.contents.find(x=>x.id===p.content_id);
  return c&&(c.created_by===M.userFilter||c.assigned_to===M.userFilter);
 });
};
const targetSchools=()=>M.schools.filter(s=>s.active&&(!M.school||s.id===M.school)&&
  (!contentFiltered()||M.scope!=='ARF'));
const scores=()=>targetSchools().map(s=>({...mediaWeeklyScore(s.id,M.week,targetPublications(),M.targets),school:s}))
 .sort((a,b)=>(a.score??-1)-(b.score??-1));
const monthlyScores=()=>targetSchools().map(s=>({...mediaMonthlyScore(s.id,M.month,targetPublications(),M.targets),school:s}))
 .sort((a,b)=>(a.score??-1)-(b.score??-1));
function shell(){
 const links=MENU.filter(n=>central()||!['Administration','User & Role Management'].includes(n)).map(label=>'<button type="button" class="mh-nav-link '+(label===M.view?'active':'')+'" data-mh-view="'+text(label)+'">'+text(label)+'</button>').join('');
 return '<div class="mh-shell"><aside class="mh-sidebar '+(M.mobileMenu?'show':'')+'"><div class="mh-brand"><span class="mh-mark">ARF</span><div>ARF <strong>Media Hub</strong><small>ONE FOUNDATION · ONE STANDARD</small></div></div><div class="mh-section-label">MODULES</div><a class="mh-module-link" href="/">▦ &nbsp; Workflow Planner</a><div class="mh-module-selected">◉ &nbsp; ARF Media Hub</div><div class="mh-section-label">MEDIA MANAGEMENT</div>'+links+'<div class="mh-side-foot"><span>'+text(M.profile?.full_name||'')+'</span><small>'+text(mediaRoleLabel(M.member?.role))+'</small><button type="button" class="mh-btn-outline" data-mh-action="logout">Sign out</button></div></aside><div class="mh-main"><header class="mh-top"><button class="mh-mobile-trigger" data-mh-action="menu">☰</button><div><span class="mh-overline">ARF MEDIA MANAGEMENT</span><h1>'+text(M.view)+'</h1></div><a class="mh-top-module" href="/">Workflow Planner</a></header><div class="mh-body">'+(M.error?'<div class="mh-alert">'+text(M.error)+'</div>':'')+(M.toast?'<div class="mh-success">'+text(M.toast)+'</div>':'')+filters()+view()+'</div></div></div>'+modal();
}
function filters(){
 const supported=['Dashboard',...SCOPE_VIEWS,'Review & Feedback'];
 if(!supported.includes(M.view))return '';
 const isContent=contentFiltered();
 const availableUsers=M.people.filter(p=>M.members.some(m=>m.user_id===p.id)||
  M.contents.some(c=>c.created_by===p.id||c.assigned_to===p.id));
 const scopes=central()&&isContent
  ?select('Cakupan','filter_scope',
   '<option value="ALL" '+(M.scope==='ALL'?'selected':'')+'>Semua (ARF & Sekolah)</option>'+
   '<option value="ARF" '+(M.scope==='ARF'?'selected':'')+'>ARF</option>'+
   '<option value="SCHOOL" '+(M.scope==='SCHOOL'?'selected':'')+'>Sekolah/Institusi</option>')
  :!central()&&isContent?'<span class="mh-filter-chip">Cakupan: '+text(schoolName(userSchool()))+'</span>':'';
 const school=central()&&(!isContent||M.scope!=='ARF')
  ?select('Sekolah/Institusi','filter_school',options(M.schools,M.school,'Seluruh Sekolah/Institusi'))
  :(!central()&&!isContent?'<span class="mh-filter-chip">Sekolah/Institusi: '+text(schoolName(userSchool()))+'</span>':'');
 const user=isContent?select('Pengguna (Pembuat/PIC)','filter_user',
  options(availableUsers,M.userFilter,'Semua Pengguna','full_name')):'';
 const platform=select('Platform','filter_platform','<option value="">Instagram & TikTok</option>'+
  PLATFORM.map(p=>'<option '+(p===M.platform?'selected':'')+'>'+p+'</option>').join(''));
 const week=['Dashboard','Performance Analytics'].includes(M.view)
  ?input('Minggu (Senin)','filter_week',M.week,'date'):'';
 const month=['Dashboard','Performance Analytics'].includes(M.view)
  ?input('Bulan Capaian','filter_month',M.month,'month'):'';
 return '<div class="mh-filterbar">'+scopes+school+user+platform+week+month+'</div>';
}
function view(){
 if(M.view==='Dashboard')return dashboard();
 if(M.view==='Content Workspace')return workspace();
 if(M.view==='Content Calendar')return calendar();
 if(M.view==='Content Table')return contentTable();
 if(M.view==='Published Content')return publications();
 if(M.view==='Review & Feedback')return review();
 if(M.view==='Performance Analytics')return analytics();
 if(M.view==='Administration')return administration();
 return users();
}
function heading(title,desc,action=''){return '<div class="mh-page-head"><div><h2>'+text(title)+'</h2><p>'+text(desc)+'</p></div>'+action+'</div>';}
function kpi(label,value,sub){return '<div class="mh-stat"><span>'+text(label)+'</span><strong>'+text(String(value))+'</strong><small>'+text(sub||'')+'</small></div>';}
function performanceSummary(list,label){
 const eligible=list.filter(x=>x.eligible);
 return '<div class="mh-stat-grid">'+
 kpi('Sekolah/Institusi',list.length,'Dalam pemantauan')+
 kpi('Memenuhi target',eligible.filter(x=>x.score===100).length,label)+
 kpi('Rata-rata capaian',eligible.length?Math.round(eligible.reduce((n,x)=>n+x.score,0)/eligible.length)+'%':'N/A','Maksimal 100%')+
 kpi('IG / TikTok Verified',list.reduce((n,x)=>n+x.ig,0)+' / '+list.reduce((n,x)=>n+x.tt,0),'Hanya Verified')+
 '</div>';
}
function monthlyPerformanceSection(){
 const rows=monthlyScores();
 return '<section class="mh-card">'+heading('Capaian Target Bulanan',
 'Akumulasi target dan publikasi Verified per minggu yang dimulai pada bulan '+M.month+'.')+
 performanceSummary(rows,'Bulan '+M.month)+
 '<p class="mh-note">Periode dihitung dari '+mediaMonthMondays(M.month).length+
 ' minggu yang hari Seninnya berada dalam bulan terpilih (WIB). Minggu lintas bulan dihitung pada bulan tanggal Seninnya.</p>'+
 scoreTable(rows)+'</section>';
}
function dashboard(){
 const weekly=scores(),pending=weekly.reduce((n,r)=>n+r.pending,0);
 return heading('Pemantauan Publikasi Mingguan & Bulanan',
 'Capaian sekolah dihitung dari publikasi Instagram/TikTok yang telah diverifikasi.',button('Tambah Konten','content-new'))+
 '<section class="mh-card">'+heading('Capaian Target Mingguan',
 'Minggu mulai '+M.week+' · hanya Verified yang dihitung.')+
 performanceSummary(weekly,'Minggu '+M.week)+scoreTable(weekly)+'</section>'+
 monthlyPerformanceSection()+
 '<section class="mh-card">'+heading('Action Queue','Publikasi menunggu verifikasi dan konten menunggu review.')+
 '<div class="mh-queue">'+
 kpi('Pending Verification',M.publications.filter(p=>p.verification_status==='pending').length,'Perlu verifikasi Koordinator ARF')+
 kpi('Menunggu review',M.contents.filter(c=>c.status==='In Review'&&!c.archived_at).length,'Berdasarkan role pembuat konten')+
 kpi('Sekolah belum memenuhi minggu ini',weekly.filter(x=>x.score!==100).length,'Pending '+pending)+'</div></section>';
}
function scoreTable(list){
 return '<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Sekolah</th><th>Koordinator</th><th>Instagram</th><th>TikTok</th><th>Pending</th><th>Skor</th><th>Kekurangan</th></tr></thead><tbody>'+list.map(r=>'<tr><td><b>'+text(r.school.name)+'</b><small>'+text(r.school.regional||'')+'</small></td><td>'+text(personBy(M.members.find(m=>m.role==='SCHOOL_MEDIA_COORDINATOR'&&m.school_id===r.school.id)?.user_id))+'</td><td>'+r.ig+'/'+r.quotaIG+'</td><td>'+r.tt+'/'+r.quotaTT+'</td><td>'+r.pending+'</td><td><span class="mh-score '+(r.score===100?'complete':'')+'">'+(r.eligible?r.score+'%':'N/A')+'</span></td><td>'+text((r.neededIG?'IG '+r.neededIG+' ':'')+(r.neededTT?'TikTok '+r.neededTT:'')||'Memenuhi')+'</td></tr>').join('')+(!list.length?'<tr><td colspan="7">Belum ada sekolah untuk cakupan ini.</td></tr>':'')+'</tbody></table></div>';
}
const contentAction=()=>button('+ Tambah Konten','content-new');
function workspace(){
 const data=eligibleContents();const states=['Planned','In Production','In Review','Revision','Approved','Scheduled','Published'];
 return heading('Content Workspace','Kelola brief, caption, aset dan siklus produksi; satu brief dapat digunakan untuk IG dan TikTok.',contentAction())+
 '<div class="mh-board">'+states.map(state=>'<section class="mh-column"><header>'+text(state)+' <span>'+data.filter(c=>c.status===state).length+'</span></header>'+
 data.filter(c=>c.status===state).map(c=>'<article class="mh-workcard"><small>'+text(contentSchool(c))+'</small><strong>'+text(c.title)+'</strong><p>'+text(c.brief).slice(0,170)+'</p><div class="mh-flex"><span>'+fmt(c.planned_at)+'</span><button data-mh-action="content-edit" data-id="'+text(c.id)+'">Open</button></div></article>').join('')+'</section>').join('')+'</div>';
}
function contentTable(){
 const content=eligibleContents().filter(c=>!M.platform||c.status!=='Published'||M.publications.some(p=>p.content_id===c.id&&p.platform===M.platform));
 return heading('Content Table','Daftar lengkap konten dan proses produksi.',contentAction())+
 '<section class="mh-card"><div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Konten</th><th>Sekolah</th><th>Kategori</th><th>PIC</th><th>Status</th><th>Jadwal</th><th>Aksi</th></tr></thead><tbody>'+
 content.map(c=>'<tr><td><b>'+text(c.title)+'</b></td><td>'+text(contentSchool(c))+'</td><td>'+text(M.categories.find(x=>x.id===c.category_id)?.name||'—')+'</td><td>'+text(personBy(c.assigned_to))+'</td><td>'+text(c.status)+'</td><td>'+fmt(c.planned_at)+'</td><td>'+button('Detail','content-edit','data-id="'+text(c.id)+'"')+'</td></tr>').join('')+
 (!content.length?'<tr><td colspan="7">Belum ada konten.</td></tr>':'')+'</tbody></table></div></section>';
}
function calendar(){
 const [year,month]=M.month.split('-').map(Number),start=new Date(Date.UTC(year,month-1,1)),weekday=(start.getUTCDay()+6)%7,days=new Date(Date.UTC(year,month,0)).getUTCDate();
 const cells=Array.from({length:Math.ceil((weekday+days)/7)*7},(_,i)=>{
  const day=i-weekday+1,full=year+'-'+String(month).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const matching=eligibleContents().filter(c=>c.planned_at&&mediaPeriodFor(c.planned_at).slice(0,10)===full);
  return '<div class="mh-cal-cell '+(day<1||day>days?'disabled':'')+'"><b>'+(day>0&&day<=days?day:'')+'</b>'+matching.map(c=>'<button data-mh-action="content-edit" data-id="'+text(c.id)+'" title="'+text(c.title)+'">'+text(c.title)+'</button>').join('')+'</div>';
 }).join('');
 return heading('Content Calendar','Perencanaan konten berdasarkan jadwal WIB; klik konten untuk melihat detail.',contentAction())+
 '<div class="mh-cal-actions"><label>Periode <input type="month" data-mh-filter="month" value="'+text(M.month)+'"></label></div><section class="mh-card"><div class="mh-cal-week">'+['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(d=>'<strong>'+d+'</strong>').join('')+'</div><div class="mh-cal">'+cells+'</div></section>';
}
function publications(){
 const data=publishedRecords();return heading('Published Content','Bukti publikasi per platform. Status Pending belum masuk skor resmi.',button('+ Submit Publication','publication-new'))+
 '<section class="mh-card"><div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Konten</th><th>Sekolah</th><th>Platform</th><th>Terbit WIB</th><th>Bukti Publikasi</th><th>Verifikasi</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>'+
 data.map(p=>'<tr><td>'+text(M.contents.find(c=>c.id===p.content_id)?.title||'—')+'</td><td>'+text(schoolName(p.school_id))+'</td><td>'+text(p.platform)+'</td><td>'+fmt(p.actual_at)+'</td><td>'+textLink(p.public_url,'Buka Post')+'</td><td><span class="mh-status '+text(p.verification_status)+'">'+text(p.verification_status)+'</span></td><td>'+text(p.rejection_reason||'—')+'</td><td>'+(['draft','rejected'].includes(p.verification_status)?button('Perbaiki','publication-edit','data-id="'+text(p.id)+'"'):(p.verification_status==='verified'&&manager()?button('Withdraw','publication-withdraw','data-id="'+text(p.id)+'"'):'—'))+'</td></tr>').join('')+
 (!data.length?'<tr><td colspan="8">Belum ada publikasi.</td></tr>':'')+'</tbody></table></div></section>';
}
function review(){
 const pubs=filteredPublications().filter(p=>p.verification_status==='pending');
 const pending=eligibleContents().filter(c=>c.status==='In Review');
 return heading('Review & Feedback','Koordinator Sekolah → Koordinator ARF; konten Koordinator ARF → ARF Manager. Revisi wajib disertai catatan.')+
 '<section class="mh-card"><h3>Konten Menunggu Review ('+pending.length+')</h3>'+
 pending.map(c=>{
  const last=M.reviews.find(r=>r.content_id===c.id);
  return '<div class="mh-review-line"><div><strong>'+text(c.title)+'</strong><small>'+text(contentSchool(c))+' · V'+c.version+' · Reviewer: '+text(reviewFor(c))+'</small><p>'+text(c.caption||c.brief)+'</p>'+
  (last?.decision==='revision'?'<p><b>Catatan revisi terakhir:</b> '+text(last.feedback)+'</p>':'')+'</div><div>'+
  (canReview(c)?button('Approved → Scheduled','content-approve','data-id="'+text(c.id)+'"')+
     button('Revision','content-revision','data-id="'+text(c.id)+'"'):'Menunggu '+text(reviewFor(c)))+'</div></div>';
 }).join('')+(!pending.length?'<p>Tidak ada konten menunggu review.</p>':'')+'</section>'+
 '<section class="mh-card"><h3>Verifikasi Publikasi ('+pubs.length+')</h3>'+
 pubs.map(p=>'<div class="mh-review-line"><div><strong>'+text(M.contents.find(c=>c.id===p.content_id)?.title||'Publication')+' · '+text(p.platform)+'</strong><small>'+text(schoolName(p.school_id))+' · '+fmt(p.actual_at)+'</small><p>'+textLink(p.public_url,'Buka Bukti Publikasi')+'</p></div><div>'+
 (central()?button('Verify','publication-verify','data-id="'+text(p.id)+'"')+button('Reject','publication-reject','data-id="'+text(p.id)+'"'):'Menunggu pusat')+'</div></div>').join('')+
 (!pubs.length?'<p>Tidak ada publikasi menunggu verifikasi.</p>':'')+'</section>';
}
function analytics(){
 const list=scores(),eligible=list.filter(r=>r.eligible),posts=publishedRecords();
 return heading('Performance Analytics','Capaian target mingguan dan bulanan, serta metrik aktual konten Published. Filter pengguna mencakup PIC atau pembuat konten.',button('Export XLSX','export-xlsx')+button('Export PDF','export-pdf'))+
 '<div class="mh-stat-grid">'+kpi('Rata-rata sekolah',eligible.length?Math.round(eligible.reduce((n,r)=>n+r.score,0)/eligible.length)+'%':'N/A','Target publikasi terverifikasi')+
 kpi('Compliance Rate',eligible.length?Math.round(eligible.filter(r=>r.score===100).length/eligible.length*100)+'%':'N/A','Sekolah mencapai target')+
 kpi('IG Verified',list.reduce((n,r)=>n+r.ig,0),'Target Instagram')+kpi('TikTok Verified',list.reduce((n,r)=>n+r.tt,0),'Target TikTok')+'</div>'+
 '<section class="mh-card">'+heading('Metrik Konten Published','Isi Views, Likes, Comments, Shares dan Tanggal Pengamatan pada setiap konten yang terbit.')+
 '<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Konten</th><th>Platform</th><th>Tanggal Isian Metrik</th><th>Views</th><th>Likes</th><th>Comments</th><th>Shares</th><th>Aksi</th></tr></thead><tbody>'+
 posts.map(p=>{const m=latestMetrics(p.id),c=M.contents.find(c=>c.id===p.content_id);
 return '<tr><td><b>'+text(c?.title||'—')+'</b><small>'+text(contentSchool(c||{scope:'ARF'}))+'</small></td><td>'+text(p.platform)+'</td><td>'+fmt(m?.observed_at)+'</td>'+
 ['views','likes','comments','shares'].map(k=>'<td>'+text(m?.[k]??'—')+'</td>').join('')+
 '<td>'+button('Edit Metriks','metric-edit','data-id="'+text(p.id)+'"')+'</td></tr>';
 }).join('')+(!posts.length?'<tr><td colspan="8">Belum ada konten Published.</td></tr>':'')+'</tbody></table></div></section>'+
 '<section class="mh-card">'+heading('Capaian Target Mingguan','Jumlah publikasi terverifikasi berdasarkan sekolah dan platform.')+scoreTable(list)+'</section>'+
 monthlyPerformanceSection();
}
function administration(){
 if(!central())return '<p>Tidak memiliki akses Administration.</p>';
 const operations=(edit,remove,id,active)=>button('Edit',edit,'data-id="'+text(id)+'"')+
  button(active?'Hapus':'Aktifkan',remove,'data-id="'+text(id)+'"');
 return heading('Administration','Master data, akun platform dan target mingguan berlaku untuk semua sekolah.')+
 '<div class="mh-admin-grid"><section class="mh-card">'+heading('Master Sekolah','Sekolah yang dihapus dinonaktifkan agar riwayatnya tetap aman.',button('+ Sekolah','school-new'))+
 '<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Kode</th><th>Nama</th><th>Regional</th><th>Jenjang</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+
 M.schools.map(x=>'<tr><td>'+text(x.code)+'</td><td><b>'+text(x.name)+'</b></td><td>'+text(x.regional)+'</td><td>'+text(x.level)+'</td><td>'+text(x.active?'Aktif':'Arsip')+'</td><td>'+operations('school-edit','school-toggle',x.id,x.active)+'</td></tr>').join('')+
 (!M.schools.length?'<tr><td colspan="6">Belum ada sekolah.</td></tr>':'')+'</tbody></table></div></section>'+
 '<section class="mh-card">'+heading('Instagram & TikTok Accounts','Akun diidentifikasi dengan platform dan cakupan, tanpa isian Handle.',button('+ Akun','account-new'))+
 '<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Cakupan</th><th>Sekolah</th><th>Platform</th><th>Link Profil</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+
 M.accounts.map(x=>'<tr><td>'+text(x.scope)+'</td><td>'+text(x.scope==='ARF'?'—':schoolName(x.school_id))+'</td><td><b>'+text(x.platform)+'</b></td><td>'+textLink(x.profile_url,'Buka profil')+'</td><td>'+text(x.active?'Aktif':'Arsip')+'</td><td>'+operations('account-edit','account-toggle',x.id,x.active)+'</td></tr>').join('')+
 (!M.accounts.length?'<tr><td colspan="6">Belum ada akun platform.</td></tr>':'')+'</tbody></table></div></section>'+
 '<section class="mh-card">'+heading('Target Mingguan','Target global Instagram dan TikTok yang berlaku untuk seluruh sekolah.',manager()?button('+ Atur Target','target-new'):'')+
 '<p>Secara default masing-masing platform ditargetkan 2 publikasi terverifikasi per minggu. Perubahan dan penghapusan hanya oleh ARF Manager.</p>'+
 '<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Platform</th><th>Target/minggu</th><th>Berlaku Sejak</th><th>Berlaku Sampai</th><th>Status</th><th>Aksi</th></tr></thead><tbody>'+
 M.targets.filter(t=>t.school_id===null).map(x=>'<tr><td><b>'+text(x.platform)+'</b></td><td>'+text(x.quota)+'</td><td>'+text(x.effective_from)+'</td><td>'+text(x.effective_until||'—')+'</td><td>'+text(x.active?'Aktif':'Arsip')+'</td><td>'+(manager()?operations('target-edit','target-toggle',x.id,x.active):'—')+'</td></tr>').join('')+
 (!M.targets.some(t=>t.school_id===null)?'<tr><td colspan="6">Belum ada perubahan target global. Default 2 per platform.</td></tr>':'')+'</tbody></table></div></section>'+
 '<section class="mh-card"><h3>Guidelines & Assets</h3><p>Gunakan tautan arsip digital ARF. Jangan menyimpan password Instagram/TikTok dalam Media Hub.</p><p>Kategori: '+text(M.categories.map(c=>c.name).join(' · '))+'</p></section></div>';
}
function users(){
 if(!central())return '<p>Tidak memiliki izin User & Role Management.</p>';
 return heading('User & Role Management','Koordinator ARF dan ARF Manager dapat mengelola akun Media Hub. Akun Planner tetap terpisah.',
 button('Assign Existing User','member-new')+button('Create School Account','school-account-new'))+
 '<section class="mh-card"><p class="mh-note">Edit dapat memperbarui nama pengguna dan username login (berlaku juga untuk akses WorkFlow Planner dengan akun sama). Hapus hanya menonaktifkan akses Media Hub, bukan menghapus riwayat atau akun Planner. Demi keamanan, password ARF Manager direset melalui akun itu sendiri.</p>'+
 '<div class="mh-table-wrap"><table class="mh-table mh-users-table"><thead><tr>'+
 '<th>Pengguna</th><th>Role Media Hub</th><th>Sekolah/Institusi</th><th>Status</th>'+
 '<th>Izin Workspace Baru</th><th>Aksi</th></tr></thead><tbody>'+
 M.members.map(m=>{
  const p=M.people.find(p=>p.id===m.user_id)||{};
  return '<tr><td><b>'+text(personBy(m.user_id))+'</b><small>@'+text(p.username||'—')+'</small></td>'+
   '<td>'+text(mediaRoleLabel(m.role))+'</td><td>'+text(schoolName(m.school_id))+'</td>'+
   '<td><span class="mh-status '+(m.active?'verified':'rejected')+'">'+(m.active?'Aktif':'Nonaktif')+'</span></td>'+
   '<td><div class="mh-permission-cell"><span class="mh-permission-status '+(m.planner_enabled?'enabled':'restricted')+'">'+
    (m.planner_enabled?'Diizinkan':'Memerlukan Izin')+'</span>'+
    button(m.planner_enabled?'Cabut Izin':'Izinkan','planner-toggle','data-id="'+text(m.user_id)+'"')+
    '</div></td>'+
   '<td><div class="mh-actions-cell">'+button('Edit','member-edit','data-id="'+text(m.user_id)+'"')+
    button(m.active?'Hapus Akses':'Aktifkan','member-toggle','data-id="'+text(m.user_id)+'"')+
    (m.role!=='ARF_MANAGER'?button('Reset Password','account-reset','data-id="'+text(m.user_id)+'"'):'')+
    '</div></td></tr>';
 }).join('')+(!M.members.length?'<tr><td colspan="6">Belum ada pengguna.</td></tr>':'')+
 '</tbody></table></div></section>';
}
function modal(){
 if(!M.modal)return '';
 const c=M.editing||{},scope=userSchool()?'SCHOOL':(c.scope||'SCHOOL'),schoolId=userSchool()||c.school_id||'';
 let body='',title='',form='';
 if(M.modal==='content'){
  title=c.id?'Edit Content':'New Content';form='mh-content-form';
  const existingPosts=M.publications.filter(p=>p.content_id===c.id);
  const lastRevision=M.reviews.find(r=>r.content_id===c.id&&r.decision==='revision');
  const publishedOptions=M.accounts.filter(a=>a.active).map(a=>({...a,name:accountLabel(a)}));
  body=(userSchool()?'<label class="mh-field"><span>Cakupan</span><input value="'+text(schoolName(userSchool()))+'" readonly aria-label="Cakupan sekolah" /><input type="hidden" name="scope" value="SCHOOL" /></label>':select('Cakupan','scope','<option value="SCHOOL" '+(scope==='SCHOOL'?'selected':'')+'>Sekolah/Institusi</option>'+
   (central()?'<option value="ARF" '+(scope==='ARF'?'selected':'')+'>ARF</option>':'')))+
   (central()?'<div data-mh-school>'+select('Sekolah/Institusi','school_id',options(M.schools.filter(s=>s.active||s.id===schoolId),schoolId,'Pilih sekolah'))+'</div>':
    '<input type="hidden" name="school_id" value="'+text(schoolId)+'">')+
   input('Judul Konten','title',c.title,'text','required minlength="3" maxlength="220"')+
   select('Kategori','category_id',options(M.categories,c.category_id,'Pilih kategori'),'required')+
   fieldText('Brief / Objective','brief',c.brief,true)+fieldText('Caption / Script','caption',c.caption)+
   input('Link Asset (HTTPS)','asset_url',c.asset_url,'url','placeholder="https://drive.google.com/..."')+
   select('Format','content_format',formatOptions.map(x=>'<option '+(x===(c.content_format||'Video Reels')?'selected':'')+'>'+x+'</option>').join(''))+
   select('PIC','assigned_to',options(M.people,c.assigned_to||store.user?.id,'Pilih PIC','full_name'),'required')+
   input('Jadwal Publikasi (WIB)','planned_at',c.planned_at?mediaPeriodFor(c.planned_at).slice(0,16):'','datetime-local','required')+
   select('Status Produksi','status',statusOptions.map(x=>'<option '+(x===(c.status||'Planned')?'selected':'')+
    (['Approved','Revision'].includes(x)&&x!==(c.status||'Planned')?' disabled':'')+'>'+x+'</option>').join(''))+
   (c.status==='Revision'&&lastRevision?'<div class="mh-alert"><b>Revision:</b> '+text(lastRevision.feedback)+'</div>':'')+
   '<div data-mh-publish hidden><div class="mh-card mh-publish-box"><h3>Bukti konten sudah terbit</h3><p>Masukkan link Instagram atau TikTok yang benar. Saat berpindah ke Published, tautan wajib diisi.</p>'+
   select('Platform','publish_platform',PLATFORM.map(x=>'<option>'+x+'</option>').join(''))+
   select('Akun Platform','publish_account_id',options(publishedOptions,'','Pilih akun platform'))+
   input('URL publikasi Instagram / TikTok (HTTPS)','publish_url','','url','placeholder="https://..."')+
   input('Tanggal & Jam Terbit (WIB)','publish_actual_at',mediaPeriodFor(new Date()).slice(0,16),'datetime-local')+
   '</div></div>'+
   (existingPosts.length?'<section class="mh-card"><h3>Link yang sudah dipublikasi</h3>'+existingPosts.map(p=>'<p><b>'+text(p.platform)+'</b>: '+textLink(p.public_url,'Buka konten')+' <small>('+text(p.verification_status)+')</small></p>').join('')+'</section>':'')+
   '<fieldset class="mh-checklist"><legend>Checklist kelayakan publikasi</legend>'+
   [['consent_checked','Izin penggunaan foto/video telah dipastikan'],['copyright_checked','Musik dan aset memiliki izin penggunaan'],
    ['accuracy_checked','Narasi dan informasi sudah diperiksa'],['brand_checked','Sesuai standar identitas dan privasi ARF']].map(([name,label])=>
    '<label class="mh-check"><input type="checkbox" name="'+name+'" '+(c[name]?'checked':'')+'> '+label+'</label>').join('')+
   '</fieldset>'+
   '<label class="mh-check"><input type="checkbox" name="strategic" '+(c.strategic?'checked':'')+'> Konten strategis (review tetap mengikuti pembuat konten)</label>'+
   '<label class="mh-check"><input type="checkbox" name="sensitive_flag" '+(c.sensitive_flag?'checked':'')+'> Materi sensitif / eskalasi ke pusat</label>'+
   (c.id?'<div class="mh-content-actions"><button type="button" class="mh-btn-outline" data-mh-action="content-archive" data-id="'+text(c.id)+'">Archive Content</button></div>':'');
 }else if(M.modal==='publication'){
  title=c.id?'Perbaiki Bukti Publikasi':'Submit Publication';form='mh-publication-form';
  body=select('Konten','content_id',options(eligibleContents().filter(x=>x.status==='Published'||x.status==='Scheduled'),c.content_id,'Pilih konten','title'),'required')+
   select('Platform','platform',PLATFORM.map(x=>'<option '+(x===(c.platform||'Instagram')?'selected':'')+'>'+x+'</option>').join(''))+
   select('Akun Media','account_id',options(M.accounts.filter(a=>a.active).map(a=>({...a,name:accountLabel(a)})),c.account_id,'Pilih akun media'),'required')+
   select('Format','format',formatOptions.map(x=>'<option '+(x===(c.format||'Video Reels')?'selected':'')+'>'+x+'</option>').join(''))+
   input('Tanggal & Jam Terbit (WIB)','actual_at',c.actual_at?mediaPeriodFor(c.actual_at).slice(0,16):mediaPeriodFor(new Date()).slice(0,16),'datetime-local','required')+
   input('URL Post Instagram / TikTok (HTTPS)','public_url',c.public_url,'url','required placeholder="https://..."')+
   input('Tautan Bukti Pendukung (opsional)','evidence_url',c.evidence_url,'url','placeholder="https://..."');
 }else if(M.modal==='school'){
  title=c.id?'Edit Master Sekolah':'Tambah Sekolah';form='mh-school-form';
  body=input('Kode Sekolah','code',c.code,'text','required maxlength="30" pattern="[A-Za-z0-9_-]{2,30}"')+
   input('Nama Sekolah','name',c.name,'text','required')+input('Regional','regional',c.regional)+
   select('Jenjang','level',['TPA','PAUD','TK','SD','SMP','SMA','SMK'].map(x=>'<option '+(x===(c.level||'SD')?'selected':'')+'>'+x+'</option>').join(''));
 }else if(M.modal==='account'){
  title=c.id?'Edit Akun Platform':'Tambah Akun Media';form='mh-account-form';
  body=select('Cakupan','scope','<option value="SCHOOL" '+(c.scope!=='ARF'?'selected':'')+'>Sekolah</option><option value="ARF" '+(c.scope==='ARF'?'selected':'')+'>ARF</option>')+
   '<div data-mh-school>'+select('Sekolah','school_id',options(M.schools.filter(s=>s.active||s.id===c.school_id),c.school_id,'Pilih sekolah'))+'</div>'+
   select('Platform','platform',PLATFORM.map(p=>'<option '+(p===(c.platform||'Instagram')?'selected':'')+'>'+p+'</option>').join(''))+
   input('Link Profil (HTTPS, opsional)','profile_url',c.profile_url,'url','placeholder="https://..."');
 }else if(M.modal==='target'){
  title=c.id?'Edit Target Global':'Target Mingguan Semua Sekolah';form='mh-target-form';
  body='<p class="mh-note">Target ini berlaku untuk <b>seluruh sekolah</b>, bukan sekolah tertentu.</p>'+
   select('Platform','platform',PLATFORM.map(p=>'<option '+(p===(c.platform||'Instagram')?'selected':'')+'>'+p+'</option>').join(''))+
   input('Kuota / minggu','quota',String(c.quota??2),'number','required min="0" max="100"')+
   input('Berlaku sejak','effective_from',c.effective_from||M.week,'date','required')+
   input('Berlaku sampai (opsional)','effective_until',c.effective_until||'','date')+
   fieldText('Alasan perubahan','reason',c.reason);
 }else if(M.modal==='member'){
  title=c.user_id?'Edit Pengguna & Hak Akses':'Assign Existing User';form='mh-member-form';
  const profile=M.people.find(p=>p.id===c.user_id)||{};
  body=(c.user_id?'<p class="mh-note">Perubahan nama/username memengaruhi login akun yang sama pada WorkFlow Planner.</p><input type="hidden" name="user_id" value="'+text(c.user_id)+'">':
    select('User akun existing','user_id',options(M.people,'','Pilih pengguna','full_name'),'required'))+
   (c.user_id?input('Nama Pengguna','full_name',profile.full_name||'', 'text','required minlength="2" maxlength="100"')+
    input('Username Login','username',profile.username||'', 'text','required pattern="[a-z][a-z0-9_]{2,29}" maxlength="30" autocomplete="off"'):'')+
   select('Media Role','role',['ARF_MANAGER','ARF_MEDIA_COORDINATOR','SCHOOL_MEDIA_COORDINATOR'].map(x=>'<option value="'+x+'" '+(x===c.role?'selected':'')+'>'+text(mediaRoleLabel(x))+'</option>').join(''))+
   '<div data-mh-member-school>'+select('Sekolah/Institusi','school_id',options(M.schools.filter(s=>s.active||s.id===c.school_id),c.school_id,'Pilih sekolah/institusi'))+'</div>'+
   select('Status Akun Media','active','<option value="true" '+(c.active!==false?'selected':'')+'>Aktif</option><option value="false" '+(c.active===false?'selected':'')+'>Nonaktif</option>');
 }else if(M.modal==='password'){
  title='Reset Password Pengguna';form='mh-password-form';
  body='<p class="mh-note">Reset password untuk <b>'+text(personBy(c.user_id))+'</b>. Password baru digunakan pada semua modul dengan akun yang sama, termasuk WorkFlow Planner.</p>'+
   input('Password Baru (minimal 12 karakter)','password','','password','required minlength="12" maxlength="128" autocomplete="new-password"');
 }else if(M.modal==='metrics'){
  title='Edit Metriks Konten';form='mh-metrics-form';
  const metric=latestMetrics(c.id),content=M.contents.find(x=>x.id===c.content_id);
  body='<p class="mh-note"><b>'+text(content?.title||'—')+'</b> · '+text(c.platform)+'</p>'+
   input('Tanggal Pengamatan (WIB)','observed_at',metric?.observed_at?mediaPeriodFor(metric.observed_at).slice(0,16):mediaPeriodFor(new Date()).slice(0,16),'datetime-local','required')+
   ['views','likes','comments','shares'].map(k=>input(k==='views'?'Views':k==='likes'?'Likes':k==='comments'?'Comments':'Shares',k,String(metric?.[k]??0),'number','required min="0" step="1"')).join('');
 }else if(M.modal==='revision'){
  title='Permintaan Revision';form='mh-revision-form';
  body='<p class="mh-note"><b>'+text(c.title||'')+'</b> · Reviewer: '+text(reviewFor(c))+'</p>'+
   fieldText('Apa saja yang harus direvisi?','feedback','',true);
 }else if(M.modal==='schoolAccount'){
  title='Create School Account';form='mh-school-account-form';
  body=select('Sekolah penugasan','school_id',options(M.schools.filter(s=>s.active),'','Pilih sekolah'),'required')+
   input('Nama lengkap','full_name','','text','required minlength="2" maxlength="100"')+
   input('Username','username','','text','required pattern="[a-z][a-z0-9_]{2,29}" maxlength="30" autocomplete="off"')+
   input('Password awal (min. 12 karakter)','password','','password','required minlength="12" autocomplete="new-password"')+
   '<p class="mh-note">Akun menggunakan autentikasi WorkFlow Planner, tetapi tidak otomatis memiliki akses Planner atau One School.</p>';
 }
 return '<div class="mh-modal-shade" data-mh-action="close-modal"><div class="mh-dialog" role="dialog" aria-modal="true" aria-label="'+text(title)+'"><div class="mh-dialog-head"><h2>'+text(title)+'</h2><button type="button" data-mh-action="close-modal">✕</button></div><form id="'+form+'" class="mh-form"><div class="mh-modal-body">'+body+'</div><footer><button type="button" class="mh-btn-outline" data-mh-action="close-modal">Batal</button><button type="submit" class="mh-btn" '+(M.busy?'disabled':'')+'>Simpan</button></footer></form></div></div>';
}
function syncModalFields(form){
 if(!form)return;
 const field=n=>form.querySelector('[name="'+n+'"]');
 const scope=field('scope')?.value||'SCHOOL';
 const school=field('school_id')?.value||userSchool()||'';
 const wrapper=form.querySelector('[data-mh-school]');
 if(wrapper){
  const visible=scope!=='ARF';
  wrapper.hidden=!visible;
  if(field('school_id'))field('school_id').required=visible;
 }
 const memberSchool=form.querySelector('[data-mh-member-school]');
 if(memberSchool){
  const visible=field('role')?.value==='SCHOOL_MEDIA_COORDINATOR';
  memberSchool.hidden=!visible;
  if(field('school_id'))field('school_id').required=visible;
 }
 const published=form.querySelector('[data-mh-publish]');
 if(published){
  const visible=field('status')?.value==='Published';
  published.hidden=!visible;
  const isNewPublished=M.editing?.status!=='Published';
  if(field('publish_url'))field('publish_url').required=visible&&isNewPublished;
  if(field('publish_actual_at'))field('publish_actual_at').required=visible&&isNewPublished;
 }
 const acc=field('publish_account_id')||field('account_id');
 if(acc&&(form.id==='mh-content-form'||form.id==='mh-publication-form')){
  const p=form.id==='mh-content-form'?field('publish_platform')?.value:field('platform')?.value;
  const selectedContent=M.contents.find(c=>c.id===field('content_id')?.value);
  const actualScope=selectedContent?.scope||(userSchool()?'SCHOOL':scope);
  const actualSchool=selectedContent?.school_id||(actualScope==='SCHOOL'?school:null);
  const eligible=M.accounts.filter(a=>a.active&&a.platform===p&&a.scope===actualScope&&
   (actualScope==='ARF'||a.school_id===actualSchool));
  const previous=acc.value||M.editing?.account_id||'';
  acc.innerHTML=options(eligible.map(a=>({...a,name:accountLabel(a)})),previous,'Pilih akun platform');
  if(!eligible.some(a=>a.id===previous))acc.value='';
  acc.required=!!published&&!published.hidden||form.id==='mh-publication-form';
 }
}
function render(){
 if(!store.user){root.innerHTML='<main class="mh-empty-access"><h1>ARF Media Hub</h1><p>Login menggunakan akun WorkFlow Planner untuk mengakses modul ini.</p><a class="mh-btn" href="/?next=media-hub">Login</a></main>';return;}
 if(!M.member){root.innerHTML='<main class="mh-empty-access"><h1>Akses ARF Media Hub diperlukan</h1><p>Akun ini belum memiliki keanggotaan Media Hub. Izin Planner tidak otomatis memberi akses Media Hub.</p><a class="mh-btn-outline" href="/">Kembali ke WorkFlow Planner</a></main>';return;}
 root.innerHTML=shell();
 syncModalFields(document.querySelector('.mh-form'));
}
function startModal(type,item=null){M.modal=type;M.editing=item;M.error='';render();}
function formData(form){return Object.fromEntries(new FormData(form).entries());}
const toIso=value=>value?new Date(value+':00+07:00').toISOString():null;
async function createOrUpdate(table,record,id){
 if(id)return store.rest(table,'PATCH','?id=eq.'+escapeId(id),record);
 return store.rest(table,'POST','',record);
}
async function handleSubmit(form){
 const values=formData(form);
 if(form.id==='mh-content-form'){
  const current=M.editing,scope=userSchool()?'SCHOOL':values.scope;
  const schoolId=scope==='SCHOOL'?(userSchool()||values.school_id||null):null;
  if(scope==='SCHOOL'&&!schoolId)throw Error('Pilih sekolah.');
  if(!values.status)throw Error('Pilih status produksi.');
  if(values.asset_url&&!validAttachment(values.asset_url))throw Error('Link asset harus menggunakan HTTPS.');
  if(!values.category_id||!values.assigned_to||!values.planned_at||!values.brief?.trim())throw Error('Kategori, PIC, Brief dan Jadwal wajib diisi.');
  if(['Approved','Revision'].includes(values.status)&&(!current||current.status!==values.status))
   throw Error('Approved dan Revision hanya diputuskan melalui Review & Feedback.');
  const wantsPublish=values.status==='Published';
  if(wantsPublish&&!current?.id)throw Error('Simpan dan ajukan konten untuk review sebelum Published.');
  const publishUrl=(values.publish_url||'').trim(),needsProof=wantsPublish&&current.status!=='Published';
  if(needsProof&&!publishUrl)throw Error('URL Instagram atau TikTok wajib diisi sebelum status Published.');
  if(publishUrl&&(!wantsPublish||!validAttachment(publishUrl)))throw Error('Isi tautan publikasi HTTPS saat status Published.');
  const payload={title:values.title.trim(),category_id:values.category_id,brief:values.brief.trim(),caption:(values.caption||'').trim(),
   asset_url:values.asset_url||null,assigned_to:values.assigned_to,
   planned_at:toIso(values.planned_at),status:needsProof?current.status:values.status,
   content_format:values.content_format||'Video Reels',strategic:!!values.strategic,
   consent_checked:!!values.consent_checked,copyright_checked:!!values.copyright_checked,
   accuracy_checked:!!values.accuracy_checked,brand_checked:!!values.brand_checked,
   sensitive_flag:!!values.sensitive_flag};
  if(['In Review','Approved','Scheduled','Published'].includes(values.status)&&
      !(payload.consent_checked&&payload.copyright_checked&&payload.accuracy_checked&&payload.brand_checked))
   throw Error('Selesaikan checklist izin, hak cipta, akurasi dan standar ARF.');
  if(!current?.id){payload.scope=scope;payload.school_id=schoolId;payload.created_by=store.user.id;}
  if(publishUrl){
   if(!current||!['Scheduled','Published'].includes(current.status)||current.review_status!=='approved')
    throw Error('Publikasi hanya dapat dilakukan setelah disetujui dan menjadi Scheduled.');
   const account=M.accounts.find(a=>a.id===values.publish_account_id);
   if(!account||!account.active||account.platform!==values.publish_platform||account.scope!==current.scope||
       account.school_id!==current.school_id)throw Error('Akun Instagram/TikTok tidak sesuai cakupan konten.');
   const host=new URL(publishUrl).hostname.toLowerCase();
   const domain=values.publish_platform==='Instagram'?'instagram.com':'tiktok.com';
   if(host!==domain&&!host.endsWith('.'+domain))throw Error('URL harus berasal dari platform yang dipilih.');
   if(!values.publish_actual_at)throw Error('Tanggal dan jam publikasi wajib diisi.');
  }
  await createOrUpdate('media_contents',payload,current?.id);
  if(publishUrl){
   await store.rpc('media_publish_content',{
     p_content:current.id,
     p_posts:[{platform:values.publish_platform,account_id:values.publish_account_id,url:publishUrl}],
     p_actual_at:toIso(values.publish_actual_at)
   });
  }
 }else if(form.id==='mh-publication-form'){
  const current=M.editing,content=M.contents.find(c=>c.id===values.content_id);
  if(!content)throw Error('Konten belum dipilih.');
  const url=(values.public_url||'').trim();if(!validAttachment(url))throw Error('Gunakan URL HTTPS.');
  const account=M.accounts.find(a=>a.id===values.account_id);
  if(!account||!account.active||account.platform!==values.platform||
      account.school_id!==content.school_id||account.scope!==content.scope)
   throw Error('Pilih akun sesuai platform dan cakupan konten.');
  if(!values.actual_at)throw Error('Tanggal publikasi wajib diisi.');
  if(current?.id){
   await createOrUpdate('media_publications',{platform:values.platform,account_id:values.account_id,
    format:values.format,public_url:url,evidence_url:values.evidence_url||null,
    actual_at:toIso(values.actual_at),verification_status:'pending'},current.id);
  }else{
   await store.rpc('media_publish_content',{p_content:content.id,
    p_posts:[{platform:values.platform,account_id:values.account_id,url}],
    p_actual_at:toIso(values.actual_at)});
  }
 }else if(form.id==='mh-school-form'){
  const record={code:values.code.trim(),name:values.name.trim(),regional:(values.regional||'').trim(),level:values.level};
  await createOrUpdate('media_schools',record,M.editing?.id);
 }else if(form.id==='mh-account-form'){
  const scope=values.scope==='ARF'?'ARF':'SCHOOL';
  if(scope==='SCHOOL'&&!values.school_id)throw Error('Pilih sekolah.');
  if(values.profile_url&&!validAttachment(values.profile_url))throw Error('Link profil harus menggunakan HTTPS.');
  const record={scope,school_id:scope==='ARF'?null:values.school_id,
    platform:values.platform,profile_url:values.profile_url||null};
  await createOrUpdate('media_accounts',record,M.editing?.id);
 }else if(form.id==='mh-target-form'){
  if(!manager())throw Error('Hanya ARF Manager dapat mengubah target.');
  if(values.effective_until&&values.effective_until<values.effective_from)throw Error('Tanggal akhir harus setelah tanggal mulai.');
  const record={school_id:null,platform:values.platform,quota:Number(values.quota),
    effective_from:values.effective_from,effective_until:values.effective_until||null,
    reason:(values.reason||'').trim()};
  if(!M.editing?.id)record.created_by=store.user.id;
  await createOrUpdate('media_targets',record,M.editing?.id);
 }else if(form.id==='mh-member-form'){
  if(!manager())throw Error('Hanya ARF Manager dapat mengubah hak akses.');
  if(!values.user_id)throw Error('Pilih pengguna.');
  if(values.role==='SCHOOL_MEDIA_COORDINATOR'&&!values.school_id)throw Error('Sekolah wajib dipilih.');
  const record={role:values.role,school_id:values.role==='SCHOOL_MEDIA_COORDINATOR'?values.school_id:null,active:values.active!=='false'};
  if(M.members.some(m=>m.user_id===values.user_id))
   await store.rest('media_members','PATCH','?user_id=eq.'+escapeId(values.user_id),record);
  else await store.rest('media_members','POST','',{user_id:values.user_id,...record});
 }else if(form.id==='mh-metrics-form'){
  const post=M.publications.find(p=>p.id===M.editing?.id),content=M.contents.find(c=>c.id===post?.content_id);
  if(!post||content?.status!=='Published')throw Error('Metrik hanya untuk konten Published.');
  const record={observed_at:toIso(values.observed_at)};
  for(const k of ['views','likes','comments','shares']){
   if(!/^\d+$/.test(String(values[k]||'')))throw Error(k+' harus bilangan bulat positif atau nol.');
   record[k]=Number(values[k]);if(!Number.isSafeInteger(record[k]))throw Error(k+' terlalu besar.');
  }
  const current=latestMetrics(post.id);
  if(current)await createOrUpdate('media_metrics',record,current.id);
  else await store.rest('media_metrics','POST','',{publication_id:post.id,...record,updated_by:store.user.id});
 }else if(form.id==='mh-revision-form'){
  if(!M.editing?.id||!canReview(M.editing))throw Error('Tidak berhak memberikan revisi.');
  const feedback=(values.feedback||'').trim();if(feedback.length<3)throw Error('Catatan revisi wajib diisi.');
  await store.rpc('media_review_content',{p_content:M.editing.id,p_decision:'revision',p_feedback:feedback});
 }else if(form.id==='mh-school-account-form'){
  await callProvision({action:'create',school_id:values.school_id,username:values.username.trim(),
   full_name:values.full_name.trim(),password:values.password});
 }else return;
 M.modal=null;M.editing=null;M.toast='Data berhasil disimpan.';await refresh();
}
async function callProvision(payload){
 const root=(window.__WORKFLOW_CONFIG__?.supabaseUrl||'').replace(/\/$/,'');
 const key=window.__WORKFLOW_CONFIG__?.supabaseAnonKey||'';
 if(!root||!isConnected)throw Error('Pembuatan akun membutuhkan layanan Supabase.');
 await store.ensureToken();
 const r=await fetch(root+'/functions/v1/media-school-accounts',{method:'POST',headers:{'Content-Type':'application/json','apikey':key,'Authorization':'Bearer '+store.session.access_token},body:JSON.stringify(payload)});
 const response=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(response.message||'Tidak dapat mengelola akun');
 return response;
}
async function exportReport(format){
 const rows=scores(),headers=['Sekolah','Regional','Minggu WIB','IG Verified','IG Target','TikTok Verified','TikTok Target','Pending','Skor %'];
 const fields=rows.map(x=>[x.school.name,x.school.regional||'',M.week,x.ig,x.quotaIG,x.tt,x.quotaTT,x.pending,x.eligible?x.score:'N/A']);
 if(format==='xlsx'){
  const blob=new Blob([createMediaPerformanceXlsx(rows,M.week)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  download(blob,'arf-media-hub-'+M.week+'.xlsx'); }else{
  const PDF=await loadJsPDF(),doc=new PDF({orientation:'landscape',unit:'mm',format:'a4'});let y=18;
  doc.setFontSize(14);doc.text('ARF Media Hub — Weekly School Performance',12,y);y+=10;doc.setFontSize(9);
  doc.text('Periode: '+M.week+' | Verified only | Instagram 2, TikTok 2 (default)',12,y);y+=10;
  doc.setFillColor(230,239,232);doc.rect(11,y-5,274,8,'F');doc.text('School',13,y);doc.text('IG',131,y);doc.text('TT',155,y);doc.text('Pending',184,y);doc.text('Score',223,y);y+=8;
  for(const x of rows){if(y>190){doc.addPage();y=19;}doc.text(x.school.name.slice(0,56),13,y);doc.text(x.ig+'/'+x.quotaIG,131,y);doc.text(x.tt+'/'+x.quotaTT,155,y);doc.text(String(x.pending),184,y);doc.text((x.eligible?x.score+'%':'N/A'),223,y);y+=7;}
  doc.save('arf-media-hub-'+M.week+'.pdf');
 }
}
function download(blob,name){const href=URL.createObjectURL(blob),link=document.createElement('a');link.href=href;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(href),1000);}
async function handleAction(action,element){
 if(action==='menu'){M.mobileMenu=!M.mobileMenu;render();return;}
 if(action==='logout'){await store.logout();window.location.href='/';return;}
 if(action==='close-modal'){M.modal=null;M.editing=null;render();return;}
 if(action==='content-new')return startModal('content');
 if(action==='content-edit')return startModal('content',M.contents.find(c=>c.id===element.dataset.id)||null);
 if(action==='publication-new')return startModal('publication');
 if(action==='publication-edit')return startModal('publication',M.publications.find(p=>p.id===element.dataset.id)||null);
 if(action==='school-new'&&central())return startModal('school');
 if(action==='school-edit'&&central())return startModal('school',M.schools.find(s=>s.id===element.dataset.id));
 if(action==='school-toggle'&&central()){
  const school=M.schools.find(s=>s.id===element.dataset.id);
  if(!school)throw Error('Sekolah tidak ditemukan.');
  if(!confirm((school.active?'Hapus/nonaktifkan':'Aktifkan')+' Master Sekolah '+school.name+'? Riwayat konten tetap disimpan.'))return;
  await store.rest('media_schools','PATCH','?id=eq.'+escapeId(school.id),{active:!school.active});
  M.toast='Status Master Sekolah diperbarui.';await refresh();return;
 }
 if(action==='account-new'&&central())return startModal('account');
 if(action==='account-edit'&&central())return startModal('account',M.accounts.find(a=>a.id===element.dataset.id));
 if(action==='account-toggle'&&central()){
  const account=M.accounts.find(a=>a.id===element.dataset.id);if(!account)throw Error('Akun media tidak ditemukan.');
  if(!confirm((account.active?'Hapus/nonaktifkan':'Aktifkan')+' akun '+accountLabel(account)+'?'))return;
  await store.rest('media_accounts','PATCH','?id=eq.'+escapeId(account.id),{active:!account.active});
  M.toast='Status akun platform diperbarui.';await refresh();return;
 }
 if(action==='target-new'&&manager())return startModal('target');
 if(action==='target-edit'&&manager())return startModal('target',M.targets.find(t=>t.id===element.dataset.id));
 if(action==='target-toggle'&&manager()){
  const target=M.targets.find(t=>t.id===element.dataset.id);if(!target)throw Error('Target tidak ditemukan.');
  if(!confirm((target.active?'Hapus/nonaktifkan':'Aktifkan')+' target global '+target.platform+'?'))return;
  await store.rest('media_targets','PATCH','?id=eq.'+escapeId(target.id),{active:!target.active});
  M.toast='Status target diperbarui.';await refresh();return;
 }
 if(action==='member-new'&&manager())return startModal('member');
 if(action==='member-edit'&&manager())return startModal('member',M.members.find(m=>m.user_id===element.dataset.id));
 if(action==='metric-edit'){
  const p=publishedRecords().find(x=>x.id===element.dataset.id);
  if(!p)throw Error('Konten Published tidak ditemukan.');
  return startModal('metrics',p);
 }
 if(action==='school-account-new'&&central())return startModal('schoolAccount');
 if(action==='content-archive'){
  const c=M.contents.find(c=>c.id===element.dataset.id);
  if(!c||c.archived_at)throw Error('Konten tidak ditemukan.');
  if(!confirm('Arsipkan konten '+c.title+'? Riwayat bukti publikasi tetap tersimpan.'))return;
  await store.rest('media_contents','PATCH','?id=eq.'+escapeId(c.id),{archived_at:new Date().toISOString()});
  M.modal=null;M.toast='Konten diarsipkan, bukti publikasi tetap tersimpan.';await refresh();return;
 }
 if(action==='content-approve'||action==='content-revision'){
  const content=M.contents.find(c=>c.id===element.dataset.id);
  if(!content||!canReview(content))throw Error('Konten ini harus direview oleh '+reviewFor(content)+'.');
  if(action==='content-revision')return startModal('revision',content);
  await store.rpc('media_review_content',{p_content:content.id,p_decision:'approved',p_feedback:''});
  M.toast='Approved. Konten otomatis masuk Scheduled.';await refresh();return;
 }
 if(action==='publication-withdraw'){
  if(!manager())throw Error('Hanya ARF Manager boleh menarik publikasi terverifikasi.');
  const reason=prompt('Alasan pencabutan publikasi (minimal 8 karakter, wajib dicatat):')||'';
  if(reason.trim().length<8)throw Error('Alasan harus minimal 8 karakter.');
  await store.rpc('media_withdraw_publication',{p_publication:element.dataset.id,p_reason:reason});
  M.toast='Publikasi ditarik dengan catatan audit; skor mingguan diperbarui.';await refresh();return;
 }
 if(action==='publication-verify'||action==='publication-reject'){
  if(!central())throw Error('Hanya pusat dapat memverifikasi.');
  const reason=action==='publication-reject'?prompt('Alasan penolakan (wajib):')||'':'';
  if(action==='publication-reject'&&reason.trim().length<3)throw Error('Alasan minimal 3 karakter.');
  await store.rpc('media_verify_publication',{p_publication:element.dataset.id,p_decision:action==='publication-verify'?'verified':'rejected',p_reason:reason});
  M.toast='Verifikasi tercatat.';await refresh();return;
 }
 if(action==='member-toggle'){
  if(!manager())throw Error('Hanya ARF Manager dapat menghapus akses Media Hub.');
  const member=M.members.find(m=>m.user_id===element.dataset.id);
  if(!member)throw Error('Pengguna tidak ditemukan.');
  if(!confirm((member.active?'Hapus akses Media Hub untuk ':'Aktifkan kembali ')+personBy(member.user_id)+'? Hak akses WorkFlow Planner tetap aman.'))return;
  await store.rest('media_members','PATCH','?user_id=eq.'+escapeId(member.user_id),{active:!member.active});
  M.toast='Akses Media Hub diperbarui tanpa menghapus akun Planner.';await refresh();return;
 }
 if(action==='planner-toggle'){
  if(!manager())throw Error('Hanya ARF Manager boleh mengubah izin Planner.');
  const member=M.members.find(m=>m.user_id===element.dataset.id);
  if(!member)throw Error('Anggota tidak ditemukan.');
  await store.rest('media_members','PATCH','?user_id=eq.'+escapeId(member.user_id),{planner_enabled:!member.planner_enabled});
  M.toast='Izin bergabung ke Planner diperbarui; keanggotaan Workspace tetap harus diberikan secara terpisah.';
  await refresh();return;
 }
 if(action==='account-reset'){
  if(!central())throw Error('Akses ditolak.');
  const password=prompt('Password baru (minimal 12 karakter):');if(!password)return;
  if(password.length<12)throw Error('Password minimal 12 karakter.');
  await callProvision({action:'reset',user_id:element.dataset.id,password});
  M.toast='Password awal berhasil diubah.';await refresh();return;
 }
 if(action==='export-xlsx'||action==='export-pdf')return exportReport(action==='export-xlsx'?'xlsx':'pdf');
}
document.addEventListener('click',e=>{
 const button=e.target.closest('[data-mh-action]');if(button){
  // The modal backdrop closes only on a direct backdrop click, never from
  // clicking inputs, labels, links, or blank space inside the dialog.
  if(button.classList.contains('mh-modal-shade')&&e.target!==button)return;
  e.preventDefault();busy(()=>handleAction(button.dataset.mhAction,button));return;
 }
 const nav=e.target.closest('[data-mh-view]');if(nav){M.view=nav.dataset.mhView;M.mobileMenu=false;M.toast='';M.error='';render();}
});
document.addEventListener('change',e=>{
 const n=e.target.name||e.target.dataset.mhFilter;
 if(n==='filter_school'){M.school=e.target.value;render();}
 if(n==='filter_platform'){M.platform=e.target.value;render();}
 if(n==='filter_week'){M.week=mediaWeekStart(e.target.value);render();}
 if(n==='month'){M.month=e.target.value;render();}
 if(e.target.closest('.mh-form')&&['scope','status','school_id','publish_platform','platform','content_id','role'].includes(n))syncModalFields(e.target.closest('.mh-form'));
});
document.addEventListener('submit',e=>{
 if(!e.target.id?.startsWith('mh-'))return;e.preventDefault();
 busy(()=>handleSubmit(e.target));
});
(async()=>{try{await store.initialize();await refresh();}catch(err){M.error=err.message||'Gagal membuka ARF Media Hub';render();}})();
