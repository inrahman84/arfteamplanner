// Client-side PDF report. All report data stays inside the user's browser.
// jsPDF is loaded on demand; it is never sent the report's data.
import {metrics,overdue} from './core.js';

const PDF_LIB='https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js';
const STATUSES=['Not Started','In Progress','On Hold','Completed'];
const COLOR={forest:[7,59,45],gold:[200,155,85],blue:[63,98,118],green:[0,155,76],gray:[95,93,93],light:[246,243,236],red:[179,67,58]};
let libraryPromise=null;
function asLatin(value){return String(value??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[\u2013\u2014]/g,'-').replace(/[\u2018\u2019]/g,"'").replace(/[\u2022]/g,'-').replace(/[^\x20-\x7E\n]/g,'?');}
export function filterPlannerReport(tasks,filter={}){
 const {scope='all',id=''}=filter;
 if(scope==='all')return tasks.slice();
 if(!id)throw Error('Pilih anggota, project, atau category untuk laporan');
 if(scope==='user')return tasks.filter(t=>t.assigned_to===id);
 if(scope==='project')return tasks.filter(t=>t.project_id===id);
 if(scope==='category')return tasks.filter(t=>t.category_id===id);
 throw Error('Jenis filter laporan tidak dikenali');
}
export function pdfSummary(tasks,referenceDate){
 const basic=metrics(tasks);
 const reference=referenceDate||new Date().toISOString().slice(0,10);
 return {total:tasks.length,inProgress:basic.inProgress,onHold:basic.onHold,completed:basic.completed,
 pendingApproval:tasks.filter(t=>t.completion_requested_at&&t.status!=='Completed').length,
 overdue:tasks.filter(t=>t.due_date&&t.due_date<reference&&t.status!=='Completed').length};
}
export function pdfTimeline(tasks){
 const list=tasks.filter(t=>t.start_date||t.due_date);
 if(!list.length)return {start:null,end:null,items:[]};
 const dates=list.flatMap(t=>[t.start_date,t.due_date].filter(Boolean)).sort();
 return {start:dates[0],end:dates[dates.length-1],
   items:list.slice().sort((a,b)=>String(a.start_date||a.due_date).localeCompare(String(b.start_date||b.due_date)))};
}
function loadJsPDF(){
 if(globalThis.jspdf?.jsPDF)return Promise.resolve(globalThis.jspdf.jsPDF);
 if(libraryPromise)return libraryPromise;
 libraryPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timeout=setTimeout(()=>{script.remove();reject(Error('Gagal memuat generator PDF. Periksa koneksi internet.'))},20000);
  script.src=PDF_LIB;script.async=true;script.crossOrigin='anonymous';
  script.onload=()=>{clearTimeout(timeout);globalThis.jspdf?.jsPDF?resolve(globalThis.jspdf.jsPDF):reject(Error('Library PDF belum tersedia'))};
  script.onerror=()=>{clearTimeout(timeout);reject(Error('Library PDF gagal dimuat'))};
  document.head.append(script);
 }).catch(e=>{libraryPromise=null;throw e});
 return libraryPromise;
}
const parse=s=>Date.parse((s||'')+'T00:00:00Z');
function daysBetween(a,b){return Math.max(0,Math.round((parse(b)-parse(a))/86400000));}
const cut=(value,n=60)=>{const str=asLatin(value);return str.length<=n?str:str.slice(0,Math.max(1,n-3))+'...';};
function writePDF(doc,{tasks,people,projects,categories,workspaceName,selectionLabel},day){
 const map=arr=>new Map(arr.map(x=>[x.id,x.name||x.full_name]));
 const members=map(people),projs=map(projects),cats=map(categories),summary=pdfSummary(tasks,day);
 const W=297,H=210,L=13,R=284;
 let page=0;
 function header(section){
  page++;
  if(page>1)doc.addPage('a4','landscape');
  doc.setFillColor(...COLOR.forest);doc.rect(0,0,W,13,'F');
  doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(10);
  doc.text('WORKFLOW PLANNER  /  MANAGEMENT REPORT',L,8.6);
  doc.setTextColor(...COLOR.gray);doc.setFont('helvetica','normal');doc.setFontSize(8);
  doc.text(asLatin(section),L,22);doc.text('Page '+page, R,202,{align:'right'});
  doc.setDrawColor(229,232,226);doc.line(L,197,R,197);
 }
 function txt(v,x,y,{size=9,bold=false,color=COLOR.forest,align='left'}={}){
  doc.setFont('helvetica',bold?'bold':'normal');doc.setFontSize(size);
  doc.setTextColor(...color);doc.text(asLatin(v),x,y,{align});
 }
 function sectionTitle(name,y){txt(name,L,y,{size:14,bold:true});doc.setDrawColor(...COLOR.gold);doc.line(L,y+3,L+55,y+3);}
 function empty(y,label){txt(label,L,y,{size:9,color:COLOR.gray});}
 header('Executive summary');
 txt(cut(workspaceName,90),L,34,{size:20,bold:true});
 txt('Report scope: '+cut(selectionLabel,90),L,42,{size:10,color:COLOR.gray});
 txt('Generated: '+day+'  |  Work items: '+tasks.length,L,49,{size:9,color:COLOR.gray});
 const chips=[['TOTAL WORK ITEMS',summary.total],['IN PROGRESS',summary.inProgress],['ON HOLD',summary.onHold],['COMPLETED',summary.completed],['PENDING APPROVAL',summary.pendingApproval],['OVERDUE TASKS',summary.overdue]];
 chips.forEach(([label,n],i)=>{
  const x=L+(i%3)*92,y=59+Math.floor(i/3)*29;
  doc.setFillColor(...COLOR.light);doc.roundedRect(x,y,87,24,2,2,'F');
  txt(String(n),x+4,y+11,{size:16,bold:true});
  txt(label,x+4,y+18,{size:8,color:COLOR.gray});
 });
 sectionTitle('Task status distribution',130);
 const counts=STATUSES.map(s=>[s,tasks.filter(t=>t.status===s).length]);
 let x=L;
 for(const [status,n] of counts){
  const colors={ 'Not Started':COLOR.gray,'In Progress':COLOR.blue,'On Hold':COLOR.gold,Completed:COLOR.green};
  const bar=Math.max(0,(R-L)*(tasks.length?n/tasks.length:0));
  if(bar){doc.setFillColor(...colors[status]);doc.rect(x,139,bar,9,'F');}x+=bar;
 }
 counts.forEach(([status,n],i)=>txt(status+': '+n,L+(i%2)*125,158+Math.floor(i/2)*10,{size:9}));
 // Timeline/Gantt pages.
 const timeline=pdfTimeline(tasks),items=timeline.items;
 const chunkSize=17;
 for(let off=0;off<Math.max(1,items.length);off+=chunkSize){
  header('Gantt / Timeline');
  sectionTitle('Timeline / Gantt',34);
  txt('Schedule: '+(timeline.start||'-')+' to '+(timeline.end||'-'),L,42,{size:9,color:COLOR.gray});
  if(!items.length){empty(55,'No tasks with Start Date or Due Date in this selection.');break;}
  const labelW=100,chartX=L+labelW,chartW=R-chartX;
  const duration=Math.max(1,daysBetween(timeline.start,timeline.end)+1);
  const axisY=50;
  for(let k=0;k<=6;k++){
   const d=new Date(parse(timeline.start)+Math.round(duration*k/6)*86400000);
   const tick=d.toISOString().slice(0,10);
   const bx=chartX+chartW*k/6;
   doc.setDrawColor(230,235,232);doc.line(bx,axisY+2,bx,189);
   txt(tick,bx,axisY,{size:6.5,align:k===6?'right':k===0?'left':'center',color:COLOR.gray});
  }
  items.slice(off,off+chunkSize).forEach((t,i)=>{
   const y=59+i*7.4;
   txt(cut(t.title,47),L,y,{size:7.3});
   const start=t.start_date||t.due_date,end=t.due_date||t.start_date;
   const a=Math.max(0,daysBetween(timeline.start,start)),b=Math.max(a,daysBetween(timeline.start,end)+1);
   const xx=chartX+Math.min(1,a/duration)*chartW;
   const ww=Math.max(1.5,Math.min(chartW-(xx-chartX),(b-a)/duration*chartW));
   const fill=t.status==='Completed'?COLOR.green:t.status==='On Hold'?COLOR.gold:t.status==='In Progress'?COLOR.blue:COLOR.gray;
   doc.setFillColor(...fill);doc.roundedRect(xx,y-3.5,ww,4,0.9,0.9,'F');
   if(t.completion_requested_at&&t.status!=='Completed'){doc.setDrawColor(...COLOR.gold);doc.circle(Math.min(R-1,xx+ww+2),y-1.4,1,'S');}
  });
  txt('Showing '+(off+1)+'-'+Math.min(off+chunkSize,items.length)+' of '+items.length+' scheduled work items',L,191,{size:7.4,color:COLOR.gray});
 }
 // Task grid pages, all tasks included with status, dates, and assignee.
 const columns=[{t:'WORK ITEM',w:77},{t:'ASSIGNED TO',w:41},{t:'PROJECT',w:40},{t:'CATEGORY',w:31},{t:'STATUS',w:33},{t:'START',w:24},{t:'DUE',w:24}];
 for(let off=0;off<Math.max(1,tasks.length);off+=21){
  header('Grid / Task register');
  sectionTitle('Grid / Work Item Register',34);
  const sorted=tasks.slice().sort((a,b)=>(a.due_date||'9999').localeCompare(b.due_date||'9999'));
  doc.setFillColor(...COLOR.forest);doc.rect(L,43,R-L,9,'F');let cx=L;
  for(const col of columns){txt(col.t,cx+2,49,{size:7,color:[255,255,255],bold:true});cx+=col.w;}
  const rows=sorted.slice(off,off+21);
  if(!rows.length)empty(63,'No work items match this report filter.');
  rows.forEach((t,i)=>{
   const y=52+i*6.7;
   if(i%2===0){doc.setFillColor(...COLOR.light);doc.rect(L,y,R-L,6.7,'F');}
   let x=L;const vals=[cut(t.title,47),cut(members.get(t.assigned_to)||'-',25),cut(projs.get(t.project_id)||'-',22),cut(cats.get(t.category_id)||'-',18),
    cut((t.completion_requested_at&&t.status!=='Completed')?'Pending Approval':t.status,20),t.start_date||'-',t.due_date||'-'];
   for(let j=0;j<columns.length;j++){txt(vals[j],x+2,y+4.4,{size:7.2});x+=columns[j].w;}
  });
  txt('Showing '+(off+1)+'-'+Math.min(off+21,tasks.length)+' of '+tasks.length+' work items',L,194,{size:7.4,color:COLOR.gray});
 }
 return doc;
}
export async function downloadPlannerPDF({tasks,people,projects,categories,workspaceName,selectionLabel}){
 const JsPDF=await loadJsPDF();
 const doc=new JsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const day=new Date().toISOString().slice(0,10);
 writePDF(doc,{tasks,people,projects,categories,workspaceName,selectionLabel},day);
 doc.save('workflow-planner-'+day+'.pdf');
 return {count:tasks.length,filename:'workflow-planner-'+day+'.pdf'};
}
