export const PLATFORMS=['Instagram','TikTok'];
export const TARGET=2;
export const STATUSES=['Idea','Planned','In Production','Ready','Scheduled','Published','Revision','Verified'];
export const FORMATS={Instagram:['Feed','Carousel','Reels'],TikTok:['Video','Photo Carousel']};
export const PILLARS=['Education & Learning','Student Achievement','People & Inspiration','Character & Sustainability','School Life & Events','Foundation & Impact'];
export function jakartaDate(now=new Date()){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;
}
export function shift(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekStart(date){const d=new Date(date+'T00:00:00Z');return shift(date,-((d.getUTCDay()+6)%7));}
export function publicationScore(ig,tt){return (Math.min(TARGET,ig)+Math.min(TARGET,tt))*25;}
export function schoolPerformance(schools,contents,date){
 const start=weekStart(date),end=shift(start,6);
 return schools.filter(s=>s.kind==='school'&&s.active).map(s=>{
  const posts=contents.filter(p=>p.school_id===s.id&&p.status==='Verified'&&p.actual_date>=start&&p.actual_date<=end);
  const ig=posts.filter(p=>p.platform==='Instagram').length,tt=posts.filter(p=>p.platform==='TikTok').length;
  return {id:s.id,name:s.name,regional:s.regional,ig,tt,score:publicationScore(ig,tt),pending:contents.filter(p=>p.school_id===s.id&&p.status==='Published'&&p.actual_date>=start&&p.actual_date<=end).length};
 });
}
export function validPost(platform,url){try{
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||u.port)return false;
 if(platform==='Instagram')return ['instagram.com','www.instagram.com'].includes(u.hostname)&&/^\/(?:p|reel)\/[A-Za-z0-9_-]+\/?$/.test(u.pathname);
 if(platform==='TikTok')return ['tiktok.com','www.tiktok.com'].includes(u.hostname)&&/^\/@[A-Za-z0-9._-]+\/(?:video|photo)\/[0-9]+\/?$/.test(u.pathname);
 return false;
 }catch{return false;}
}
export function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s)||/^[\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}

export function monthRange(month){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Select a valid month.');
 const start=month+'-01',d=new Date(start+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+1);d.setUTCDate(0);
 return {start,end:d.toISOString().slice(0,10)};
}
export function inContentRange(c,start,end){
 return [c.planned_date,c.actual_date].some(d=>d&&d>=start&&d<=end);
}
export function resolvePublicationStatus(c){
 if(c.status==='Verified')return 'Verified';
 const url=String(c.published_url||'').trim();
 if(url){
  if(!validPost(c.platform,url))throw Error('Enter a valid published content URL for the selected platform.');
  if(!c.actual_date||c.actual_date>jakartaDate()||!c.permission_checked)throw Error('Enter the actual publication date and confirm media consent.');
  return 'Published';
 }
 return ['Published','Submitted','Revision'].includes(c.status)?'Scheduled':c.status;
}
export function analyticsSummary(rows,start,end){
 const selected=rows.filter(c=>inContentRange(c,start,end));
 const live=rows.filter(c=>['Published','Verified'].includes(c.status)&&c.actual_date>=start&&c.actual_date<=end);
 const measured=live.filter(c=>c.views!=null||c.likes!=null||c.comments!=null||c.shares!=null);
 const sum=k=>measured.reduce((a,c)=>a+(Number(c[k])||0),0);
 return {total:selected.length,published:live.length,verified:live.filter(c=>c.status==='Verified').length,measured:measured.length,views:sum('views'),likes:sum('likes'),comments:sum('comments'),shares:sum('shares'),platforms:PLATFORMS.map(p=>({label:p,value:live.filter(c=>c.platform===p).length})),statuses:STATUSES.map(s=>({label:s,value:selected.filter(c=>c.status===s).length})),pillars:PILLARS.map(p=>({label:p,value:selected.filter(c=>c.pillar===p).length})),top:measured.filter(c=>c.views!=null).sort((a,b)=>Number(b.views)-Number(a.views)).slice(0,5)};
}
