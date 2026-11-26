
import {store,isConnected} from './store.js';
import {safe,validAttachment} from './core.js';
import {zipFiles,xmlCell} from './gantt-export.js';
import {loadJsPDF} from './pdf-report.js';
import {mediaWeekStart,mediaWeeklyScore,mediaPeriodFor,mediaRoleLabel,mediaStatuses} from './media-utils.js';

const root=document.getElementById('media-root');
const PLATFORM=['Instagram','TikTok'];
const MENU=['Dashboard','Content Workspace','Content Calendar','Content Table','Published Content','Review & Feedback','Performance Analytics','Administration','User & Role Management'];
const statusOptions=['Planned','In Production','In Review','Revision','Approved','Scheduled','Published'];
const M={view:'Dashboard',member:null,profile:null,schools:[],accounts:[],targets:[],categories:[],contents:[],publications:[],reviews:[],members:[],people:[],school:'',platform:'',week:mediaWeekStart(),month:new Date().toISOString().slice(0,7),modal:null,editing:null,busy:false,error:'',toast:'',mobileMenu:false};
const central=()=>['ARF_MANAGER','ARF_MEDIA_COORDINATOR'].includes(M.member?.role);
const manager=()=>M.member?.role==='ARF_MANAGER';
const userSchool=()=>M.member?.role==='SCHOOL_MEDIA_COORDINATOR'?M.member.school_id:null;
const schoolBy=id=>M.schools.find(s=>s.id===id);
const personBy=id=>M.people.find(p=>p.id===id)?.full_name||'—';
const schoolName=id=>schoolBy(id)?.name||'ARF';
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
  store.rest('media_reviews','GET','?select=*&order=created_at.desc&limit=500'),
  central()?store.rest('media_members','GET','?select=*&order=created_at.asc&limit=500'):Promise.resolve([]),
  central()?store.rest('profiles','GET','?select=id,username,full_name&order=full_name.asc&limit=500'):Promise.resolve([])
 ]);
 [M.profile,M.schools,M.accounts,M.targets,M.categories,M.contents,M.publications,M.reviews,M.members,M.people]=data;
 if(!central())M.people=[{id:store.user.id,full_name:M.profile?.full_name||'My Account'}];
 if(!central())M.school=M.member.school_id;
 else if(M.school&&!M.schools.some(s=>s.id===M.school))M.school='';
 render();
}
const contentSchool=c=>c.scope==='ARF'?'ARF':schoolName(c.school_id);
const eligibleContents=()=>M.contents.filter(c=>(!M.school||c.school_id===M.school)&&(central()||c.school_id===userSchool())&&!c.archived_at);
const filteredPublications=()=>M.publications.filter(p=>(!M.school||p.school_id===M.school)&&(central()||p.school_id===userSchool())&&(!M.platform||p.platform===M.platform));
function selectedWeekScore(school){
 return mediaWeeklyScore(school.id,M.week,M.publications,M.targets);
}
const scores=()=>M.schools.filter(s=>s.active&&(!M.school||s.id===M.school)).map(s=>({...selectedWeekScore(s),school:s})).sort((a,b)=>a.score-b.score);
function shell(){
 const links=MENU.filter(n=>central()||!['Administration','User & Role Management'].includes(n)).map(label=>'<button type="button" class="mh-nav-link '+(label===M.view?'active':'')+'" data-mh-view="'+text(label)+'">'+text(label)+'</button>').join('');
 return '<div class="mh-shell"><aside class="mh-sidebar '+(M.mobileMenu?'show':'')+'"><div class="mh-brand"><span class="mh-mark">ARF</span><div>ARF <strong>Media Hub</strong><small>ONE FOUNDATION · ONE STANDARD</small></div></div><div class="mh-section-label">MODULES</div><a class="mh-module-link" href="/">▦ &nbsp; Workflow Planner</a><div class="mh-module-selected">◉ &nbsp; ARF Media Hub</div><div class="mh-section-label">MEDIA MANAGEMENT</div>'+links+'<div class="mh-side-foot"><span>'+text(M.profile?.full_name||'')+'</span><small>'+text(mediaRoleLabel(M.member?.role))+'</small><button type="button" class="mh-btn-outline" data-mh-action="logout">Sign out</button></div></aside><div class="mh-main"><header class="mh-top"><button class="mh-mobile-trigger" data-mh-action="menu">☰</button><div><span class="mh-overline">ARF MEDIA MANAGEMENT</span><h1>'+text(M.view)+'</h1></div><a class="mh-top-module" href="/">Workflow Planner</a></header><div class="mh-body">'+(M.error?'<div class="mh-alert">'+text(M.error)+'</div>':'')+(M.toast?'<div class="mh-success">'+text(M.toast)+'</div>':'')+filters()+view()+'</div></div></div>'+modal();
}
function filters(){
 if(!['Dashboard','Content Workspace','Content Calendar','Content Table','Published Content','Review & Feedback','Performance Analytics'].includes(M.view))return '';
 return '<div class="mh-filterbar">'+(central()?select('Sekolah','filter_school',options(M.schools,M.school,'Seluruh Sekolah')):'<span class="mh-filter-chip">Sekolah: '+text(schoolName(userSchool()))+'</span>')+select('Platform','filter_platform','<option value="">Instagram & TikTok</option>'+PLATFORM.map(p=>'<option '+(p===M.platform?'selected':'')+'>'+p+'</option>').join(''))+(['Dashboard','Performance Analytics'].includes(M.view)?input('Minggu (Senin)','filter_week',M.week,'date'):'')+'</div>';
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
function dashboard(){
 const list=scores(),verified=list.reduce((n,r)=>n+r.ig+r.tt,0),pending=list.reduce((n,r)=>n+r.pending,0),eligible=list.filter(r=>r.eligible),full=eligible.filter(x=>x.score===100).length;
 return heading('Pemantauan Publikasi Mingguan','Hanya publikasi Instagram/TikTok yang telah diverifikasi masuk skor resmi.',button('Tambah Konten','content-new'))+
 '<div class="mh-stat-grid">'+kpi('Sekolah dipantau',list.length,'Minggu mulai '+M.week)+kpi('Sekolah memenuhi target',full,'Minimal IG 2 + TikTok 2')+kpi('Rata-rata capaian',eligible.length?Math.round(eligible.reduce((n,r)=>n+r.score,0)/eligible.length)+'%':'N/A','Per sekolah, maksimal 100%')+kpi('Publikasi terverifikasi',verified,'Tertunda '+pending)+'</div>'+
 '<section class="mh-card">'+heading('School / Coordinator Performance','Verified dan Submitted ditampilkan terpisah; target default 2 IG + 2 TikTok.')+scoreTable(list)+'</section>'+
 '<section class="mh-card">'+heading('Action Queue','Menunggu verifikasi, revisi, dan sekolah berisiko tertinggal target.')+'<div class="mh-queue">'+
  kpi('Pending Verification',filteredPublications().filter(p=>p.verification_status==='pending').length,'Memerlukan pemeriksaan Koordinator ARF')+
  kpi('Menunggu review strategis',eligibleContents().filter(c=>c.strategic&&c.status==='In Review'&&c.review_status!=='approved').length,'Approval ARF Manager')+
  kpi('Sekolah belum memenuhi',list.filter(s=>s.score<100).length,'Hanya Verified dihitung')+'</div></section>';
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
 const content=eligibleContents().filter(c=>!M.platform||M.publications.some(p=>p.content_id===c.id&&p.platform===M.platform));
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
 const data=filteredPublications();return heading('Published Content','Bukti publikasi per platform. Status Pending belum masuk skor resmi.',button('+ Submit Publication','publication-new'))+
 '<section class="mh-card"><div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Konten</th><th>Sekolah</th><th>Platform</th><th>Terbit WIB</th><th>Bukti Publikasi</th><th>Verifikasi</th><th>Keterangan</th><th>Aksi</th></tr></thead><tbody>'+
 data.map(p=>'<tr><td>'+text(M.contents.find(c=>c.id===p.content_id)?.title||'—')+'</td><td>'+text(schoolName(p.school_id))+'</td><td>'+text(p.platform)+'</td><td>'+fmt(p.actual_at)+'</td><td>'+textLink(p.public_url,'Buka Post')+'</td><td><span class="mh-status '+text(p.verification_status)+'">'+text(p.verification_status)+'</span></td><td>'+text(p.rejection_reason||'—')+'</td><td>'+(['draft','rejected'].includes(p.verification_status)?button('Perbaiki','publication-edit','data-id="'+text(p.id)+'"'):'—')+'</td></tr>').join('')+
 (!data.length?'<tr><td colspan="8">Belum ada publikasi.</td></tr>':'')+'</tbody></table></div></section>';
}
function review(){
 const pubs=filteredPublications().filter(p=>p.verification_status==='pending'),pending=eligibleContents().filter(c=>c.strategic&&c.status==='In Review'&&c.review_status!=='approved');
 return heading('Review & Feedback','Verifikasi publikasi dilakukan Koordinator ARF/Manager; konten strategis disetujui Manager.')+
 '<section class="mh-card"><h3>Review konten strategis ('+pending.length+')</h3>'+pending.map(c=>'<div class="mh-review-line"><div><strong>'+text(c.title)+'</strong><small>'+text(contentSchool(c))+' · V'+c.version+'</small><p>'+text(c.caption||c.brief)+'</p></div><div>'+((manager())?button('Approve','content-approve','data-id="'+text(c.id)+'"'):'')+(central()?button('Request Revision','content-revision','data-id="'+text(c.id)+'"'):'')+'</div></div>').join('')+(!pending.length?'<p>Belum ada review strategis tertunda.</p>':'')+'</section>'+
 '<section class="mh-card"><h3>Verifikasi publikasi ('+pubs.length+')</h3>'+pubs.map(p=>'<div class="mh-review-line"><div><strong>'+text(M.contents.find(c=>c.id===p.content_id)?.title||'Publication')+' · '+text(p.platform)+'</strong><small>'+text(schoolName(p.school_id))+' · '+fmt(p.actual_at)+'</small><p>'+textLink(p.public_url,'Buka Bukti Publikasi')+'</p></div><div>'+((central())?button('Verify','publication-verify','data-id="'+text(p.id)+'"')+button('Reject','publication-reject','data-id="'+text(p.id)+'"'):'Menunggu pusat')+'</div></div>').join('')+(!pubs.length?'<p>Tidak ada publikasi menunggu verifikasi.</p>':'')+'</section>';
}
function analytics(){
 const list=scores(),eligible=list.filter(r=>r.eligible);return heading('Performance Analytics','Rangkuman capaian mingguan. Skor hanya dari publikasi Verified, maksimal 100%.',button('Export XLSX','export-xlsx')+button('Export PDF','export-pdf'))+
 '<div class="mh-stat-grid">'+kpi('Rata-rata sekolah',eligible.length?Math.round(eligible.reduce((n,r)=>n+r.score,0)/eligible.length)+'%':'N/A','School-week eligible')+kpi('Compliance Rate',eligible.length?Math.round(eligible.filter(r=>r.score===100).length/eligible.length*100)+'%':'N/A','Sekolah mencapai 100%')+kpi('IG Verified',list.reduce((n,r)=>n+r.ig,0),'Target 2 per sekolah')+kpi('TikTok Verified',list.reduce((n,r)=>n+r.tt,0),'Target 2 per sekolah')+'</div><section class="mh-card">'+scoreTable(list)+'</section>';
}
function administration(){
 if(!central())return '<p>Tidak memiliki akses Administration.</p>';
 return heading('Administration','Master sekolah, akun media dan target mingguan. Regional hanya metadata, bukan akses.')+
 '<div class="mh-admin-grid"><section class="mh-card">'+heading('Master Sekolah','Kode unik dan identitas sekolah.',button('+ Sekolah','school-new'))+'<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Kode</th><th>Nama</th><th>Regional</th><th>Jenjang</th></tr></thead><tbody>'+M.schools.map(s=>'<tr><td>'+text(s.code)+'</td><td>'+text(s.name)+'</td><td>'+text(s.regional)+'</td><td>'+text(s.level)+'</td></tr>').join('')+'</tbody></table></div></section>'+
 '<section class="mh-card">'+heading('Instagram & TikTok Accounts','Hanya handle dan URL profil, tanpa password platform.',button('+ Akun','account-new'))+'<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Cakupan</th><th>Platform</th><th>Handle</th></tr></thead><tbody>'+M.accounts.map(a=>'<tr><td>'+text(schoolName(a.school_id))+'</td><td>'+text(a.platform)+'</td><td>'+textLink(a.profile_url,'@'+a.handle)+'</td></tr>').join('')+'</tbody></table></div></section>'+
 '<section class="mh-card">'+heading('Target Mingguan','Default 2 Instagram + 2 TikTok per sekolah.',manager()?button('Atur Target','target-new'):'')+'<p>Perubahan target hanya boleh dilakukan ARF Manager, berlaku efektif sesuai tanggal yang ditetapkan.</p></section>'+
 '<section class="mh-card"><h3>Guidelines & Assets</h3><p>Gunakan tautan arsip digital ARF yang telah ditetapkan. Jangan menyimpan password akun platform dalam Media Hub.</p><p>Kategori: '+text(M.categories.map(c=>c.name).join(' · '))+'</p></section></div>';
}
function users(){
 if(!central())return '<p>Tidak memiliki izin User Management.</p>';
 return heading('User & Role Management','Satu identitas login; izin Planner dan Media Hub bersifat independen.',(manager()?button('Assign Existing User','member-new'):'')+button('Create School Account','school-account-new'))+
 '<section class="mh-card"><p class="mh-note">Hierarki: ARF Manager → Koordinator Media Sosial ARF → Koordinator Sekolah (tanpa koordinator regional). Koordinator sekolah masuk dengan username dan password yang dibuat pusat.</p>'+
 '<div class="mh-table-wrap"><table class="mh-table"><thead><tr><th>Pengguna</th><th>Role Media Hub</th><th>Sekolah</th><th>Status</th><th>Planner eligibility</th><th>Aksi</th></tr></thead><tbody>'+
 M.members.map(m=>'<tr><td>'+text(personBy(m.user_id))+'</td><td>'+text(mediaRoleLabel(m.role))+'</td><td>'+text(schoolName(m.school_id))+'</td><td>'+(m.active?'Active':'Inactive')+'</td><td>'+(m.planner_enabled?'Diizinkan':'Media Hub only')+(manager()?button(m.planner_enabled?'Cabut Izin':'Izinkan','planner-toggle','data-id="'+text(m.user_id)+'"'):'')+'</td><td>'+(m.role==='SCHOOL_MEDIA_COORDINATOR'?button('Reset Password','account-reset','data-id="'+text(m.user_id)+'"')+button(m.active?'Deactivate':'Reactivate','member-toggle','data-id="'+text(m.user_id)+'"'):'—')+'</td></tr>').join('')+
 '</tbody></table></div></section>';
}
function modal(){
 if(!M.modal)return '';
 const c=M.editing||{},scope=userSchool()?'SCHOOL':(c.scope||'SCHOOL'),schoolId=userSchool()||c.school_id||'';
 let body='',title='',form='';
 if(M.modal==='content'){
  title=c.id?'Edit Content':'New Content';form='mh-content-form';
  body=select('Cakupan','scope','<option value="SCHOOL">Sekolah</option>'+(central()?'<option value="ARF" '+(scope==='ARF'?'selected':'')+'>ARF</option>':''),userSchool()?'disabled':'')+
   (central()?select('Sekolah','school_id',options(M.schools,schoolId,'Pilih sekolah')):'<input type="hidden" name="school_id" value="'+text(schoolId)+'">')+
   input('Judul Konten','title',c.title,'text','required minlength="3" maxlength="220"')+
   select('Kategori','category_id',options(M.categories,c.category_id,'Pilih kategori'),'required')+
   fieldText('Brief / Objective','brief',c.brief,true)+fieldText('Caption / Script','caption',c.caption)+
   input('Link Asset (HTTPS)','asset_url',c.asset_url,'url','placeholder="https://drive.google.com/..."')+
   select('PIC','assigned_to',options(M.people,c.assigned_to||store.user?.id,'Pilih PIC','full_name'),'required')+
   input('Jadwal Publikasi (WIB)','planned_at',c.planned_at?mediaPeriodFor(c.planned_at).slice(0,16).replace(' ','T'):'','datetime-local','required')+
   select('Status Produksi','status',statusOptions.map(x=>'<option '+(x===(c.status||'Planned')?'selected':'')+'>'+x+'</option>').join(''))+
   '<fieldset class="mh-checklist"><legend>Checklist kelayakan publikasi</legend>'+
   [['consent_checked','Izin penggunaan foto/video telah dipastikan'],['copyright_checked','Musik dan aset memiliki izin penggunaan'],
    ['accuracy_checked','Narasi dan informasi sudah diperiksa'],['brand_checked','Sesuai standar identitas dan privasi ARF']].map(([name,label])=>'<label class="mh-check"><input type="checkbox" name="'+name+'" '+(c[name]?'checked':'')+'> '+label+'</label>').join('')+
   '</fieldset>'+
   '<label class="mh-check"><input type="checkbox" name="strategic" '+(c.strategic?'checked':'')+'> Konten strategis (wajib approval Manager)</label>'+
   '<label class="mh-check"><input type="checkbox" name="sensitive_flag" '+(c.sensitive_flag?'checked':'')+'> Materi sensitif / memerlukan eskalasi ke pusat</label>'+
   (c.id?'<div class="mh-content-actions"><button type="button" class="mh-btn-outline" data-mh-action="content-archive" data-id="'+text(c.id)+'">Archive Content</button></div>':'');
 }else if(M.modal==='publication'){
  title=c.id?'Perbaiki Bukti Publikasi':'Submit Publication';form='mh-publication-form';
  const eligible=eligibleContents();
  body=select('Konten','content_id',options(eligible,c.content_id,'Pilih konten','title'),'required')+
   select('Platform','platform',PLATFORM.map(x=>'<option '+(x===(c.platform||'Instagram')?'selected':'')+'>'+x+'</option>').join(''))+
   select('Akun Media','account_id',options(M.accounts.filter(a=>a.active),c.account_id,'Pilih akun media','handle'),'required')+
   select('Format','format',['Video','Reels','Carousel','Single Feed','Photo Carousel'].map(x=>'<option '+(x===(c.format||'Video')?'selected':'')+'>'+x+'</option>').join(''))+
   input('Tanggal & Jam Terbit (WIB)','actual_at',c.actual_at?mediaPeriodFor(c.actual_at).slice(0,16).replace(' ','T'):'','datetime-local','required')+
   input('URL Post Instagram / TikTok (HTTPS)','public_url',c.public_url,'url','required placeholder="https://..."')+
   input('Tautan Bukti Pendukung (optional)','evidence_url',c.evidence_url,'url','placeholder="https://..."')+
   '<p class="mh-note">Setelah disubmit, publikasi berstatus Pending. Hanya Koordinator ARF atau Manager yang berwenang memverifikasi, dan tidak boleh memverifikasi kiriman sendiri.</p>';
 }else if(M.modal==='school'){
  title='Tambah Sekolah';form='mh-school-form';
  body=input('Kode Sekolah','code','','text','required maxlength="30" pattern="[A-Za-z0-9_-]{2,30}"')+input('Nama Sekolah','name','','text','required')+input('Regional','regional')+
  select('Jenjang','level',['TPA','PAUD','TK','SD','SMP','SMA','SMK'].map(x=>'<option>'+x+'</option>').join(''));
 }else if(M.modal==='account'){
  title='Tambah Akun Media';form='mh-account-form';
  body=select('Cakupan','scope','<option>SCHOOL</option><option>ARF</option>')+select('Sekolah','school_id',options(M.schools,'','Tidak ada — ARF'))+
   select('Platform','platform',PLATFORM.map(p=>'<option>'+p+'</option>').join(''))+input('Handle','handle','','text','required')+input('Profile URL','profile_url','','url','placeholder="https://..."');
 }else if(M.modal==='target'){
  title='Target Mingguan';form='mh-target-form';
  body=select('Sekolah','school_id',options(M.schools,'','Pilih sekolah'),'required')+
   select('Platform','platform',PLATFORM.map(p=>'<option>'+p+'</option>').join(''))+input('Kuota / minggu','quota','2','number','required min="0" max="100"')+input('Berlaku sejak','effective_from',M.week,'date','required')+
   fieldText('Alasan perubahan','reason');
 }else if(M.modal==='member'){
  title='Assign Existing User';form='mh-member-form';
  body=select('User akun existing','user_id',options(M.people,'','Pilih pengguna','full_name'),'required')+
   select('Media Role','role',['ARF_MANAGER','ARF_MEDIA_COORDINATOR','SCHOOL_MEDIA_COORDINATOR'].map(x=>'<option value="'+x+'">'+mediaRoleLabel(x)+'</option>').join(''))+
   select('Sekolah (wajib untuk Koordinator Sekolah)','school_id',options(M.schools,'','Pilih sekolah'));
 }else if(M.modal==='schoolAccount'){
  title='Create School Account';form='mh-school-account-form';
  body=select('Sekolah penugasan','school_id',options(M.schools,'','Pilih sekolah'),'required')+
   input('Nama lengkap','full_name','','text','required minlength="2" maxlength="100"')+
   input('Username','username','','text','required pattern="[a-z][a-z0-9_]{2,29}" maxlength="30" autocomplete="off"')+
   input('Password awal (min. 12 karakter)','password','','password','required minlength="12" autocomplete="new-password"')+
   '<p class="mh-note">Akun dibuat di sistem autentikasi yang sama dengan WorkFlow Planner. Tidak otomatis memiliki akses Planner dan tidak memakai email untuk login.</p>';
 }
 return '<div class="mh-modal-shade" data-mh-action="close-modal"><div class="mh-dialog" role="dialog" aria-modal="true" aria-label="'+text(title)+'"><div class="mh-dialog-head"><h2>'+text(title)+'</h2><button type="button" data-mh-action="close-modal">✕</button></div><form id="'+form+'" class="mh-form"><div class="mh-modal-body">'+body+'</div><footer><button type="button" class="mh-btn-outline" data-mh-action="close-modal">Batal</button><button type="submit" class="mh-btn" '+(M.busy?'disabled':'')+'>Simpan</button></footer></form></div></div>';
}
function render(){
 if(!store.user){root.innerHTML='<main class="mh-empty-access"><h1>ARF Media Hub</h1><p>Login menggunakan akun WorkFlow Planner untuk mengakses modul ini.</p><a class="mh-btn" href="/?next=media-hub">Login</a></main>';return;}
 if(!M.member){root.innerHTML='<main class="mh-empty-access"><h1>Akses ARF Media Hub diperlukan</h1><p>Akun ini belum memiliki keanggotaan Media Hub. Izin Planner tidak otomatis memberi akses Media Hub.</p><a class="mh-btn-outline" href="/">Kembali ke WorkFlow Planner</a></main>';return;}
 root.innerHTML=shell();
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
  const current=M.editing;
  const schoolId=userSchool()||values.school_id||null;
  const scope=userSchool()?'SCHOOL':values.scope;
  if(scope==='SCHOOL'&&!schoolId)throw Error('Pilih sekolah.');
  if(values.asset_url&&!validAttachment(values.asset_url))throw Error('Link asset harus menggunakan HTTPS.');
  if(!values.category_id||!values.assigned_to||!values.planned_at||!values.brief?.trim())throw Error('Kategori, PIC, Brief dan Jadwal wajib diisi.');
  const payload={title:values.title.trim(),category_id:values.category_id||null,brief:values.brief.trim(),caption:values.caption.trim(),
   asset_url:values.asset_url||null,assigned_to:values.assigned_to||store.user.id,
   planned_at:toIso(values.planned_at),status:values.status,strategic:!!values.strategic,
   consent_checked:!!values.consent_checked,copyright_checked:!!values.copyright_checked,
   accuracy_checked:!!values.accuracy_checked,brand_checked:!!values.brand_checked,
   sensitive_flag:!!values.sensitive_flag};
  if(['In Review','Approved','Scheduled','Published'].includes(payload.status)&&
      !(payload.consent_checked&&payload.copyright_checked&&payload.accuracy_checked&&payload.brand_checked))
   throw Error('Selesaikan checklist izin, hak cipta, akurasi, dan standar ARF sebelum review/penjadwalan.');
  if(!current?.id){payload.scope=scope;payload.school_id=scope==='SCHOOL'?schoolId:null;payload.created_by=store.user.id;}
  await createOrUpdate('media_contents',payload,current?.id);
 }else if(form.id==='mh-publication-form'){
  const current=M.editing,content=M.contents.find(c=>c.id===values.content_id);
  if(!content)throw Error('Konten belum dipilih');
  const url=values.public_url.trim();
  if(!values.account_id)throw Error('Pilih akun media yang sesuai.');
  if(!validAttachment(url))throw Error('Gunakan URL HTTPS.');
  const host=new URL(url).hostname.toLowerCase();
  if(values.platform==='Instagram'&&!(host==='instagram.com'||host.endsWith('.instagram.com')))throw Error('URL harus berasal dari Instagram.');
  if(values.platform==='TikTok'&&!(host==='tiktok.com'||host.endsWith('.tiktok.com')))throw Error('URL harus berasal dari TikTok.');
  const account=M.accounts.find(a=>a.id===values.account_id);
  if(!account||account.platform!==values.platform||account.school_id!==content.school_id||account.scope!==content.scope)
   throw Error('Akun harus sesuai platform dan sekolah konten.');
  const payload={content_id:content.id,school_id:content.school_id,platform:values.platform,account_id:values.account_id||null,format:values.format,
   public_url:url,evidence_url:values.evidence_url||null,actual_at:toIso(values.actual_at),verification_status:'pending'};
  if(current?.id){delete payload.content_id;delete payload.school_id;}
  await createOrUpdate('media_publications',payload,current?.id);
 }else if(form.id==='mh-school-form'){
  await store.rest('media_schools','POST','',{code:values.code.trim(),name:values.name.trim(),regional:values.regional.trim(),level:values.level});
 }else if(form.id==='mh-account-form'){
  const scope=values.scope==='ARF'?'ARF':'SCHOOL';
  if(scope==='SCHOOL'&&!values.school_id)throw Error('Pilih sekolah.');
  await store.rest('media_accounts','POST','',{scope,school_id:scope==='ARF'?null:values.school_id,platform:values.platform,handle:values.handle.trim().replace(/^@/,''),profile_url:values.profile_url||null});
 }else if(form.id==='mh-target-form'){
  if(!manager())throw Error('Hanya ARF Manager dapat mengubah target.');
  await store.rest('media_targets','POST','',{school_id:values.school_id,platform:values.platform,quota:Number(values.quota),effective_from:values.effective_from,reason:values.reason||'',created_by:store.user.id});
 }else if(form.id==='mh-member-form'){
  if(!manager())throw Error('Hanya ARF Manager dapat menetapkan role.');
  if(values.role==='SCHOOL_MEDIA_COORDINATOR'&&!values.school_id)throw Error('Sekolah wajib dipilih.');
  const member={role:values.role,school_id:values.role==='SCHOOL_MEDIA_COORDINATOR'?values.school_id:null,active:true};
  if(M.members.some(m=>m.user_id===values.user_id))
   await store.rest('media_members','PATCH','?user_id=eq.'+escapeId(values.user_id),member);
  else await store.rest('media_members','POST','',{user_id:values.user_id,...member});
 }else if(form.id==='mh-school-account-form'){
  await callProvision({action:'create',school_id:values.school_id,username:values.username.trim(),full_name:values.full_name.trim(),password:values.password});
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
  const xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+
  [headers,...fields].map((values,i)=>'<row r="'+(i+1)+'">'+values.map((v,j)=>xmlCell(v,String.fromCharCode(65+j)+(i+1),i===0?1:0)).join('')+'</row>').join('')+'</sheetData></worksheet>';
  const files=[
   ['[Content_Types].xml','<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>'],
   ['_rels/.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
   ['xl/workbook.xml','<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Media Performance" sheetId="1" r:id="rId1"/></sheets></workbook>'],
   ['xl/_rels/workbook.xml.rels','<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>'],
   ['xl/worksheets/sheet1.xml',xml]
  ];
  const blob=new Blob([zipFiles(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  download(blob,'arf-media-hub-'+M.week+'.xlsx');
 }else{
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
 if(action==='account-new'&&central())return startModal('account');
 if(action==='target-new'&&manager())return startModal('target');
 if(action==='member-new'&&manager())return startModal('member');
 if(action==='school-account-new'&&central())return startModal('schoolAccount');
 if(action==='content-archive'){
  const c=M.contents.find(c=>c.id===element.dataset.id);
  if(!c||c.archived_at)throw Error('Konten tidak ditemukan.');
  if(!confirm('Arsipkan konten '+c.title+'? Riwayat bukti publikasi tetap tersimpan.'))return;
  await store.rest('media_contents','PATCH','?id=eq.'+escapeId(c.id),{archived_at:new Date().toISOString()});
  M.modal=null;M.toast='Konten diarsipkan, bukti publikasi tetap tersimpan.';await refresh();return;
 }
 if(action==='content-approve'||action==='content-revision'){
  if(!central())throw Error('Review hanya oleh pusat.');
  const decision=action==='content-approve'?'approved':'revision',feedback=decision==='revision'?prompt('Catatan revisi (wajib):')||'':'';
  if(decision==='revision'&&feedback.trim().length<3)throw Error('Alasan revisi harus diisi.');
  await store.rpc('media_review_content',{p_content:element.dataset.id,p_decision:decision,p_feedback:feedback});
  M.toast='Keputusan review tersimpan.';await refresh();return;
 }
 if(action==='publication-verify'||action==='publication-reject'){
  if(!central())throw Error('Hanya pusat dapat memverifikasi.');
  const reason=action==='publication-reject'?prompt('Alasan penolakan (wajib):')||'':'';
  if(action==='publication-reject'&&reason.trim().length<3)throw Error('Alasan minimal 3 karakter.');
  await store.rpc('media_verify_publication',{p_publication:element.dataset.id,p_decision:action==='publication-verify'?'verified':'rejected',p_reason:reason});
  M.toast='Verifikasi tercatat.';await refresh();return;
 }
 if(action==='member-toggle'){
  if(!central())throw Error('Akses ditolak.');
  const member=M.members.find(m=>m.user_id===element.dataset.id);if(!member||member.role!=='SCHOOL_MEDIA_COORDINATOR')throw Error('Anggota tidak valid.');
  await store.rest('media_members','PATCH','?user_id=eq.'+escapeId(member.user_id),{active:!member.active});
  M.toast='Status akun diperbarui.';await refresh();return;
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
});
document.addEventListener('submit',e=>{
 if(!e.target.id?.startsWith('mh-'))return;e.preventDefault();
 busy(()=>handleSubmit(e.target));
});
(async()=>{try{await store.initialize();await refresh();}catch(err){M.error=err.message||'Gagal membuka ARF Media Hub';render();}})();
