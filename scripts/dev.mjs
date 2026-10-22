import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import loginHandler from '../api/username-login.js';
import { loadLocalEnv } from './env.mjs';
const root = resolve(import.meta.dirname, '..');
await loadLocalEnv(root);
const useDist=process.argv.includes('--dist');
const dir=resolve(root,useDist?'dist':'public');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const port=Number(process.env.PORT||3000);
const server=createServer(async(req,res)=>{
 try {
  let name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  if(name==='/api/username-login'){
   let bytes='';for await(const chunk of req){bytes+=chunk;if(bytes.length>4096)break;}
   let body;try{body=JSON.parse(bytes)}catch{body={}}
   const response={setHeader(k,v){res.setHeader(k,v);},status(code){res.statusCode=code;return this;},json(value){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(value));return this;}};
   await loginHandler({method:req.method,body},response);return;
  }
  if(name==='/' || name==='/app') name='/index.html';
  const path=resolve(dir,'.'+name);
  if(path!==dir && !path.startsWith(dir+sep)) {res.writeHead(403);res.end('Forbidden');return;}
  if(!useDist && name==='/config.js') {
   let cfg={supabaseUrl:process.env.SUPABASE_URL||'',supabaseAnonKey:process.env.SUPABASE_ANON_KEY||''};
   res.writeHead(200,{'Content-Type':mime['.js'],'Cache-Control':'no-store'});
   res.end('window.__WORKFLOW_CONFIG__ = '+JSON.stringify(cfg)+';');return;
  }
  const file=await stat(path);if(!file.isFile())throw Error('Not a file');
  const bytes=await readFile(path);
  res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-cache'});res.end(bytes);
 }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(port,()=>console.log(`WorkFlow Planner: http://localhost:${port} (${useDist?'dist':'dev'})`));
