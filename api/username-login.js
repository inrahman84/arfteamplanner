// Vercel Node.js Function. Never expose SUPABASE_SERVICE_ROLE_KEY in browser config.
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST'){res.setHeader('Allow','POST');return res.status(405).json({message:'Method not allowed'});}
 let body={};try{body=typeof req.body==='string'?JSON.parse(req.body||'{}'):(req.body||{});}catch{return res.status(400).json({message:'Format permintaan tidak valid'});}
 const {username,password}=body;
 if(!/^[a-z][a-z0-9_]{2,29}$/.test(String(username||'').toLowerCase()) || typeof password!=='string'||password.length>1024){return res.status(400).json({message:'Username atau password tidak valid'});}
 const url=(process.env.SUPABASE_URL||process.env.NEXT_PUBLIC_SUPABASE_URL||'').replace(/\/$/,'');
 const secret=process.env.SUPABASE_SECRET_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';
 const anon=process.env.SUPABASE_PUBLISHABLE_KEY||process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY||process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY||'';
 if(!url||!secret||!anon)return res.status(503).json({message:'Username login belum dikonfigurasi di Vercel'});
 try{
  // Resolve email entirely server-side. The unauthenticated client never receives the profile email.
  const q=new URL(url+'/rest/v1/profiles');q.searchParams.set('select','email');q.searchParams.set('username','eq.'+username.toLowerCase());q.searchParams.set('limit','1');
  const lookupHeaders=secret.startsWith('sb_secret_')?{apikey:secret}:{apikey:secret,Authorization:'Bearer '+secret};
  const lookup=await fetch(q,{headers:lookupHeaders});
  if(!lookup.ok)throw new Error('Profile lookup failed');
  const [profile]=await lookup.json();
  if(!profile?.email)return res.status(401).json({message:'Username atau password salah'});
  const signin=await fetch(url+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:anon,'Content-Type':'application/json'},body:JSON.stringify({email:profile.email,password})});
  if(!signin.ok)return res.status(401).json({message:'Username atau password salah'});
  const session=await signin.json();
  return res.status(200).json(session);
 }catch(e){console.error('Username login backend failure:',e.message);return res.status(500).json({message:'Login gagal. Coba lagi.'});}
}
