import test from 'node:test';
import assert from 'node:assert/strict';
import {createMediaDemoStore,resetMediaDemo} from '../public/media-demo.js';
import {jakartaDate} from '../public/media-core.js';

test('official ARF coordinator can create ARF content with PIC, not school content',async()=>{
 resetMediaDemo();
 const store=createMediaDemoStore('demo-central');
 const p={school_id:'arf',title:'Official test',pic_name:'Pelaksana ARF',platform:'Instagram',format:'Reels',planned_date:jakartaDate(),status:'Planned'};
 const [row]=await store.rest('media_contents','POST','',p);
 assert.equal(row.pic_name,'Pelaksana ARF');
 await assert.rejects(store.rest('media_contents','POST','',{...p,school_id:'school-a'}));
 await assert.rejects(store.rest('media_contents','POST','',{...p,pic_name:' '}));
 const [saved]=await store.rest('media_contents','GET','?id=eq.'+row.id);
 assert.equal(saved.pic_name,'Pelaksana ARF');
});

test('central coordinator reviews school evidence; Manager reviews official ARF',async()=>{
 resetMediaDemo();
 const central=createMediaDemoStore('demo-central'),manager=createMediaDemoStore('demo-manager'),school=createMediaDemoStore('demo-school-a');
 await assert.rejects(central.rest('media_contents','PATCH','?id=eq.demo-content-4',{pic_name:'Changed'}));
 const [verified]=await central.rest('media_contents','PATCH','?id=eq.demo-content-4',{status:'Verified',feedback:''});
 assert.equal(verified.status,'Verified');
 await assert.rejects(central.rest('media_contents','PATCH','?id=eq.demo-content-12',{status:'Verified',feedback:''}));
 const [official]=await manager.rest('media_contents','PATCH','?id=eq.demo-content-12',{status:'Verified',feedback:''});
 assert.equal(official.status,'Verified');
 assert.ok((await school.rest('media_contents')).every(r=>r.school_id==='school-a'));
 await assert.rejects(school.rest('media_contents','PATCH','?id=eq.demo-content-12',{status:'Verified'}));
});
