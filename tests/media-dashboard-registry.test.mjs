import test from 'node:test';
import assert from 'node:assert/strict';
import {monthRange,inContentRange,resolvePublicationStatus,analyticsSummary,jakartaDate} from '../public/media-core.js';
test('month range supports leap years and cross-year boundary',()=>{
 assert.deepEqual(monthRange('2028-02'),{start:'2028-02-01',end:'2028-02-29'});
 assert.deepEqual(monthRange('2026-12'),{start:'2026-12-01',end:'2026-12-31'});
 assert.throws(()=>monthRange('2026-13'));
});
test('all statuses match planned or actual date without duplicates',()=>{
 const a={status:'Idea',planned_date:'2026-11-04'},b={status:'Verified',planned_date:'2026-10-31',actual_date:'2026-11-01'};
 assert.equal(inContentRange(a,'2026-11-01','2026-11-30'),true);
 assert.equal(inContentRange(b,'2026-11-01','2026-11-30'),true);
 assert.equal(inContentRange(a,'2026-12-01','2026-12-31'),false);
});
test('valid URL automatically marks Published; missing URL demotes to Scheduled',()=>{
 const row={platform:'Instagram',status:'Planned',published_url:'https://www.instagram.com/p/Test123/',actual_date:jakartaDate(),permission_checked:true};
 assert.equal(resolvePublicationStatus(row),'Published');
 assert.equal(resolvePublicationStatus({...row,status:'Published',published_url:''}),'Scheduled');
 assert.throws(()=>resolvePublicationStatus({...row,permission_checked:false}));
 assert.throws(()=>resolvePublicationStatus({...row,actual_date:''}));
 assert.throws(()=>resolvePublicationStatus({...row,published_url:'https://example.com'}));
});
test('dashboard counts all statuses but metrics only dated actual publications',()=>{
 const rows=[{status:'Idea',planned_date:'2026-11-23',platform:'Instagram'},{status:'Published',actual_date:'2026-11-24',platform:'TikTok'},{status:'Verified',actual_date:'2026-11-25',platform:'Instagram',views:500,likes:20},{status:'Verified',actual_date:'2026-12-01',platform:'Instagram',views:1000}];
 const a=analyticsSummary(rows,'2026-11-23','2026-11-29');
 assert.equal(a.total,3);assert.equal(a.published,2);assert.equal(a.verified,1);assert.equal(a.measured,1);assert.equal(a.views,500);assert.equal(a.top.length,1);
});
