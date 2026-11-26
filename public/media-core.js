export const PLATFORMS=['Instagram','TikTok'];
export const TARGET=2;
export const STATUSES=['Idea','Planned','In Production','Ready','Scheduled','Submitted','Revision','Verified'];
export const FORMATS={Instagram:['Feed','Carousel','Reels'],TikTok:['Video','Photo Carousel']};
export const PILLARS=['Education & Learning','Student Achievement','People & Inspiration','Character & Sustainability','School Life & Events','Foundation & Impact'];
export function jakartaDate(now=new Date()){
 return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
export function shift(date,n){const d=new Date(date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
export function weekStart(date){const d=new Date(date+'T00:00:00Z');return shift(date,-((d.getUTCDay()+6)%7));}
export function publicationScore(ig,tt){return (Math.min(TARGET,ig)+Math.min(TARGET,tt))*25;}
export function schoolPerformance(schools,contents,date){
 const start=weekStart(date),end=shift(start,6);
 return schools.filter(s=>s.kind==='school'&&s.active).map(s=>{
  const posts=contents.filter(p=>p.school_id===s.id&&p.status==='Verified'&&p.actual_date>=start&&p.actual_date<=end);
  const ig=posts.filter(p=>p.platform==='Instagram').length,tt=posts.filter(p=>p.platform==='TikTok').length;
  return {id:s.id,name:s.name,regional:s.regional,ig,tt,score:publicationScore(ig,tt),pending:contents.filter(p=>p.school_id===s.id&&p.status==='Submitted'&&p.actual_date>=start&&p.actual_date<=end).length};
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
