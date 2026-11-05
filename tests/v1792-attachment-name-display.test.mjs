import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {safe,validAttachment} from '../public/core.js';

const app=readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../public/app.css',import.meta.url),'utf8');
const store=readFileSync(new URL('../public/store.js',import.meta.url),'utf8');
const start=app.indexOf("function attachmentRow(url='',name='',editable=true){");
const end=app.indexOf('function attachmentCanChange(',start);
assert.ok(start>0&&end>start,'Attachment markup function must exist');
const attachmentRow=new Function('safe','validAttachment','ic',app.slice(start,end)+';return attachmentRow')(safe,validAttachment,()=>'<svg aria-hidden="true"></svg>');

test('Editing a named attachment provides full URL and Name inputs without shortening values',()=>{
 const name='Pedoman Divisi Pendidikan & Kurikulum dan Standar Pembelajaran ARF 2026–2027';
 const url='https://temankitaid.sharepoint.com/sites/ARF/Shared%20Documents/very-long-document-path?view=1';
 const html=attachmentRow(url,name,true);
 assert.match(html,/class="[^"]*attachment-edit-row/);
 assert.match(html,/data-attachment-name type="text"/);
 assert.match(html,/data-attachment-input type="url"/);
 assert.ok(html.includes('value="'+safe(name)+'"'),'Name is not truncated in editor');
 assert.ok(html.includes('value="'+safe(url)+'"'),'URL is not truncated in editor');
 assert.ok(!html.includes('Tautan tersimpan:'),'No duplicate preview in editor');
});

test('Saved attachments show complete clickable Link Name and hide input fields and URL text',()=>{
 const name='04 Divisi Layanan Bersama, Kemitraan & Pengembangan — Rencana Operasional Terpadu';
 const url='https://example.org/documents/04-division-arf-long';
 const html=attachmentRow(url,name,false);
 assert.match(html,/class="[^"]*attachment-saved-row/);
 assert.match(html,/class="attachment-named-link"/);
 assert.ok(html.includes('href="'+safe(url)+'"'));
 assert.match(html,/target="_blank" rel="noopener noreferrer"/);
 assert.ok(html.includes('<span class="attachment-named-link-label">'+safe(name)+'</span>'));
 assert.doesNotMatch(html,/<input\b/);
 assert.doesNotMatch(html,/Attachment Link \(HTTPS\)/);
 assert.doesNotMatch(html,/>https:\/\//);
 assert.doesNotMatch(html,/data-action="remove-attachment"/);
 const longName='Perumusan Standar Pendidikan dan Panduan Implementasi Kegiatan Pembelajaran'.repeat(2);
 assert.ok(attachmentRow(url,longName,false).includes(safe(longName)),'Long link names are never abbreviated');
});

test('Unsafe links never become clickable; HTML markup is escaped',()=>{
 const html=attachmentRow('javascript:alert(1)','<img src=x onerror=alert(1)>',false);
 assert.doesNotMatch(html,/<a\b/);
 assert.doesNotMatch(html,/<img\b/);
 assert.ok(html.includes('&lt;img'));
});

test('Existing saved links open in viewer until user explicitly edits',()=>{
 assert.match(app,/attachmentEditing:type\b|S\.attachmentEditing=type==='task'&&\(!task\?\.id\|\|!/);
 assert.match(app,/attachmentEditorVisible=attachmentEditable&&S\.attachmentEditing/);
 assert.match(app,/data-attachment-editor \$\{attachmentEditorVisible\?'':'hidden'\}/);
 assert.match(app,/data-attachment-viewer \$\{attachmentEditorVisible\?'hidden':''\}/);
 assert.match(app,/data-action="edit-attachments"/);
 assert.match(app,/case 'edit-attachments':\{/);
 assert.match(app,/S\.attachmentEditing=true/);
 assert.match(app,/if\(editor\)editor\.hidden=!editable\|\|!S\.attachmentEditing/);
 assert.match(app,/attachmentRow\(url,attachmentNames\[i\]\|\|\('Attachment '\+\(i\+1\)\),false\)/);
 assert.match(app,/case 'add-attachment'/);
 assert.match(app,/case 'remove-attachment'/);
});

test('Scoped CSS overrides former width:auto!important and displays long link text without ellipsis',()=>{
 assert.match(css,/\.attachment-link-row input\{[^}]*width:auto!important/);
 assert.match(css,/#taskForm \.attachment-edit-row \.attachment-input-stack input\[data-attachment-name\]/);
 assert.match(css,/#taskForm \.attachment-edit-row \.attachment-input-stack input\[data-attachment-input\]\{[^}]*width:100%!important/s);
 assert.match(css,/#taskForm \.attachment-edit-row \.attachment-input-stack\{[^}]*width:100%/s);
 assert.match(css,/#taskForm \.attachment-edit-row \.attachment-field-label\{[^}]*margin:0/s);
 assert.match(css,/#taskForm \.attachment-saved-row \.attachment-named-link-label\{[^}]*white-space:normal/s);
 assert.match(css,/#taskForm \.attachment-saved-row \.attachment-named-link-label\{[^}]*overflow-wrap:anywhere/s);
});

test('Saving still persists both attachment names and their URLs, with unchanged permissions',()=>{
 assert.match(app,/const entered=rows\.map\(row=>\(\{url:row\.querySelector\('\[data-attachment-input\]'\)/);
 assert.match(app,/const attachment_names=editableAttachments\?entered\.filter\(x=>x\.url\)\.map\(x=>x\.name\)/);
 assert.match(store,/task\.attachment_names=Array\.isArray\(task\.attachment_names\)/);
 assert.match(store,/Attachment hanya dapat diubah/i);
});
