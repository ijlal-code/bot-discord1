const assert=require('node:assert/strict');
const {Collection,ChannelType,PermissionsBitField} = require('discord.js');
let manager=require('./member-management');let welcome=require('./welcome');const {handleCommunityInteraction,isOwner}=require('./community');
const client={user:{id:'100000000000000004'}};const owner={id:'100000000000000002',name:'Owner'},status={id:'100000000000000003',name:'Pekerja'};
const guild={id:'100000000000000001',name:'Komunitas',memberCount:6,iconURL:()=>null,roles:{cache:new Collection([[owner.id,owner],[status.id,status]])}};
const channels=new Collection();guild.channels={cache:channels,fetch:async()=>channels};let seq=1000;
function channel(id,name,type,parentId,privateChannel=false){
 const sent=[];const pc=new Collection();if(privateChannel)pc.set(guild.id,{id:guild.id,deny:new PermissionsBitField(PermissionsBitField.Flags.ViewChannel),allow:new PermissionsBitField()});
 const c={id,name,type,parentId,get parent(){return channels.get(parentId)},permissionOverwrites:{cache:pc},sent,messages:{async fetch(opts){if(opts.message)return sent.find(m=>m.id===opts.message)||null;let a=[...sent].reverse();if(opts.before){const n=a.findIndex(m=>m.id===opts.before);a=n<0?[]:a.slice(n+1)}return new Collection(a.slice(0,opts.limit).map(m=>[m.id,m]))}},
 async send(payload){for(const e of payload.embeds||[])e.toJSON();for(const r of payload.components||[])r.toJSON();const m={id:String(++seq),channelId:id,author:client.user,embeds:(payload.embeds||[]).map(x=>x.toJSON()),payload,async edit(p){this.embeds=p.embeds.map(x=>x.toJSON());return this}};sent.push(m);return m;}};channels.set(id,c);return c;
}
const category=channel('301','🔐 KELOLA KOMUNITAS',ChannelType.GuildCategory);const mc=channel('302','kelola-member',ChannelType.GuildText,category.id,true);
const wc=channel('303','kelola-embed-welcome-member',ChannelType.GuildText,category.id,true);const dc=channel('304','diskusi',ChannelType.GuildText);channel('305','rules-and-role',ChannelType.GuildText);
const target={id:'100000000000000005',guild,user:{id:'100000000000000005',username:'Rina',tag:'rina',bot:false,createdTimestamp:1700000000000},roles:{cache:new Collection([[status.id,status]])}};
guild.members={fetch:async id=>id===target.id?target:null};
function interaction(id,type='button',extra={}){return {customId:id,guild,guildId:guild.id,channel:mc,user:{id:'100000000000000006'},member:{roles:{cache:new Collection([[owner.id,owner]])}},values:[],isButton:()=>type==='button',isUserSelectMenu:()=>type==='user',isModalSubmit:()=>type==='modal',isChannelSelectMenu:()=>false,async showModal(m){this.modal=m.toJSON()},async reply(p){this.replied=true;this.output=p},async deferReply(){this.deferred=true},async editReply(p){this.output=p},...extra}}
function cmd({invokerHasRole=true,ch=dc,targetId=target.id}={}) {return {guild,guildId:guild.id,channel:ch,member:{roles:{cache:new Collection(invokerHasRole?[[status.id,status]]:[])}},options:{getUser:()=>({id:targetId})},async reply(p){this.output=p},async deferReply(){this.deferred=true},async editReply(p){this.output=p}};}
(async()=>{
 let i=interaction('community:member-edit');await handleCommunityInteraction(i,client,guild.id);assert.equal(i.output.components.length,2);
 i=interaction('community:member-edit','button',{member:{roles:{cache:new Collection()}}});await handleCommunityInteraction(i,client,guild.id);assert.match(i.output.content,/Hanya/);
 i=interaction('community:member-select','user',{values:[target.id]});await handleCommunityInteraction(i,client,guild.id);assert.equal(i.modal.components.length,4);assert.match(i.modal.components[1].components[0].value,/Panduan Memulai/);
 const values={header:'Author khusus\nJudul {username}',body:'Profil publik {username}, role {role}.',details:'Nama | {tag}\n-\n-',footer:'TIDAK\nFooter khusus {id}'};
 const save=()=>interaction(`community:member-save:${target.id}`,'modal',{fields:{getTextInputValue:k=>values[k]}});
 i=save();await handleCommunityInteraction(i,client,guild.id);assert.match(i.output,/disimpan/);
 assert.equal(await manager.memberBody(guild,client,target.id),'Profil publik {username}, role {role}.');
 let payload=await welcome.buildMemberOnboarding(guild,client,target,'Pekerja');let emb=payload.embeds[0].toJSON();assert.match(emb.description,/Profil publik Rina, role Pekerja/);assert.equal(emb.author.name,'Author khusus');assert.equal(emb.title,'Judul Rina');assert.equal(emb.fields.length,1);assert.match(emb.footer.text,/Footer khusus/);assert.equal(emb.timestamp,undefined);
 const deps={isOwner,statusRoles:['Pekerja','Pelajar','Umum'],buildMemberOnboarding:welcome.buildMemberOnboarding};
 let c=cmd({invokerHasRole:false});await manager.handleMemberCommand(c,client,guild.id,deps);assert.match(c.output.content,/pilih role/);
 c=cmd();await manager.handleMemberCommand(c,client,guild.id,deps);assert.equal(dc.sent.length,1);
 values.body='Profil diperbarui untuk {username}.';values.footer='YA\nFooter baru';i=save();await handleCommunityInteraction(i,client,guild.id);assert.match(i.output,/diperbarui/);assert.match(dc.sent[0].embeds[0].description,/Profil diperbarui untuk Rina/);assert.equal(dc.sent[0].embeds[0].footer.text,'Footer baru');assert(dc.sent[0].embeds[0].timestamp);
 delete require.cache[require.resolve('./member-management')];manager=require('./member-management');assert.equal(await manager.memberBody(guild,client,target.id),'Profil diperbarui untuk {username}.');assert.equal((await manager.memberProfile(guild,client,target.id)).parts.footer,'Footer baru');
 mc.permissionOverwrites.cache.set('bad',{id:'bad',deny:new PermissionsBitField(),allow:new PermissionsBitField(PermissionsBitField.Flags.ViewChannel)});i=save();await assert.rejects(handleCommunityInteraction(i,client,guild.id),/tidak aman/);
 console.log('LULUS: member, semua bagian, simpan, privasi, slash dan edit pesan terakhir.');
})().catch(e=>{console.error(e);process.exitCode=1});
