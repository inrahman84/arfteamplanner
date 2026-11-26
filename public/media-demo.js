import {jakartaDate,shift,weekStart,validPost,FORMATS,resolvePublicationStatus} from './media-core.js';
const KEY='arf_media_hub_isolated_demo_v1';
export const DEMO_ROLES=[
 {id:'demo-manager',role:'arf_manager',display_name:'ARF Manager (Demo)',school_id:null,active:true},
 {id:'demo-central',role:'arf_media_coordinator',display_name:'Koordinator ARF (Demo)',school_id:null,active:true},
 {id:'demo-school-a',role:'school_media_coordinator',display_name:'Koordinator Sekolah A (Demo)',school_id:'school-a',active:true},
 {id:'demo-school-b',role:'school_media_coordinator',display_name:'Koordinator Sekolah B (Demo)',school_id:'school-b',active:true}
];
export const demoMembership=id=>{const m=read().media_members.find(x=>x.user_id===id&&x.active);return m?{...m,id:m.user_id}:null;};
export const mediaDemoRoles=()=>read().media_members.filter(m=>m.active).map(m=>({id:m.user_id,display_name:m.display_name||m.user_id}));
function seed(){
 const schools=[
 {id:'school-a',name:'Sekolah A (Demo)',kind:'school',regional:'Regional 1',active:true,instagram_handle:'@demo_a',tiktok_handle:'@demo_a'},
 {id:'school-b',name:'Sekolah B (Demo)',kind:'school',regional:'Regional 2',active:true,instagram_handle:'@demo_b',tiktok_handle:'@demo_b'},
 {id:'school-c',name:'Sekolah C (Demo)',kind:'school',regional:'Regional 3',active:true,instagram_handle:'@demo_c',tiktok_handle:'@demo_c'},
 {id:'arf',name:'Akun resmi ARF (Demo)',kind:'foundation',regional:'',active:true,instagram_handle:'@demo_arf',tiktok_handle:'@demo_arf'}
 ];
 const week=weekStart(jakartaDate()),today=jakartaDate();
 const make=(i,school_id,platform,status,title,day,creator='demo-school-a')=>{
 const date=shift(week,day),pub=['Published','Verified','Revision'].includes(status),actual=date>today?today:date;
 return {id:'demo-content-'+i,school_id,created_by:creator,title,pic_name:DEMO_ROLES.find(r=>r.id===creator)?.display_name||'Tim media demo',platform,format:platform==='Instagram'?'Reels':'Video',pillar:'Education & Learning',brief:'Contoh brief konten untuk simulasi.',caption:'Contoh caption.',asset_url:'',planned_date:date,actual_date:pub?actual:null,published_url:pub?(platform==='Instagram'?'https://www.instagram.com/reel/DEMO'+i+'/':'https://www.tiktok.com/@demo/video/'+(900000+i)):'',permission_checked:pub,status,feedback:'',views:status==='Verified'?100+i*37:null,likes:status==='Verified'?10+i:null,comments:status==='Verified'?2:null,shares:status==='Verified'?1:null,metrics_date:status==='Verified'?actual:null};
 };
 return {media_schools:schools,media_members:DEMO_ROLES.map(x=>({...x,user_id:x.id})),media_contents:[
 make(1,'school-a','Instagram','Verified','Belajar dari lingkungan sekitar',0),
 make(2,'school-a','Instagram','Verified','Karya kreatif peserta didik',1),
 make(3,'school-a','TikTok','Verified','Sehari bersama guru',0),
 make(4,'school-a','TikTok','Published','Praktik numerasi menyenangkan',2),
 make(5,'school-b','Instagram','Verified','Cerita literasi sekolah',0,'demo-school-b'),
 make(6,'school-b','TikTok','Published','Sekolah bersih dan sehat',2,'demo-school-b'),
 make(7,'school-b','Instagram','In Production','Profil guru inspiratif',4,'demo-school-b'),
 make(8,'school-a','TikTok','Planned','Eksperimen sains sederhana',5),
 make(9,'school-c','Instagram','Ready','Pameran karya murid',4,'demo-central'),
 make(10,'arf','Instagram','Scheduled','Program pendidikan ARF',5,'demo-central'),
 make(11,'arf','Instagram','Verified','Cerita pendidikan ARF',0,'demo-central'),
 make(12,'arf','TikTok','Published','Inovasi pembelajaran ARF',2,'demo-central'),
 make(13,'arf','TikTok','In Production','Kenali sekolah ARF',4,'demo-central')
 ]};
}
let memory;
function read(){let data;try{const raw=localStorage.getItem(KEY);if(raw)data=JSON.parse(raw);}catch{}data=data||memory||seed();data.media_school_accounts??=[];for(const c of data.media_contents){c.pic_name??=data.media_members.find(m=>m.user_id===c.created_by)?.display_name||'';if(c.status==='Submitted')c.status='Published';}return data;}
function write(data){memory=data;try{localStorage.setItem(KEY,JSON.stringify(data));}catch{}}
export function resetMediaDemo(){write(seed());}
async function demoPasswordHash(password,salt){
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256);
 return Array.from(new Uint8Array(bits),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function loginSchoolDemo(username,password){
 const data=read(),a=data.media_school_accounts.find(a=>a.username===String(username).trim().toLowerCase());
 if(!a||!data.media_members.some(m=>m.user_id===a.user_id&&m.active)||a.hash!==await demoPasswordHash(password,a.salt))throw Error('Invalid username or password.');
 return a.user_id;
}
export function createMediaDemoStore(id,plannerUsers=[]){
 const uid=id;
 const directory=structuredClone(plannerUsers);
 return {connected:true,isDemo:true,user:{id:uid},async plannerDirectory(){const me=read().media_members.find(m=>m.user_id===uid&&m.active);if(me?.role!=='arf_manager')throw Error('Access denied.');return structuredClone(directory);},async manageSchoolAccount(p){
 const data=read(),actor=data.media_members.find(m=>m.user_id===uid&&m.active);
 if(!['arf_manager','arf_media_coordinator'].includes(actor?.role))throw Error('Access denied.');
 const pw=p.password;if(['create','reset'].includes(p.action)&&(typeof pw!=='string'||pw.length<12||pw.length>72||!/[a-z]/.test(pw)||!/[A-Z]/.test(pw)||!/[0-9]/.test(pw)))throw Error('Invalid password.');
 if(p.action==='create'){
  const username=String(p.username||'').trim().toLowerCase(),name=String(p.display_name||'').trim();
  if(!/^[a-z][a-z0-9_]{2,29}$/.test(username)||name.length<2||name.length>100)throw Error('Invalid name or username.');
  if(directory.some(u=>u.username===username)||data.media_school_accounts.some(a=>a.username===username))throw Error('Username already in use.');
  if(!data.media_schools.some(s=>s.id===p.school_id&&s.kind==='school'&&s.active))throw Error('Select an active school.');
  const user_id='demo-school-account-'+crypto.randomUUID(),salt=crypto.randomUUID(),hash=await demoPasswordHash(pw,salt);
  data.media_school_accounts.push({user_id,username,salt,hash,created_by:uid});
  data.media_members.push({user_id,display_name:name,role:'school_media_coordinator',school_id:p.school_id,active:true});
  write(data);return {user_id,username};
 }
 const a=data.media_school_accounts.find(a=>a.user_id===p.user_id),m=data.media_members.find(m=>m.user_id===p.user_id);
 if(!a||m?.role!=='school_media_coordinator')throw Error('Only dedicated school accounts can be managed.');
 if(p.action==='reset'){a.salt=crypto.randomUUID();a.hash=await demoPasswordHash(pw,a.salt);}
 else if(p.action==='revoke')m.active=false;
 else if(p.action==='restore'){if(!data.media_schools.some(s=>s.id===m.school_id&&s.active))throw Error('Assigned school is inactive.');m.active=true;}
 else throw Error('Invalid action.');
 write(data);return {ok:true};
 },async rest(table,method='GET',query='',payload){
  const data=read();const me=data.media_members.find(m=>m.user_id===uid&&m.active);
  if(!me)return [];
  const manager=me.role==='arf_manager',central=manager||me.role==='arf_media_coordinator';
  const scope=row=>central||row.school_id===me.school_id;
  if(!Object.hasOwn(data,table))throw Error('Demo table unavailable');
  const rows=data[table];
  const params=new URLSearchParams(query.replace(/^\?/,''));
  let filtered=rows.filter(row=>table==='media_school_accounts'?central||row.user_id===uid:table==='media_members'?central||row.user_id===uid:table==='media_schools'?central||row.id===me.school_id:scope(row));
  if(method==='GET'){
   for(const [key,val] of params)if(val.startsWith('eq.'))filtered=filtered.filter(r=>String(r[key])===val.slice(3));
   const offset=Number(params.get('offset')||0),limit=Number(params.get('limit')||500);
   return structuredClone(filtered.slice(offset,offset+limit).map(row=>table==='media_school_accounts'?{user_id:row.user_id,username:row.username,created_by:row.created_by}:row));
  }
  if(table==='media_school_accounts')throw Error('Use school account management.');
  if(table!=='media_contents'&&!manager)throw Error('Akses ditolak (simulasi).');
  let old=null, next;
  if(method==='PATCH'){
   old=filtered.find(r=>[...params].some(([key,val])=>val==='eq.'+r[key]));
   if(!old)throw Error('Data tidak ditemukan atau akses ditolak.');
   next={...old,...payload};
  }else if(method==='POST'){
   next={id:'demo-'+crypto.randomUUID(),...payload};
   if(table==='media_contents')next={...next,created_by:uid,feedback:'',views:null,likes:null,comments:null,shares:null};
  }else throw Error('Operasi tidak didukung.');
  if(table==='media_contents'){
   if(!scope(next)||!data.media_schools.some(s=>s.id===next.school_id&&s.active))throw Error('Akses sekolah ditolak.');
   const kind=data.media_schools.find(s=>s.id===next.school_id)?.kind;
   if(next.status==='Submitted')next.status='Published';
   if(!old||!['Verified','Revision'].includes(next.status)||next.status===old.status&&next.status==='Revision'&&Object.keys(payload).some(k=>['published_url','actual_date','permission_checked','platform'].includes(k)))next.status=resolvePublicationStatus(next);
   if(me.role==='arf_media_coordinator'&&kind==='school'&&(!old||old.status!=='Published'||!['Verified','Revision'].includes(next.status)||Object.keys(payload).some(k=>!['status','feedback'].includes(k))))throw Error('Konten sekolah hanya dapat direview.');
   if(me.role==='arf_media_coordinator'&&kind==='foundation'&&((next.status!==old?.status&&['Verified','Revision'].includes(next.status))||(old&&next.feedback!==old.feedback)))throw Error('Konten resmi ARF memerlukan review Manager.');
   if((!old||next.pic_name!==old.pic_name||next.status==='Published'||(next.status==='Verified'&&old?.status!=='Verified'))&&!String(next.pic_name||'').trim())throw Error('PIC / Pelaksana wajib diisi.');
   if(String(next.pic_name||'').length>150)throw Error('PIC maksimal 150 karakter.');
   if(old&&!central&&old.created_by!==uid)throw Error('Konten milik pengguna lain.');
   if(old&&(next.school_id!==old.school_id||next.created_by!==old.created_by))throw Error('Identitas konten tidak dapat diubah.');
   if(!FORMATS[next.platform]?.includes(next.format))throw Error('Format platform tidak sesuai.');
   if(old?.status==='Verified'&&Object.keys(payload).some(k=>!['views','likes','comments','shares','metrics_date'].includes(k)))throw Error('Konten terverifikasi terkunci.');
   if(['Verified','Revision'].includes(next.status)&&next.status!==old?.status&&(!central||!old||old.created_by===uid||old.status!=='Published'))throw Error('Perlu verifikasi independen.');
   if(['Published','Verified'].includes(next.status)){
    if(!validPost(next.platform,next.published_url)||!next.permission_checked||!next.actual_date||next.actual_date>jakartaDate())throw Error('Bukti publikasi tidak valid.');
    const key=new URL(next.published_url).pathname.replace(/\/$/,'').split('/').at(-1);
    if(rows.some(r=>r.id!==next.id&&['Published','Verified'].includes(r.status)&&r.platform===next.platform&&validPost(r.platform,r.published_url)&&new URL(r.published_url).pathname.replace(/\/$/,'').split('/').at(-1)===key))throw Error('Publikasi sudah terdaftar.');
   }
  }
  if(table==='media_members'){
   if(data.media_school_accounts.some(a=>a.user_id===next.user_id)&&next.role!=='school_media_coordinator')throw Error('Dedicated account must remain school coordinator.');
   if(next.role==='arf_manager'||old?.role==='arf_manager')throw Error('Role manager demo tidak dapat diubah.');
   if(old&&next.user_id!==old.user_id)throw Error('User identity is immutable.');
   if(!old&&!directory.some(u=>u.id===next.user_id))throw Error('Select an existing Workflow Planner user.');
   if(!old&&rows.some(r=>r.user_id===next.user_id))throw Error('Pengguna sudah terdaftar.');
   if(!['arf_media_coordinator','school_media_coordinator'].includes(next.role))throw Error('Invalid Media Hub role.');
   if(next.role==='school_media_coordinator'&&!data.media_schools.some(s=>s.id===next.school_id&&s.kind==='school'&&(s.active||!next.active)))throw Error('Select a valid school.');
   if(next.role==='arf_media_coordinator'&&next.school_id!=null)throw Error('Central coordinator must have no school restriction.');
  }
  if(table==='media_schools'&&rows.some(r=>r.id!==next.id&&(r.name===next.name||(r.kind==='foundation'&&next.kind==='foundation'))))throw Error('Sekolah atau akun ARF sudah tersedia.');
  if(old)rows[rows.indexOf(old)]=next;else rows.push(next);
  write(data);return [structuredClone(next)];
 }};
}
