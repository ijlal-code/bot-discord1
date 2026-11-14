'use strict';
const assert=require('node:assert/strict');const {Collection,ChannelType}=require('discord.js');const {setup}=require('./safe-setup');const state=require('./state');const {activateGuild}=require('./auto-activate');
(async()=>{
 const records=new Map();state.exists=async id=>records.has(id);state.activate=async id=>records.set(id,{enabled:true});let registrations=0;const register=async()=>{registrations++;return {errors:[]}};const g={id:'100000000000000002'};
 assert.equal((await activateGuild(g,register,{onlyNew:true})).status,'active');assert.equal(registrations,1);records.set(g.id,{enabled:false});assert.equal((await activateGuild(g,register,{onlyNew:true})).status,'existing');assert.equal(registrations,1);assert.equal((await activateGuild(g,register)).status,'active');assert.equal(registrations,2);await assert.rejects(()=>activateGuild({id:'another'},async()=>({errors:['test']})),/slash gagal/);assert(!records.has('another'));
 const roles=new Collection(),channels=new Collection(),guildId='100000000000000002';let sequence=100,assign=0,setupCalls=0;const userRoles=new Collection();
 const everyone={id:guildId,name:'@everyone'};roles.set(everyone.id,everyone);
 const existing={id:'existing-general',name:'general',type:ChannelType.GuildText};channels.set(existing.id,existing);
 const guild={id:guildId,name:'Tes',iconURL:()=>null,roles:{everyone,cache:roles,fetch:async()=>roles,create:async data=>{assert.deepEqual(data.permissions,[]);const r={id:String(sequence++),name:data.name};roles.set(r.id,r);return r;}},channels:{cache:channels,fetch:async()=>channels,create:async data=>{const c={id:String(sequence++),...data,send:async()=>{},messages:{fetch:async()=>new Collection([['panel',{author:{id:'bot'},components:[{components:[{customId:'select_role:status:Umum'}]}]}]])},parentId:data.parent};channels.set(c.id,c);return c;}},fetchOwner:async()=>({roles:{cache:userRoles,add:async r=>{assign++;userRoles.set(r.id,r)}}})};
 const client={user:{id:'bot'}};const setupCommunity=async()=>{setupCalls++;return {}};
 let r=await setup(guild,client,setupCommunity);assert.deepEqual(r.createdRoles,['Owner','Admin','Pekerja','Pelajar','Umum']);assert(r.createdChannels.includes('diskusi'));assert.equal(assign,1);assert.equal(setupCalls,1);assert(channels.has(existing.id));assert.equal(r.warnings.length,0);
 r=await setup(guild,client,setupCommunity);assert.equal(r.createdRoles.length,0);assert.equal(r.createdChannels.length,0);assert.equal(assign,1);assert.equal(setupCalls,2);assert(channels.has(existing.id));
 const duplicate={id:'duplicate',name:'Owner'};roles.set(duplicate.id,duplicate);await assert.rejects(()=>setup(guild,client,setupCommunity),/duplikat/);assert.equal(setupCalls,2);roles.delete(duplicate.id);
 userRoles.clear();guild.fetchOwner=async()=>({roles:{cache:userRoles,add:async()=>{throw Error('Missing Permissions')}}});r=await setup(guild,client,setupCommunity);assert(r.warnings.some(x=>x.includes('tidak dapat diberikan')));
 console.log('LULUS: aktivasi undangan, restart, setup non-destruktif, role owner, gagal izin dan idempotensi (simulasi).');
})().catch(e=>{console.error(e);process.exitCode=1});
