import {safe} from './core.js';
import {PLATFORMS,STATUSES,FORMATS,PILLARS,jakartaDate,shift,weekStart,schoolPerformance,validPost,csvCell} from './media-core.js';
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
export function mountMediaHub(root,{store,membership,onPlanner,onLogout,hasPlanner,demo}){
 const host=document.createElement('section');host.className='mh-shell';root.replaceChildren(host);
 const uid=store.user?.id;let member=membership,schools=[],contents=[],members=[],view='Dashboard',week=weekStart(jakartaDate()),schoolFilter='',platformFilter='',editId='',editingSchool='',editingMember='',loading=true,error='',notice='',busy=false;
 const central=()=>member?.role==='arf_manager'||member?.role==='arf_media_coordinator';const manager=()=>member?.role==='arf_manager';
 let scope=membership?.role==='arf_media_coordinator'?'foundation':'schools';
 const accountKind=id=>schools.find(s=>s.id===id)?.kind;
 const scopeSchools=()=>schools.filter(s=>!central()||s.kind===(scope==='foundation'?'foundation':'school'));
 const canProduce=id=>manager()||(member?.role==='arf_media_coordinator'&&accountKind(id)==='foundation')||(member?.role==='school_media_coordinator'&&id===member.school_id);
 const canReview=c=>central()&&c.created_by!==uid&&c.status==='Submitted'&&(manager()||accountKind(c.school_id)==='school');
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
 function filters(){return '<div class="mh-filter"><label>Minggu <input type="date" id="mh-week" value="'+esc(week)+'"></label>'+button('‹','prev')+button('›','next')+(central()&&scope==='schools'?'<label>Sekolah <select id="mh-school"><option value="">Semua sekolah</option>'+opts(scopeSchools(),schoolFilter)+'</select></label>':'')+'<label>Platform <select id="mh-platform"><option value="">Semua platform</option>'+opts(PLATFORMS,platformFilter)+'</select></label>'+button('Muat ulang','refresh')+'</div><p class="mh-muted">Periode '+esc(week)+' – '+esc(shift(week,6))+' · WIB · '+(central()&&scope==='foundation'?'Akun resmi ARF · target publikasi belum ditetapkan.':'Target sekolah 2 Instagram + 2 TikTok.')+'</p>';}
 function dashboard(){
 if(central()&&scope==='foundation'){
 const list=current().filter(c=>c.actual_date>=week&&c.actual_date<=shift(week,6)&&['Submitted','Verified'].includes(c.status));
 const counts=PLATFORMS.map(p=>[p,list.filter(c=>c.platform===p).length]);
 return '<div class="mh-kpis">'+[...counts,['Terverifikasi',list.filter(c=>c.status==='Verified').length],['Menunggu review Manager',list.filter(c=>c.status==='Submitted').length]].map(x=>'<div class="card mh-kpi"><small>'+esc(x[0])+'</small><strong>'+esc(x[1])+'</strong></div>').join('')+'</div><section class="card mh-panel"><h2>ARF Official Account Performance</h2><p>Publikasi Instagram dan TikTok resmi ARF. Target minimum akun pusat belum ditetapkan dan tidak dicampur dengan KPI sekolah.</p>'+gridRows(list)+button('Export CSV','report')+'</section>';
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
 return '<section class="card mh-panel"><h2>'+esc(c.id?'Content Details':'Tambah Konten')+'</h2>'+(c.feedback?'<p class="mh-feedback"><b>Feedback:</b> '+esc(c.feedback)+'</p>':'')+'<form id="mh-content"><input type="hidden" name="id" value="'+esc(c.id)+'"><fieldset '+(locked||!own?'disabled':'')+'>'+(c.id?'<p><b>Akun:</b> '+esc(schoolName(c.school_id))+'</p>':select('Akun / Sekolah','school_id',scopeSchools().filter(s=>s.active&&canProduce(s.id)),c.school_id))+field('Judul','title',c.title,'text','required maxlength="200"')+field('PIC / Pelaksana konten','pic_name',c.pic_name,'text','required maxlength="150" placeholder="Nama penanggung jawab / pelaksana"')+select('Platform','platform',PLATFORMS,c.platform)+select('Format','format',FORMATS[c.platform],c.format)+select('Content pillar','pillar',PILLARS,c.pillar)+area('Brief','brief',c.brief)+area('Caption / script','caption',c.caption)+field('Asset link (HTTPS)','asset_url',c.asset_url,'url')+field('Rencana publikasi','planned_date',c.planned_date,'date','required')+select('Status','status',['Idea','Planned','In Production','Ready','Scheduled','Submitted',...(c.status==='Revision'?['Revision']:[]),...(locked?['Verified']:[])],c.status)+field('Tanggal aktual publikasi WIB','actual_date',c.actual_date,'date')+field('Tautan publikasi lengkap','published_url',c.published_url,'url')+'<label><input type="checkbox" name="permission_checked" '+(c.permission_checked?'checked':'')+'> Izin media, privasi anak dan hak cipta telah diperiksa</label></fieldset>'+(locked&&own?'<fieldset><legend>Metrik publikasi</legend>'+['views','likes','comments','shares'].map(k=>field(k,k,c[k],'number','min="0" step="1"')).join('')+field('Tanggal pengamatan','metrics_date',c.metrics_date,'date')+'</fieldset>':'')+'<div class="mh-actions">'+(own?'<button class="btn" type="submit">Simpan</button>':'')+button('Kembali','close-edit')+'</div></form></section>';
 }
 function administration(){
 const s=schools.find(x=>x.id===editingSchool)||{},m=members.find(x=>x.user_id===editingMember)||{};
 return '<section class="card mh-panel"><h2>School & Account Management</h2>'+table(['Nama','Jenis','Regional (filter)','Instagram','TikTok','Aktif',''],schools.map(x=>[esc(x.name),esc(x.kind),esc(x.regional),esc(x.instagram_handle),esc(x.tiktok_handle),x.active?'Ya':'Tidak',button('Edit','edit-school',x.id)]))+'<form id="mh-school-form"><h3>'+esc(s.id?'Edit sekolah':'Tambah sekolah / akun ARF')+'</h3>'+field('Nama','name',s.name,'text','required maxlength="180"')+select('Jenis','kind',[{id:'school',name:'Sekolah'},{id:'foundation',name:'Akun resmi ARF'}],s.kind||'school')+field('Regional (atribut saja)','regional',s.regional)+field('Instagram handle','instagram_handle',s.instagram_handle)+field('TikTok handle','tiktok_handle',s.tiktok_handle)+'<label><input name="active" type="checkbox" '+(s.active===false?'':'checked')+'> Aktif</label><button class="btn">Simpan sekolah</button>'+button('Reset','reset-school')+'</form></section><section class="card mh-panel"><h2>Media Hub User Access</h2><p>Gunakan UUID akun Workflow yang sudah terdaftar. Role Planner tetap terpisah. Manager pertama dipasang oleh administrator database.</p>'+table(['Pengguna','Role','Sekolah','Aktif',''],members.map(x=>[esc(x.display_name||x.user_id),esc(roleLabel[x.role]),esc(x.school_id?schoolName(x.school_id):'Seluruh ARF'),x.active?'Ya':'Tidak',x.role==='arf_manager'?'—':button('Edit','edit-member',x.user_id)]))+'<form id="mh-member-form"><h3>'+esc(m.user_id?'Edit akses':'Berikan akses Media Hub')+'</h3>'+field('User UUID','user_id',m.user_id,'text','required '+(m.user_id?'readonly':''))+field('Nama tampil','display_name',m.display_name)+select('Role','role',[{id:'arf_media_coordinator',name:'Koordinator Media Sosial ARF'},{id:'school_media_coordinator',name:'Koordinator Media Sosial Sekolah'}],m.role||'school_media_coordinator')+select('Sekolah (khusus koordinator sekolah)','school_id',[{id:'',name:'Tidak ada'},...schools.filter(x=>x.kind==='school'&&x.active)],m.school_id||'')+'<label><input name="active" type="checkbox" '+(m.active===false?'':'checked')+'> Aktif</label><button class="btn">Simpan akses</button>'+button('Reset','reset-member')+'</form></section>';
 }
 function render(){
 if(!alive())return;
 const nav=['Dashboard','Content Workspace','Content Calendar','Published Content',...(central()?['Review & Feedback']:[]),'Performance Analytics',...(manager()?['Administration']:[])];
 let body=loading?'<p>Memuat data…</p>':!member?'<p>Akses ARF Media Hub ditolak atau telah dicabut.</p>':error?'<p class="mh-error">'+esc(error)+'</p>'+button('Coba lagi','refresh'):editId?editContent():view==='Dashboard'?dashboard():view==='Content Workspace'?board():view==='Content Calendar'?calendar():view==='Published Content'?gridRows(current().filter(c=>['Submitted','Verified','Revision'].includes(c.status)&&period(c))):view==='Review & Feedback'?gridRows(current().filter(c=>c.status==='Submitted'||c.status==='Revision')):view==='Performance Analytics'?analytics():administration();
 host.innerHTML=(demo?'<div class="mh-demo-bar" style="padding:12px 20px;background:#fff1d5;color:#603d0a;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><strong>DEMO · Data simulasi lokal</strong><label> Coba sebagai <select id="mh-demo-role">'+demo.roles.map(r=>'<option value="'+esc(r.id)+'" '+(r.id===demo.selected?'selected':'')+'>'+esc(r.display_name)+'</option>').join('')+'</select></label>'+button('Reset data demo','reset-demo')+'<small>Tidak tersambung ke database produksi.</small></div>':'')+'<header class="mh-header"><div><small>WORKFLOW PLANNER · MODULE 02</small><h1>ARF Media Hub</h1><p>'+esc(roleLabel[member?.role]||'Tidak berwenang')+'</p></div><div class="mh-actions">'+(hasPlanner?button('Workflow Planner','planner'):'')+button('Sign out','logout')+'</div></header>'+(member?'<nav class="mh-nav">'+nav.map(n=>button(n,'nav',n,n===view?'aria-current="page"':'')).join('')+'</nav>':'')+'<main class="mh-main">'+(central()&&member&&!loading?'<div class="mh-actions" style="margin-bottom:16px">'+button('Konten Resmi ARF','scope','foundation',scope==='foundation'?'aria-current="page"':'')+button('Monitoring Sekolah','scope','schools',scope==='schools'?'aria-current="page"':'')+'</div>':'')+(notice?'<p class="mh-notice" role="status">'+esc(notice)+'</p>':'')+(!loading&&!error&&member&&!editId&&view!=='Administration'?filters()+(view==='Content Workspace'&&canNew()?button('+ Tambah konten','new'):''):'')+body+'</main>';
 }
 async function load(){
 if(!alive())return;loading=true;error='';render();
 try{member=await mediaMembership(store);if(!member){schools=[];contents=[];members=[];return;}
 [schools,contents]=await Promise.all([all(store,'media_schools','name.asc,id.asc'),all(store,'media_contents','created_at.desc,id.asc')]);
 members=manager()?await all(store,'media_members','display_name.asc,user_id.asc'):[];
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
 if(a==='edit-school'||a==='reset-school'){editingSchool=id;render();return;}if(a==='edit-member'||a==='reset-member'){editingMember=id;render();return;}
 if(a==='report'&&scope==='foundation'&&central()){downloadCSV([['Judul','PIC','Platform','Tanggal aktual','Status'],...current().filter(c=>period(c)&&['Submitted','Verified'].includes(c.status)).map(c=>[c.title,c.pic_name,c.platform,c.actual_date,c.status])],'ARF-official-'+week+'.csv');return;}if(a==='report'){downloadCSV([['Sekolah','Instagram','TikTok','Capaian (%)','Menunggu verifikasi'],...perf().map(s=>[s.name,s.ig,s.tt,s.score,s.pending])],'ARF-media-'+week+'.csv');return;}
 if(a==='verify'||a==='revise'){const c=contents.find(x=>x.id===id);if(!c||!canReview(c))return;let feedback='';
 if(a==='verify'){if(!confirm('Pastikan tautan aktif, akun sekolah benar, tanggal dan jenis konten sesuai. Verifikasi publikasi ini?'))return;}else{feedback=prompt('Catatan revisi (wajib):')?.trim();if(!feedback)return;}
 void run(async()=>{await save('media_contents',id,'id',{status:a==='verify'?'Verified':'Revision',feedback});notice='Review tersimpan.';await load();});}
 });
 host.addEventListener('change',e=>{const t=e.target;if(t.id==='mh-demo-role'&&demo){demo.onRole(t.value);return;}if(t.id==='mh-week'&&t.value){week=weekStart(t.value);render();}if(t.id==='mh-school'){schoolFilter=t.value;render();}if(t.id==='mh-platform'){platformFilter=t.value;render();}if(t.name==='platform'&&t.form?.id==='mh-content')t.form.elements.format.innerHTML=opts(FORMATS[t.value],FORMATS[t.value][0]);});
 host.addEventListener('submit',e=>{const f=e.target;if(!f.id.startsWith('mh-'))return;e.preventDefault();const d=Object.fromEntries(new FormData(f));
 void run(async()=>{
 if(f.id==='mh-content'){
 const c=contents.find(x=>x.id===d.id);
 if(c?.status==='Verified'){const p={};for(const k of ['views','likes','comments','shares'])p[k]=d[k]===''?null:Number(d[k]);p.metrics_date=d.metrics_date||null;if(Object.values(p).some(v=>typeof v==='number')&&!p.metrics_date)throw Error('Tanggal pengamatan wajib diisi.');await save('media_contents',c.id,'id',p);}
 else {const p={title:d.title.trim(),pic_name:(d.pic_name||'').trim(),platform:d.platform,format:d.format,pillar:d.pillar,brief:d.brief,caption:d.caption,asset_url:d.asset_url,planned_date:d.planned_date,actual_date:d.actual_date||null,published_url:d.published_url.trim(),permission_checked:d.permission_checked==='on',status:d.status};
 if(!c)p.school_id=d.school_id;
 if(!p.pic_name)throw Error('PIC / Pelaksana konten wajib diisi.');if(!canProduce(c?.school_id||p.school_id))throw Error('Akses produksi ditolak.');
 if(p.status==='Submitted'&&(!p.permission_checked||!p.actual_date||!validPost(p.platform,p.published_url)))throw Error('Lengkapi tanggal aktual, izin media, dan tautan publikasi yang valid.');
 await save('media_contents',c?.id,'id',p);}
 editId='';notice='Konten tersimpan.';
 }else if(f.id==='mh-school-form'&&manager()){await save('media_schools',editingSchool,'id',{name:d.name.trim(),kind:d.kind,regional:d.regional,instagram_handle:d.instagram_handle,tiktok_handle:d.tiktok_handle,active:d.active==='on'});editingSchool='';notice='Sekolah tersimpan.';}
 else if(f.id==='mh-member-form'&&manager()){if(d.role==='school_media_coordinator'&&!d.school_id)throw Error('Sekolah wajib dipilih.');const p={role:d.role,display_name:d.display_name,school_id:d.role==='school_media_coordinator'?d.school_id:null,active:d.active==='on'};if(!editingMember)p.user_id=d.user_id.trim();await save('media_members',editingMember,'user_id',p);editingMember='';notice='Akses tersimpan.';}
 await load();
 });
 });
 render();void load();
}
