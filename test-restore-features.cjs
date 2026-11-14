'use strict';
const assert=require('node:assert/strict');const {Collection,ChannelType,PermissionsBitField}=require('discord.js');
const {restoreAccess}=require('./restore-access');const {validDisabled,isDisabled,COMMANDS}=require('./features');const F=PermissionsBitField.Flags;
const everyone='100000000000000002',bot='100000000000000003',owner='100000000000000004';
function ow(id,allow=[],deny=[]){return {id,allow:new PermissionsBitField(allow),deny:new PermissionsBitField(deny)}}
let writes=[];
function chan(id,name,type,parentId,privateChannel=false){const cache=new Collection();if(privateChannel)cache.set(everyone,ow(everyone,[],[F.ViewChannel]));const c={id,name,type,parentId,permissionOverwrites:{cache,edit:async(id,values)=>{writes.push([name,id,values]);cache.set(id,ow(id,Object.entries(values).filter(x=>x[1]).map(x=>F[x[0]])));}}};return c;}
(async()=>{
 const cat=chan('cat','🔐 KELOLA KOMUNITAS',ChannelType.GuildCategory,null,true),member=chan('mem','kelola-member',ChannelType.GuildText,'cat',true),welcome=chan('wel','kelola-embed-welcome-member',ChannelType.GuildText,'cat',true),disk=chan('disk','diskusi',ChannelType.GuildText,'else');
 const back=chan('bak','🗄️ BACKUP',ChannelType.GuildCategory,null,true),history=chan('hist','riwayat-chat',ChannelType.GuildText,'bak',true),other=chan('other','private-client-data',ChannelType.GuildText,'else',true);
 const ch=new Collection([cat,member,welcome,disk,back,history,other].map(c=>[c.id,c]));const roles=new Collection([[owner,{id:owner,name:'Owner'}]]);const guild={id:everyone,channels:{fetch:async()=>ch},roles:{fetch:async()=>roles}};const client={user:{id:bot}};
 let r=await restoreAccess(guild,client,{wait:async()=>{}});assert.equal(r.updated,6);assert(!writes.some(x=>x[0]==='private-client-data'));assert(writes.every(x=>x[1]===bot));writes=[];r=await restoreAccess(guild,client,{wait:async()=>{}});assert.equal(r.updated,0);
 disk.permissionOverwrites.cache.set(bot,ow(bot,[],[F.SendMessages]));r=await restoreAccess(guild,client,{wait:async()=>{}});assert(r.skipped.some(x=>x.includes('diskusi')));assert(!writes.some(x=>x[0]==='diskusi'));
 member.permissionOverwrites.cache.set('stranger',ow('stranger',[F.ViewChannel]));member.permissionOverwrites.cache.delete(bot);r=await restoreAccess(guild,client,{wait:async()=>{}});assert(r.skipped.some(x=>x.includes('tidak privat')));assert(!writes.some(x=>x[0]==='kelola-member'));
 assert(validDisabled(['hapus-pesan','onboarding-member']));assert(!validDisabled(['hapus-pesan','hapus-pesan']));assert(!validDisabled(['not-real']));assert(!isDisabled({},'hapus-pesan'));assert(isDisabled({disabledCommands:['hapus-pesan']},'hapus-pesan'));assert(!isDisabled({disabledCommands:['hapus-pesan']},'setup-server'));assert.equal(COMMANDS.length,6);
 const index=require('node:fs').readFileSync('index.js','utf8');assert(index.indexOf('isDisabled(state.get')<index.indexOf("i.commandName==='onboarding-member'"));
 console.log('LULUS: pemulihan selektif, ulang idempotent, deny/privasi, sakelar perintah.');
})().catch(e=>{console.error(e);process.exitCode=1});
