import test from 'node:test';
import assert from 'node:assert/strict';
import {jakartaDate,weekStart,publicationScore,schoolPerformance,validPost,csvCell} from '../public/media-core.js';
test('WIB cut-off and Monday week start',()=>{
 assert.equal(jakartaDate(new Date('2026-11-22T17:00:00Z')),'2026-11-23');
 assert.equal(jakartaDate(new Date('2026-11-22T16:59:59Z')),'2026-11-22');
 assert.equal(weekStart('2026-11-22'),'2026-11-16');
 assert.equal(weekStart('2026-11-23'),'2026-11-23');
 assert.equal(weekStart('2027-01-01'),'2026-12-28');
});
test('platform targets independently capped',()=>{
 assert.equal(publicationScore(4,0),50);
 assert.equal(publicationScore(3,1),75);
 assert.equal(publicationScore(2,2),100);
 assert.equal(publicationScore(8,9),100);
 assert.equal(publicationScore(0,0),0);
});
test('verified evidence only, own school, actual publication week',()=>{
 const schools=[{id:'a',name:'A',kind:'school',active:true},{id:'b',name:'B',kind:'school',active:true},{id:'f',name:'ARF',kind:'foundation',active:true},{id:'z',name:'Inactive',kind:'school',active:false}];
 const make=(school_id,platform,status,actual_date)=>({school_id,platform,status,actual_date,planned_date:'2026-10-01'});
 const records=[make('a','Instagram','Verified','2026-11-23'),make('a','Instagram','Verified','2026-11-29'),make('a','TikTok','Submitted','2026-11-26'),make('a','TikTok','Verified','2026-11-30'),make('b','TikTok','Verified','2026-11-27'),make('f','Instagram','Verified','2026-11-27')];
 const out=schoolPerformance(schools,records,'2026-11-27');
 assert.deepEqual(out.map(x=>[x.id,x.ig,x.tt,x.score,x.pending]),[['a',2,0,50,1],['b',0,1,25,0]]);
});
test('canonical publication URLs and hostile domains',()=>{
 assert.equal(validPost('Instagram','https://www.instagram.com/reel/Abc_123/?igsh=x'),true);
 assert.equal(validPost('TikTok','https://www.tiktok.com/@school/video/123456'),true);
 assert.equal(validPost('TikTok','https://www.tiktok.com/@school/photo/123456'),true);
 for(const url of ['https://instagram.com.evil.com/p/a','https://www.instagram.com/stories/foo/123','javascript:alert(1)','http://instagram.com/p/a','https://user@instagram.com/p/a','https://instagram.com:999/p/a'])assert.equal(validPost('Instagram',url),false);
 assert.equal(validPost('TikTok','https://www.instagram.com/reel/a'),false);
});
test('CSV formula injection escaped',()=>{
 assert.equal(csvCell('=SUM(1,2)'),"\"'=SUM(1,2)\"");
 assert.equal(csvCell('a,"b"'),'"a,""b"""');
});