'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {Collection}=require('discord.js'),state=require('./state'),auth=require('./web-auth');
process.env.DISCORD_CLIENT_ID='100000000000000001';process.env.DISCORD_CLIENT_SECRET='test-secret';process.env.DASHBOARD_URL='https://dashboard.example';process.env.PORT='0';
const appId=process.env.DISCORD_CLIENT_ID,owner='100000000000000004',buyer='100000000000000005',g1='100000000000000002',g2='100000000000000011';
let remoteUser=owner,app={id:appId,owner:{id:owner},team:null},appFails=false,scope='identify';
const client={user:{id:appId},rest:{get:async()=>{if(appFails)throw Error('API unavailable');return app;}},isReady:()=>true,guilds:{cache:new Collection([[g1,{id:g1,name:'Server satu'}],[g2,{id:g2,name:'Server lain'}]])}};
const db=new Map();state.get=id=>db.get(id);state.activate=async id=>db.set(id,{guildId:id,enabled:true});state.deactivate=async id=>db.delete(id);let registrations=[];
const realFetch=global.fetch;global.fetch=async(url)=>{if(String(url).endsWith('/oauth2/token'))return {ok:true,json:async()=>({access_token:'TEST_BEARER',expires_in:3600,scope})};if(String(url).endsWith('/users/@me'))return {ok:true,json:async()=>({id:remoteUser,username:'Akun'})};throw Error('unexpected fetch');};
function req(port,method,path,headers={},data){return new Promise((resolve,reject)=>{const x=http.request({port,host:'127.0.0.1',method,path,headers},r=>{let body='';r.on('data',c=>body+=c);r.on('end',()=>resolve({status:r.statusCode,headers:r.headers,body}));});x.on('error',reject);if(data)x.write(data);x.end();});}
async function login(port,path='/auth/discord'){let r=await req(port,'GET',path);assert.equal(r.status,302);const u=new URL(r.headers.location),nonce=u.searchParams.get('state'),cookie=r.headers['set-cookie'][0].split(';')[0];scope=u.searchParams.get('scope');return req(port,'GET','/auth/callback?code=x&state='+nonce,{cookie});}
async function run(){let srv=auth.start(client,async id=>{registrations.push(id);return {errors:[]}});await new Promise(r=>srv.once('listening',r));let port=srv.address().port;
try{
 assert.equal((await req(port,'GET','/api/me')).status,401);
 remoteUser=buyer;let r=await login(port);assert.equal(r.status,403);assert(!r.headers['set-cookie']);
 process.env.DASHBOARD_ADMIN_ID=buyer;r=await login(port);assert.equal(r.status,403); // legacy env cannot grant access
 remoteUser=owner;r=await login(port);assert.equal(r.status,302);const sid=r.headers['set-cookie'][0].split(';')[0];r=await req(port,'GET','/api/me',{cookie:sid});assert.equal(r.status,200);assert(!r.body.includes('TEST_BEARER'));const data=JSON.parse(r.body);assert.equal(data.guilds.length,2);assert.equal(data.platformAdmin,true);assert(data.inviteUrl.includes('applications.commands'));
 r=await req(port,'POST','/api/activate',{cookie:sid,origin:'https://evil.example','x-csrf-token':data.csrf},JSON.stringify({guildId:g2}));assert.equal(r.status,403);
 const hdr={cookie:sid,origin:'https://dashboard.example','x-csrf-token':data.csrf};r=await req(port,'POST','/api/activate',hdr,JSON.stringify({guildId:g2}));assert.equal(r.status,200);assert(db.has(g2));
 r=await req(port,'POST','/api/activate',hdr,JSON.stringify({guildId:'100000000000000099'}));assert.equal(r.status,404);
 r=await req(port,'POST','/api/deactivate',hdr,JSON.stringify({guildId:g2}));assert.equal(r.status,200);assert(!db.has(g2));
 remoteUser=buyer;r=await login(port,'/auth/permissions');assert.equal(r.status,200);assert(!r.headers['set-cookie']);assert.equal(auth.tokenFor(buyer),'TEST_BEARER');assert.equal((await req(port,'GET','/api/me')).status,401);assert.equal(auth.tokenFor(owner),undefined);
 r=await req(port,'POST','/api/logout',hdr);assert.equal(r.status,200);assert.equal((await req(port,'GET','/api/me',{cookie:sid})).status,401);
 }finally{await new Promise(r=>srv.close(r));}
 // Start resets owner cache; team owner, not personal owner/ordinary team members, is authorized.
 app={id:appId,owner:{id:owner},team:{owner_user_id:buyer}};srv=auth.start(client,async()=>({errors:[]}));await new Promise(r=>srv.once('listening',r));port=srv.address().port;
 try{remoteUser=owner;assert.equal((await login(port)).status,403);remoteUser=buyer;assert.equal((await login(port)).status,302);}finally{await new Promise(r=>srv.close(r));}
 appFails=true;srv=auth.start(client,async()=>({errors:[]}));await new Promise(r=>srv.once('listening',r));port=srv.address().port;try{remoteUser=owner;assert.equal((await login(port)).status,500);}finally{await new Promise(r=>srv.close(r));global.fetch=realFetch;}
 console.log('LULUS: pemilik aplikasi/tim, tolak akun lain, izin terpisah, CSRF, aktivasi, API gagal tertutup.');
}
run().catch(e=>{console.error(e);process.exitCode=1});
