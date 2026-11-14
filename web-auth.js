'use strict';
const http=require('node:http');
const crypto=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {PermissionsBitField}=require('discord.js');
const state=require('./state');
const sessions=new Map(), oauthStates=new Map(), activating=new Set();
const rand=()=>crypto.randomBytes(32).toString('base64url');
let base, client, register;
function expire(){const now=Date.now();for(const [k,v] of sessions)if(v.expires<=now)sessions.delete(k);for(const [k,v] of oauthStates)if(v.expires<=now)oauthStates.delete(k);}
function cookie(req,name){const match=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='));return match?.slice(name.length+1);}
function tokenFor(userId){expire();let found;for(const s of sessions.values())if(s.user.id===userId&&(!found||s.expires>found.expires))found=s;return found?.token;}
function canManage(guild,member){const matches=guild.roles.cache.filter(r=>r.name==='Owner'&&r.id!==guild.id);if(matches.size!==1||!member.roles.cache.has(matches.first().id))return false;return guild.ownerId===member.id || member.permissions.has([PermissionsBitField.Flags.ManageGuild,PermissionsBitField.Flags.ManageRoles]);}
function headers(res,code,type='application/json'){res.writeHead(code,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"});}
function json(res,code,obj){headers(res,code);res.end(JSON.stringify(obj));}
function redirect(res,url,cookieValue){res.writeHead(302,{'Location':url,'Cache-Control':'no-store','Referrer-Policy':'no-referrer',...(cookieValue?{'Set-Cookie':cookieValue}:{})});res.end();}
function sess(req){expire();return sessions.get(cookie(req,'sid'));}
async function api(token,url){const r=await fetch('https://discord.com/api/v10'+url,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('Discord gagal memverifikasi sesi. Silakan login ulang.');return r.json();}
async function body(req){let b='';for await(const c of req){b+=c;if(b.length>4096)throw Error('Permintaan terlalu besar');}return JSON.parse(b||'{}');}
async function handler(req,res){
 try{
  const url=new URL(req.url,base);const p=url.pathname;
  if(req.method==='GET' && ['/','/app.js','/style.css'].includes(p)){const f=p==='/'?'index.html':p.slice(1);headers(res,200,f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':'text/css');return res.end(fs.readFileSync(path.join(__dirname,'public',f)));}
  if(req.method==='GET'&&p==='/health'){return json(res,200,{status:client.isReady()?'online':'starting',uptimeSeconds:Math.floor(process.uptime())});}
  if(req.method==='GET'&&p==='/auth/discord'){
   expire();if(oauthStates.size>500)return json(res,429,{error:'Terlalu banyak permintaan login.'});
   const nonce=rand();oauthStates.set(nonce,{expires:Date.now()+300000});
   const params=new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,response_type:'code',redirect_uri:base+'/auth/callback',scope:'identify guilds applications.commands.permissions.update',state:nonce});
   return redirect(res,'https://discord.com/oauth2/authorize?'+params,`oauth_state=${nonce}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=300`);
  }
  if(req.method==='GET'&&p==='/auth/callback'){
   const nonce=url.searchParams.get('state'), expected=cookie(req,'oauth_state');if(!nonce||nonce!==expected||!oauthStates.has(nonce)||oauthStates.get(nonce).expires<Date.now())return json(res,400,{error:'Login kedaluwarsa atau state tidak cocok.'});oauthStates.delete(nonce);
   const code=url.searchParams.get('code');if(!code)return json(res,400,{error:'Login dibatalkan.'});
   const r=await fetch('https://discord.com/api/v10/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:process.env.DISCORD_CLIENT_ID,client_secret:process.env.DISCORD_CLIENT_SECRET,grant_type:'authorization_code',code,redirect_uri:base+'/auth/callback'}),signal:AbortSignal.timeout(10000)});
   if(!r.ok)throw Error('Discord menolak login. Periksa konfigurasi OAuth.');const t=await r.json(); const user=await api(t.access_token,'/users/@me');
   if(!user.id||!t.scope?.split(' ').includes('applications.commands.permissions.update'))throw Error('Izin OAuth diperlukan.');
   expire();if(sessions.size>1000)throw Error('Kapasitas sesi penuh.');const sid=rand();sessions.set(sid,{user,token:t.access_token,csrf:rand(),expires:Date.now()+Math.max(0,Math.min(t.expires_in,3600)-60)*1000});
   return redirect(res,'/',`sid=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3500`);
  }
  if(req.method==='GET'&&p==='/api/me'){
   const s=sess(req);if(!s)return json(res,401,{error:'Login diperlukan.'});
   if(s.guildCache && s.guildCache.expires>Date.now())return json(res,200,{user:{name:s.user.global_name||s.user.username},csrf:s.csrf,guilds:s.guildCache.guilds});
   const list=await api(s.token,'/users/@me/guilds');let guilds=[];
   for(const g of list.slice(0,50)){const botGuild=client.guilds.cache.get(g.id);if(!botGuild)continue;try{await botGuild.roles.fetch();const member=await botGuild.members.fetch({user:s.user.id,force:true});if(canManage(botGuild,member))guilds.push({id:g.id,name:g.name,active:!!state.get(g.id)});}catch{}}
   s.guildCache={guilds,expires:Date.now()+30000};return json(res,200,{user:{name:s.user.global_name||s.user.username},csrf:s.csrf,guilds});
  }
  if(req.method==='POST'&&(p==='/api/activate'||p==='/api/deactivate')){
   const s=sess(req);if(!s)return json(res,401,{error:'Login diperlukan.'});
   if(req.headers.origin!==base||req.headers['x-csrf-token']!==s.csrf)return json(res,403,{error:'Permintaan ditolak.'});
   const now=Date.now();s.operations=(s.operations||[]).filter(t=>now-t<60000);if(s.operations.length>=5)return json(res,429,{error:'Terlalu banyak permintaan. Coba lagi nanti.'});s.operations.push(now);
   const {guildId}=await body(req);if(typeof guildId!=='string'||!/^\d{15,22}$/.test(guildId))return json(res,400,{error:'ID server tidak valid.'});
   const guild=client.guilds.cache.get(guildId);if(!guild)return json(res,404,{error:'Bot belum ada di server ini.'});await guild.roles.fetch();const member=await guild.members.fetch({user:s.user.id,force:true});if(!canManage(guild,member))return json(res,403,{error:'Anda perlu role Owner dan izin mengelola server serta role.'});
   if(activating.has(guildId))return json(res,429,{error:'Pengaturan server sedang diproses.'});activating.add(guildId);try{if(p==='/api/deactivate'){if(!state.get(guildId))return json(res,404,{error:'Server belum aktif.'});await state.deactivate(guildId);s.guildCache=null;return json(res,200,{ok:true});}const result=await register(guildId);if(result.errors.length)return json(res,502,{error:'Registrasi command gagal; periksa log Render.'});await state.activate(guildId);s.guildCache=null;return json(res,200,{ok:true});}finally{activating.delete(guildId);}
  }
  if(req.method==='POST'&&p==='/api/logout'){const s=sess(req);if(!s||req.headers.origin!==base||req.headers['x-csrf-token']!==s.csrf)return json(res,403,{error:'Permintaan ditolak.'});sessions.delete(cookie(req,'sid'));return json(res,200,{ok:true});}
  json(res,404,{error:'Tidak ditemukan.'});
 }catch(e){console.error('[WEB]',e.message);if(!res.headersSent)json(res,500,{error:'Proses gagal. Periksa konfigurasi atau coba login ulang.'});else res.end();}
}
function start(discordClient,registerFn){
 client=discordClient;register=registerFn;
 if(!process.env.DISCORD_CLIENT_ID||!process.env.DISCORD_CLIENT_SECRET||!process.env.DASHBOARD_URL)throw Error('DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, dan DASHBOARD_URL wajib diatur.');
 const u=new URL(process.env.DASHBOARD_URL);if(u.protocol!=='https:'||u.pathname!=='/'||u.search||u.hash||u.username||u.password)throw Error('DASHBOARD_URL harus origin HTTPS tanpa path.');base=u.origin;
 if(client.user.id!==process.env.DISCORD_CLIENT_ID)throw Error('DISCORD_CLIENT_ID tidak cocok dengan bot token.');
 return http.createServer(handler).listen(process.env.PORT||3000,()=>console.log('[WEB] Dashboard aktif.'));
}
module.exports={start,tokenFor,canManage};
