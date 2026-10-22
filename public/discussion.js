import {safe} from './core.js';

// Only matching team usernames can become tagged recipients.
export function mentionCandidates(draft,caret,people) {
 const cursor=String(draft||'').slice(0,Math.max(0,Number(caret)||0));
 const match=cursor.match(/(^|\s)@([a-z0-9_]*)$/i);
 if(!match)return [];
 return people.filter(p=>p.username&&p.username.toLowerCase().startsWith(match[2].toLowerCase())).slice(0,8);
}
export function insertMention(draft,caret,username) {
 const cursor=Math.max(0,Math.min(String(draft).length,Number(caret)||0));
 const before=String(draft).slice(0,cursor);
 const match=before.match(/(^|\s)@([a-z0-9_]*)$/i);
 if(!match)return {text:draft,caret:cursor};
 const prefix=before.slice(0,before.length-match[2].length-1);
 const text=prefix+'@'+username+' '+String(draft).slice(cursor);
 return {text,caret:(prefix+'@'+username+' ').length};
}
export function mentionedUserIds(body,people) {
 const handles=new Set([...String(body||'').matchAll(/(?:^|\s)@([a-z][a-z0-9_]{2,29})(?=\s|[.,!?;:]|$)/gi)].map(x=>x[1].toLowerCase()));
 return [...new Set(people.filter(p=>handles.has(String(p.username||'').toLowerCase())).map(p=>p.id))].slice(0,30);
}
export function formattedCommentBody(body) {
 return safe(body).replace(/(^|\s)@([a-z][a-z0-9_]{2,29})/gi,(_,p,handle)=>p+'<strong class="comment-mention">@'+handle+'</strong>').replace(/\n/g,'<br>');
}
