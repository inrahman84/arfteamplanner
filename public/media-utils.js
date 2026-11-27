// Pure helpers for ARF Media Hub week boundaries and verified-only school KPI.
// Periods are Monday 00:00 to the following Monday 00:00 in Asia/Pontianak (WIB).
export const mediaStatuses=['draft','pending','verified','rejected','withdrawn'];
export const mediaRoleLabel=role=>({
 ARF_MANAGER:'ARF Manager',
 ARF_MEDIA_COORDINATOR:'Koordinator Media Sosial ARF',
 SCHOOL_MEDIA_COORDINATOR:'Koordinator Media Sosial Sekolah'
})[role]||'No Media Hub Role';
const wibParts=date=>{
 const format=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Pontianak',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const parts=Object.fromEntries(format.formatToParts(new Date(date)).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
 return parts.year+'-'+parts.month+'-'+parts.day+'T'+parts.hour+':'+parts.minute;
};
export function mediaPeriodFor(input){
 if(!input)return '';
 const d=new Date(input);
 if(!Number.isFinite(d.getTime()))throw Error('Invalid timestamp');
 return wibParts(d);
}
const validISO=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date+'T00:00:00Z'));
export function mediaWeekStart(day=new Date()){
 let local;
 if(typeof day==='string'){
  local=day.slice(0,10);
  if(!validISO(local))throw Error('Invalid week date');
 }else local=mediaPeriodFor(day).slice(0,10);
 const d=new Date(local+'T00:00:00Z');
 const mondayDelta=(d.getUTCDay()+6)%7;
 d.setUTCDate(d.getUTCDate()-mondayDelta);
 return d.toISOString().slice(0,10);
}
export function mediaWeeklyScore(schoolId,weekStart,publications=[],targets=[]){
 const monday=mediaWeekStart(weekStart);
 const rates={Instagram:{quota:2,verified:0,pending:0},TikTok:{quota:2,verified:0,pending:0}};
 for(const platform of Object.keys(rates)){
  const applicable=(targets||[]).filter(t=>t.active!==false&&t.platform===platform&&
    (t.school_id==null||t.school_id===schoolId)&&t.effective_from<=monday&&
    (!t.effective_until||t.effective_until>=monday));
  // Global Foundation target takes precedence; legacy school targets remain historical fallback.
  const effective=applicable.sort((a,b)=>
    Number(a.school_id!=null)-Number(b.school_id!=null)||
    b.effective_from.localeCompare(a.effective_from))[0];
  if(effective)rates[platform].quota=Number(effective.quota);
 }
 for(const post of publications){
  if(post.school_id!==schoolId||!rates[post.platform]||!post.actual_at)continue;
  if(mediaWeekStart(new Date(post.actual_at))!==monday)continue;
  if(post.verification_status==='verified')rates[post.platform].verified++;
  if(post.verification_status==='pending')rates[post.platform].pending++;
 }
 const active=Object.values(rates).filter(p=>p.quota>0),eligible=active.length>0;
 const score=eligible?Math.round(active.reduce((a,p)=>a+Math.min(p.verified/p.quota,1),0)/active.length*100):null;
 return {school_id:schoolId,week:monday,eligible,score,
  ig:rates.Instagram.verified,tt:rates.TikTok.verified,
  quotaIG:rates.Instagram.quota,quotaTT:rates.TikTok.quota,
  neededIG:Math.max(0,rates.Instagram.quota-rates.Instagram.verified),
  neededTT:Math.max(0,rates.TikTok.quota-rates.TikTok.verified),
  pending:rates.Instagram.pending+rates.TikTok.pending};
}
