// Native Excel Gantt exporter, and client-side jsPDF Gantt printout.
// No Work Item data is sent to a third-party service.
import {projectIds,safeColor,plusDays,dayDiff} from './core.js';
import {loadJsPDF} from './pdf-report.js';

const encode=new TextEncoder();
const literal=(v)=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[ch]));
const latin=(v)=>String(v??'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'?');
const MAX_DAYS=3660;
const STATUS_STYLE={'Completed':5,'In Progress':6,'On Hold':7,'Not Started':8};
const STATUS_COLOR={'Completed':'#009b4c','In Progress':'#3f6276','On Hold':'#c89b55','Not Started':'#89958b'};
const isoPattern=/^\d{4}-\d{2}-\d{2}$/;
function validDate(text){
 if(!isoPattern.test(String(text||'')))return false;
 const d=new Date(text+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===text;
}
function ymdUTC(date){return date.toISOString().slice(0,10);}
function dayStart(text){return new Date(text+'T00:00:00Z');}
export function normalizeGanttRange(input={}){
 const rangeType=input.rangeType==='years'?'years':'dates';
 let startDate=String(input.startDate||''),endDate=String(input.endDate||'');
 if(rangeType==='years'){
  const y1=Number(input.startYear),y2=Number(input.endYear);
  if(!Number.isInteger(y1)||!Number.isInteger(y2)||y1<2000||y2>2100||y2<y1||y2-y1>9)
   throw Error('Pilih rentang tahun yang valid (maksimal 10 tahun).');
  startDate=y1+'-01-01';endDate=y2+'-12-31';
 }
 if(!validDate(startDate)||!validDate(endDate)||endDate<startDate)throw Error('Rentang tanggal tidak valid.');
 const days=dayDiff(startDate,endDate)+1;
 if(days>MAX_DAYS)throw Error('Rentang laporan maksimal sekitar 10 tahun.');
 return {startDate,endDate,rangeType,days,projectId:input.projectId||'',format:input.format||'pdf'};
}
function intersects(t,from,to){
 const first=t.start_date||t.due_date,last=t.due_date||t.start_date;
 return Boolean(first&&last&&first<=to&&last>=from);
}
export function buildGanttRows(tasks,projects,range,positions=[],projectOrder=[]){
 const rank=new Map(projectOrder.map((id,i)=>[id,i]));
 const taskRank=new Map(positions.map(x=>[x.project_id+'|'+x.task_id,x.sort_order]));
 const choices=projects.filter(p=>!range.projectId||p.id===range.projectId).slice().sort((a,b)=>{
  const ra=rank.get(a.id),rb=rank.get(b.id);
  if(ra!==undefined&&rb!==undefined)return ra-rb;
  if(ra!==undefined)return -1;if(rb!==undefined)return 1;
  return a.name.localeCompare(b.name,'id');
 });
 if(range.projectId&&!choices.length)throw Error('Project yang dipilih tidak tersedia.');
 const results=[];
 function addGroup(project,items){
  if(!items.length)return;
  const id=project?.id||'__unassigned__';
  const color=safeColor(project?.color||'#3f6276');
  items.sort((a,b)=>{
   const ra=taskRank.get(id+'|'+a.id),rb=taskRank.get(id+'|'+b.id);
   if(ra!==undefined&&rb!==undefined)return ra-rb;
   if(ra!==undefined)return -1;if(rb!==undefined)return 1;
   return String(a.start_date||a.due_date).localeCompare(String(b.start_date||b.due_date))||String(a.title).localeCompare(String(b.title));
  });
  results.push({type:'project',name:project?.name||'Tanpa Project',projectId:id,color,count:items.length});
  for(const task of items)results.push({type:'task',task,projectId:id,name:task.title,color:STATUS_COLOR[task.status]||STATUS_COLOR['Not Started']});
 }
 for(const project of choices){
  const items=tasks.filter(t=>projectIds(t).includes(project.id)&&intersects(t,range.startDate,range.endDate));
  addGroup(project,items);
 }
 if(!range.projectId){
  const items=tasks.filter(t=>projectIds(t).length===0&&intersects(t,range.startDate,range.endDate));
  addGroup(null,items);
 }
 return results;
}
export function ganttBuckets(range){
 const {startDate,endDate,days}=range;
 const unit=days<=93?'day':days<=730?'week':'month';
 const buckets=[];
 let cur=startDate;
 while(cur<=endDate){
  let next;
  if(unit==='day')next=plusDays(cur,1);
  else if(unit==='week')next=plusDays(cur,7);
  else{const d=dayStart(cur);d.setUTCMonth(d.getUTCMonth()+1,1);next=ymdUTC(d);}
  const end=next>endDate?endDate:plusDays(next,-1);
  const label=unit==='month'?cur.slice(0,7):cur.slice(8,10)+'/'+cur.slice(5,7)+(unit==='week'?'–'+end.slice(8,10)+'/'+end.slice(5,7):'');
  buckets.push({start:cur,end,label});
  cur=next;
  if(buckets.length>1500)throw Error('Terlalu banyak interval pada timeline.');
 }
 return {unit,buckets};
}
export function buildGanttExportData({tasks,projects,positions=[],projectOrder=[],...settings}){
 const range=normalizeGanttRange(settings);
 const rows=buildGanttRows(tasks,projects,range,positions,projectOrder);
 const {unit,buckets}=ganttBuckets(range);
 const uniqueTaskIds=new Set(rows.filter(x=>x.type==='task').map(x=>x.task.id));
 return {range,rows,unit,buckets,uniqueTasks:uniqueTaskIds.size,projectCount:rows.filter(x=>x.type==='project').length};
}
function colName(i){
 let str='';for(let n=i;n>0;n=Math.floor((n-1)/26))str=String.fromCharCode(65+(n-1)%26)+str;
 return str;
}
function xmlCell(value,ref,style=0){
 if(value===null||value===undefined||value==='')return '<c r="'+ref+'" s="'+style+'"/>';
 return '<c r="'+ref+'" s="'+style+'" t="inlineStr"><is><t xml:space="preserve">'+literal(value)+'</t></is></c>';
}
function bytes(value){return value instanceof Uint8Array?value:encode.encode(value);}
function crc32(buffer){
 let crc=0xffffffff;
 for(const byte of buffer){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function zipFiles(entries){
 const locals=[],central=[];let offset=0;
 const le16=(v)=>[v&255,(v>>>8)&255],le32=(v)=>[v&255,(v>>>8)&255,(v>>>16)&255,(v>>>24)&255];
 for(const [name,content] of entries){
  const b=bytes(content),n=encode.encode(name),crc=crc32(b);
  const loc=Uint8Array.from([...le32(0x04034b50),...le16(20),...le16(0x800),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(b.length),...le32(b.length),...le16(n.length),...le16(0),...n]);
  const ctr=Uint8Array.from([...le32(0x02014b50),...le16(20),...le16(20),...le16(0x800),...le16(0),...le16(0),...le16(0),...le32(crc),...le32(b.length),...le32(b.length),...le16(n.length),...le16(0),...le16(0),...le16(0),...le16(0),...le32(0),...le32(offset),...n]);
  locals.push(loc,b);central.push(ctr);offset+=loc.length+b.length;
 }
 const centralSize=central.reduce((n,b)=>n+b.length,0);
 const end=Uint8Array.from([ ...le32(0x06054b50),...le16(0),...le16(0),...le16(entries.length),...le16(entries.length),...le32(centralSize),...le32(offset),...le16(0)]);
 const size=offset+centralSize+end.length;
 const output=new Uint8Array(size);let cursor=0;
 for(const part of [...locals,...central,end]){output.set(part,cursor);cursor+=part.length;}
 return output;
}
export function createGanttXlsx(data,workspaceName='Workspace'){
 const {range,rows,buckets,unit}=data;
 if(buckets.length>1200)throw Error('Rentang terlalu besar untuk ekspor Excel.');
 const cells=[],merges=[],first=5,lastCol=4+buckets.length;
 const put=(row,cols)=>{cells.push('<row r="'+row+'">'+cols.join('')+'</row>');};
 put(1,[xmlCell('WORKFLOW PLANNER - TIMELINE / GANTT','A1',1)]);
 merges.push('A1:'+colName(Math.min(9,lastCol))+'1');
 put(2,[xmlCell(workspaceName,'A2',0),xmlCell('Periode: '+range.startDate+' - '+range.endDate,'D2',0)]);
 put(3,[xmlCell('Project / Work Item','A3',2),xmlCell('Status','B3',2),xmlCell('Start Date','C3',2),xmlCell('Due Date','D3',2),...buckets.map((b,i)=>xmlCell(b.label,colName(first+i)+'3',4))]);
 let rowIndex=3;
 for(const row of rows){
  rowIndex++;
  if(row.type==='project'){
   put(rowIndex,[xmlCell(row.name+' ('+row.count+' Work Items)','A'+rowIndex,3)]);
   merges.push('A'+rowIndex+':D'+rowIndex);
  }else{
   const task=row.task,begin=task.start_date||task.due_date,end=task.due_date||task.start_date;
   put(rowIndex,[xmlCell('    '+row.name,'A'+rowIndex),xmlCell(task.status,'B'+rowIndex),xmlCell(begin,'C'+rowIndex),xmlCell(end,'D'+rowIndex),...buckets.map((b,i)=>{
    const active=begin<=b.end&&end>=b.start;
    return xmlCell('',colName(first+i)+rowIndex,active?(STATUS_STYLE[task.status]||8):0);
   })]);
  }
 }
 const cols='<col min="1" max="1" width="50" customWidth="1"/><col min="2" max="2" width="17" customWidth="1"/><col min="3" max="4" width="15" customWidth="1"/><col min="5" max="'+lastCol+'" width="'+(unit==='week'?17:unit==='day'?10:12)+'" customWidth="1"/>';
 const sheet='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+colName(lastCol)+rowIndex+'"/><sheetViews><sheetView showGridLines="0" workbookViewId="0"><pane xSplit="4" ySplit="3" topLeftCell="E4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews><cols>'+cols+'</cols><sheetData>'+cells.join('')+'</sheetData><mergeCells count="'+merges.length+'">'+merges.map(ref=>'<mergeCell ref="'+ref+'"/>').join('')+'</mergeCells></worksheet>';
 const colors=['073B2D','EDF3EE','DDEADF','E9EFE9','C89B55','009B4C','3F6276','C89B55','89958B'];
 const fills=['<fill><patternFill patternType="none"/></fill>','<fill><patternFill patternType="gray125"/></fill>',...colors.map(c=>'<fill><patternFill patternType="solid"><fgColor rgb="FF'+c+'"/><bgColor indexed="64"/></patternFill></fill>')];
 const fillsByStyle=[0,0,2,3,4,5,6,7,8];
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font></fonts><fills count="'+fills.length+'">'+fills.join('')+'</fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="9">'+fillsByStyle.map((fill,i)=>'<xf numFmtId="0" fontId="'+(i===1||i===2||i===3?1:0)+'" fillId="'+fill+'" borderId="0" xfId="0" applyFill="'+(fill!==0?1:0)+'" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>').join('')+'</cellXfs></styleSheet>';
 const wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Timeline Gantt" sheetId="1" r:id="rId1"/></sheets></workbook>';
 const rel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
 const rootRel='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
 const types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
 return zipFiles([['[Content_Types].xml',types],['_rels/.rels',rootRel],['xl/workbook.xml',wb],['xl/_rels/workbook.xml.rels',rel],['xl/styles.xml',styles],['xl/worksheets/sheet1.xml',sheet]]);
}
function labelForPdf(value,max=46){const str=latin(value);return str.length>max?str.slice(0,max-3)+'...':str;}
function pdfColor(hex){const h=safeColor(hex);return [1,3,5].map(i=>parseInt(h.slice(i,i+2),16));}
export async function downloadGanttPDF(data,workspaceName='Workspace'){
 const JsPDF=await loadJsPDF();
 const doc=new JsPDF({orientation:'landscape',unit:'mm',format:'a4',compress:true});
 const {range,rows,buckets}=data;
 const W=297,LEFT=10,TIMEX=96,TIMEW=190,TOP=40,CELLH=8.5,MAXROWS=17;
 const maxCols=data.unit==='month'?15:data.unit==='week'?22:28;
 let page=0;
 const tasks=rows.filter(x=>x.type==='task').length;
 for(let start=0;start<Math.max(1,buckets.length);start+=maxCols){
  const segment=buckets.slice(start,start+maxCols),slot=TIMEW/Math.max(1,segment.length);
  for(let off=0;off<Math.max(1,rows.length);off+=MAXROWS){
   if(page++)doc.addPage();
   doc.setFillColor(7,59,45);doc.rect(0,0,W,13,'F');
   doc.setTextColor(255,255,255);doc.setFont('helvetica','bold');doc.setFontSize(11);doc.text('WORKFLOW PLANNER  |  TIMELINE / GANTT',LEFT,8.5);
   doc.setTextColor(63,98,118);doc.setFont('helvetica','normal');doc.setFontSize(8);
   doc.text(labelForPdf(workspaceName,48),LEFT,20);
   doc.text('Range: '+range.startDate+' to '+range.endDate+' | Scope: '+(range.projectId||'All Projects')+' | '+tasks+' scheduled rows',LEFT,27);
   doc.text('Pages '+page+'  |  '+(data.unit==='month'?'Monthly':data.unit==='week'?'Weekly':'Daily')+' intervals',LEFT,33);
   doc.setFillColor(237,244,239);doc.rect(LEFT,TOP,276,9,'F');
   doc.setTextColor(7,59,45);doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text('PROJECT / WORK ITEM',LEFT+2,TOP+6);
   segment.forEach((b,i)=>{const x=TIMEX+i*slot;doc.setFontSize(segment.length>23?5.3:6.5);doc.text(labelForPdf(b.label,19),x+slot/2,TOP+5.8,{align:'center'});});
   const chunk=rows.slice(off,off+MAXROWS);
   if(!chunk.length){doc.setTextColor(95,93,93);doc.text('No Work Items in selected period.',LEFT+3,TOP+18);}
   chunk.forEach((row,j)=>{
    const y=TOP+9+j*CELLH;
    if(row.type==='project'){
     doc.setFillColor(222,236,225);doc.rect(LEFT,y,276,CELLH,'F');
     doc.setFont('helvetica','bold');doc.setFontSize(8);doc.setTextColor(7,59,45);
     doc.text(labelForPdf(row.name+' ('+row.count+')',57),LEFT+3,y+5.7);
    }else{
     if(j%2===0){doc.setFillColor(249,251,249);doc.rect(LEFT,y,276,CELLH,'F');}
     doc.setTextColor(40,71,56);doc.setFont('helvetica','normal');doc.setFontSize(7);
     doc.text(labelForPdf('  '+row.name,53),LEFT+2,y+5.5);
     segment.forEach((b,i)=>{
      const task=row.task,first=task.start_date||task.due_date,last=task.due_date||task.start_date;
      if(first<=b.end&&last>=b.start){
       doc.setFillColor(...pdfColor(row.color));doc.roundedRect(TIMEX+i*slot+0.6,y+1.9,Math.max(1,slot-1.1),CELLH-3.8,0.8,0.8,'F');
      }
     });
    }
    doc.setDrawColor(227,234,228);doc.line(LEFT,y+CELLH,286,y+CELLH);
   });
   doc.setTextColor(95,93,93);doc.setFont('helvetica','normal');doc.setFontSize(7);
   doc.text('Completed: green  |  In Progress: blue  |  On Hold: gold  |  Not Started: gray',LEFT,202);
   doc.text('Page '+page,286,202,{align:'right'});
  }
 }
 const filename='workflow-gantt-'+range.startDate+'-'+range.endDate+'.pdf';
 doc.save(filename);
 return {filename,pages:page,workItems:data.uniqueTasks};
}
export function downloadGanttXLSX(data,workspaceName='Workspace'){
 const binary=createGanttXlsx(data,workspaceName);
 const filename='workflow-gantt-'+data.range.startDate+'-'+data.range.endDate+'.xlsx';
 const blob=new Blob([binary],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
 return {filename,bytes:binary.length,workItems:data.uniqueTasks};
}
