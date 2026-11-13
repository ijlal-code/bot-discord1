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
 let i=interaction('community:member-edit');await handleCommunityInteraction(i,client,guild.id);assert.equal(i.output.components[0].toJSON().components[0].type,5);
 i=interaction('community:member-edit','button',{member:{roles:{cache:new Collection()}}});await handleCommunityInteraction(i,client,guild.id);assert.match(i.output.content,/Hanya/);
 i=interaction('community:member-select','user',{values:[target.id]});await handleCommunityInteraction(i,client,guild.id);assert.match(i.modal.components[0].components[0].value,/Panduan Memulai/);
 i=interaction(`community:member-save:${target.id}`,'modal',{fields:{getTextInputValue:()=> 'Profil publik {username}, role {role}.'}});await handleCommunityInteraction(i,client,guild.id);assert.match(i.output,/disimpan/);
 assert.equal(await manager.memberBody(guild,client,target.id),'Profil publik {username}, role {role}.');
 let payload=await welcome.buildMemberOnboarding(guild,client,target,'Pekerja');assert.match(payload.embeds[0].toJSON().description,/Profil publik Rina, role Pekerja/);
 const deps={isOwner,statusRoles:['Pekerja','Pelajar','Umum'],buildMemberOnboarding:welcome.buildMemberOnboarding};
 let c=cmd({invokerHasRole:false});await manager.handleMemberCommand(c,client,guild.id,deps);assert.match(c.output.content,/pilih role/);assert.equal(dc.sent.length,0);
 c=cmd({ch:wc});await manager.handleMemberCommand(c,client,guild.id,deps);assert.match(c.output.content,/#diskusi/);
 c=cmd({targetId:'100000000000000009'});await manager.handleMemberCommand(c,client,guild.id,deps);assert.match(c.output,/tidak ditemukan/);assert.equal(dc.sent.length,0);
 c=cmd();await manager.handleMemberCommand(c,client,guild.id,deps);assert.equal(dc.sent.length,1);assert.match(dc.sent[0].embeds[0].description,/Profil publik Rina/);assert.match(c.output,/ditampilkan/);
 // Edit member mengubah pesan onboarding terakhir yang diterbitkan bot.
 i=interaction(`community:member-save:${target.id}`,'modal',{fields:{getTextInputValue:()=> 'Profil diperbarui untuk {username}.'}});await handleCommunityInteraction(i,client,guild.id);
 assert.match(i.output,/diperbarui/);assert.match(dc.sent[0].embeds[0].description,/Profil diperbarui untuk Rina/);
 // Data tetap terbaca setelah cache dibuang (restart bot).
 delete require.cache[require.resolve('./member-management')];manager=require('./member-management');assert.equal(await manager.memberBody(guild,client,target.id),'Profil diperbarui untuk {username}.');
 // Pesan lama bot dapat ditemukan lewat User ID di footer, tanpa mengubah member lain.
 const legacy={...target,id:'100000000000000010',user:{...target.user,id:'100000000000000010',username:'Lama'}};
 guild.members.fetch=async id=>id===target.id?target:id===legacy.id?legacy:null;
 const {EmbedBuilder}=require('discord.js');
 const old=await dc.send({embeds:[new EmbedBuilder().setAuthor({name:'AINUN IJLAL STUDIO • MEMBER ONBOARDING'}).setTitle('Lama').setDescription('Teks lama').setFooter({text:`Ainun Ijlal Studio Community • User ID: ${legacy.id}`})]});
 i=interaction(`community:member-save:${legacy.id}`,'modal',{fields:{getTextInputValue:()=> 'Diperbarui untuk {username}'}});await handleCommunityInteraction(i,client,guild.id);
 assert.match(i.output,/diperbarui/);assert.equal(old.embeds[0].description,'Diperbarui untuk Lama');assert.match(dc.sent[0].embeds[0].description,/Profil diperbarui untuk Rina/);
 // Tolak menyimpan pada channel yang tidak lagi privat.
 mc.permissionOverwrites.cache.set('bad',{id:'bad',deny:new PermissionsBitField(),allow:new PermissionsBitField(PermissionsBitField.Flags.ViewChannel)});
 i=interaction(`community:member-save:${target.id}`,'modal',{fields:{getTextInputValue:()=> 'Jangan simpan'}});await assert.rejects(handleCommunityInteraction(i,client,guild.id),/tidak aman/);
 console.log('LULUS: pemilihan member, otorisasi Owner, simpan profil, persistensi, privasi dan slash command.');
})().catch(e=>{console.error(e);process.exitCode=1});
