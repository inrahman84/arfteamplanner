// WorkFlow Planner username sign-in.
// Server-only credential resolves username -> email, then password is checked by Supabase Auth.
// Never log or return stored email addresses or secret keys.
const ALLOWED_ORIGINS = new Set([
  'https://arfteamplanner.vercel.app',
  'http://localhost:3000',
]);
const SITE_ORIGIN = 'https://arfteamplanner.vercel.app';
const json = (value: unknown, status: number, origin: string) => new Response(JSON.stringify(value), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Vary': 'Origin',
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  },
});
Deno.serve(async req => {
  const sentOrigin = req.headers.get('Origin');
  const origin = sentOrigin && ALLOWED_ORIGINS.has(sentOrigin) ? sentOrigin : SITE_ORIGIN;
  if (sentOrigin && !ALLOWED_ORIGINS.has(sentOrigin)) return json({message:'Origin not allowed'},403,origin);
  if (req.method === 'OPTIONS') return new Response(null, {status:204,headers:{
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods':'POST, OPTIONS',
    'Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age':'600','Vary':'Origin'
  }});
  if (req.method !== 'POST') return json({message:'Method not allowed'},405,origin);
  if (Number(req.headers.get('content-length') || 0) > 8192) return json({message:'Invalid request'},400,origin);

  let form: {username?:unknown,password?:unknown};
  try { form = await req.json(); } catch { return json({message:'Invalid request'},400,origin); }
  const username = String(form?.username ?? '').trim().toLowerCase();
  const password = form?.password;
  if (!/^[a-z][a-z0-9_]{2,29}$/.test(username) || typeof password !== 'string' || password.length < 1 || password.length > 1024)
    return json({message:'Username atau password tidak valid'},400,origin);

  const url = (Deno.env.get('SUPABASE_URL') || '').replace(/\/$/,'');
  let adminKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  let publicKey = Deno.env.get('SUPABASE_ANON_KEY') || '';
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (typeof keys.default === 'string' && keys.default) adminKey = keys.default;
  } catch { /* use fallback */ }
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}');
    if (typeof keys.default === 'string' && keys.default) publicKey = keys.default;
  } catch { /* use fallback */ }
  if (!url || !adminKey || !publicKey) return json({message:'Server belum siap'},503,origin);
  try {
    const query = new URL(url+'/rest/v1/profiles');
    query.searchParams.set('select','email');
    query.searchParams.set('username','eq.'+username);
    query.searchParams.set('limit','1');
    const authHeaders: Record<string,string> = {'apikey':adminKey};
    if (!adminKey.startsWith('sb_secret_')) authHeaders.Authorization = 'Bearer '+adminKey;
    const lookup = await fetch(query,{headers:authHeaders,signal:AbortSignal.timeout(7000)});
    if (!lookup.ok) throw new Error('Profile lookup failed');
    const items = await lookup.json();
    const email = Array.isArray(items) && items[0]?.email;
    if (typeof email !== 'string') return json({message:'Username atau password salah'},401,origin);

    const login = await fetch(url+'/auth/v1/token?grant_type=password',{
      method:'POST',
      headers:{'apikey':publicKey,'Content-Type':'application/json'},
      body:JSON.stringify({email,password}),
      signal:AbortSignal.timeout(9000)
    });
    if (!login.ok) return json({message:'Username atau password salah'},401,origin);
    return json(await login.json(),200,origin);
  } catch (error) {
    console.error('Username sign-in failed:',error instanceof Error ? error.message : 'unknown');
    return json({message:'Login gagal, silakan coba lagi'},500,origin);
  }
});
