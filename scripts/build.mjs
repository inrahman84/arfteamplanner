import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { loadLocalEnv } from './env.mjs';
const root = resolve(import.meta.dirname, '..');
await loadLocalEnv(root);
const dest = resolve(root, 'dist');
await rm(dest, { recursive:true, force:true });
await mkdir(dest, { recursive:true });
await cp(resolve(root,'public'), dest, { recursive:true });
const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
const key = (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();
if (key.startsWith('sb_secret_')) throw new Error('Secret key cannot be embedded in the public app. Use a publishable/anon key.');
if ((url && !key) || (!url && key)) {
  console.warn('WARNING: SUPABASE_URL plus a publishable/anon key are required; building demo-only mode.');
}
if (url && !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/i.test(url)) {
  throw new Error('SUPABASE_URL must be a valid https://<project>.supabase.co URL');
}
await writeFile(resolve(dest,'config.js'), 'window.__WORKFLOW_CONFIG__ = ' + JSON.stringify({ supabaseUrl:url && key ? url.replace(/\/$/,'') : '', supabaseAnonKey:url && key ? key : '' }) + ';\n');
console.log(`Built static app at ${dest} (${url && key ? 'Supabase' : 'demo'} mode)`);
