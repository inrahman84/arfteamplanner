import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
export async function loadLocalEnv(root){
  for(const filename of ['.env','.env.local']){
    let text;try{text=await readFile(resolve(root,filename),'utf8')}catch{continue}
    for(const line of text.split(/\r?\n/)){
      const match=line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if(!match)continue;
      const [,key,v]=match;
      const value=v.replace(/^(["'])(.*)\1$/,'$2');
      if(process.env[key]===undefined)process.env[key]=value;
    }
  }
}
