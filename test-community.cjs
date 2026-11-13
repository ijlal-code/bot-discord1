const assert = require('node:assert/strict');
const { Collection, ChannelType, PermissionsBitField, SystemChannelFlagsBitField } = require('discord.js');
const {setupCommunity,handleCommunityInteraction} = require('./community');
let seq=100000000000000001n;
const channels=new Collection();
const owner={id:'100000000000000002',name:'Owner'}, worker={id:'100000000000000003',name:'Pekerja'};
const roles=new Collection([[owner.id,owner],[worker.id,worker]]);
const client={user:{id:'100000000000000004'}};
const guild={id:'100000000000000001',systemChannelFlags:new SystemChannelFlagsBitField(0),async edit(o){this.systemChannelFlags=o.systemChannelFlags},roles:{cache:roles,fetch:async()=>roles},channels:{cache:channels,fetch:async id=>id?channels.get(id):channels}};
function channel(name,type=0,parentId=null,overwrites=[]) {
 const id=String(seq++ + 100n);
 const c={id,name,type,parentId,get parent(){return channels.get(this.parentId)},permissionOverwrites:{cache:new Collection(),async set(perms){setPerms(c,perms)}},messages:{cache:new Collection(), async fetch(){return this.cache}},sent:[],async send(payload){for(const e of payload.embeds||[])e.toJSON();for(const r of payload.components||[])r.toJSON();this.sent.push(payload);const m={author:{id:client.user.id},components:(payload.components||[]).map(x=>({components:x.toJSON().components.map(c=>({customId:c.custom_id}))}))};this.messages.cache.set(String(this.sent.length),m);return m;},async setName(n){this.name=n},async delete(){channels.delete(this.id)}};
 setPerms(c,overwrites);channels.set(id,c);return c;
}
function setPerms(c,ps){c.permissionOverwrites.cache.clear();for(const p of ps)c.permissionOverwrites.cache.set(p.id,{id:p.id,allow:new PermissionsBitField(p.allow||[]),deny:new PermissionsBitField(p.deny||[])});}
guild.channels.create=async opt=>channel(opt.name,opt.type,opt.parent||null,opt.permissionOverwrites||[]);
const feedback=channel('feedback-and-request');
const messages=[];
function interaction(id,{channel:ch,memberRoles=[owner],type='button',values=[],fields={}}={}){
 return {customId:id,guild,guildId:guild.id,channel:ch,user:{id:'100000000000000005',tag:'test#0001'},member:{roles:{cache:new Collection(memberRoles.map(x=>[x.id,x]))}},values, fields:{getTextInputValue:k=>fields[k]},isButton:()=>type==='button',isModalSubmit:()=>type==='modal',isChannelSelectMenu:()=>type==='select',async reply(p){this.replied=true;this.output=p;messages.push(p)},async update(p){this.replied=true;this.output=p;messages.push(p)},async deferReply(){this.deferred=true},async deferUpdate(){this.deferred=true},async editReply(p){this.output=p;messages.push(p)},async showModal(m){this.modal=m.toJSON()}};
}
(async()=>{
 const installed=await setupCommunity(guild,client); assert(installed.manage && installed.inbox);
 assert(installed.inbox.permissionOverwrites.cache.get(guild.id).deny.has(PermissionsBitField.Flags.ViewChannel));
 assert(feedback.permissionOverwrites.cache.get(guild.id).deny.has(PermissionsBitField.Flags.SendMessages));
 assert(!feedback.permissionOverwrites.cache.has(worker.id));
 await setupCommunity(guild,client); assert.equal(installed.manage.sent.length,1);assert.equal(feedback.sent.length,1);
 let i=interaction('community:feedback',{channel:feedback,memberRoles:[worker]});await handleCommunityInteraction(i,client,guild.id); assert.equal(i.modal.components.length,2);
 i=interaction('community:feedback-submit',{channel:feedback,memberRoles:[worker],type:'modal',fields:{judul:'Judul',isi:'Saran'}});await handleCommunityInteraction(i,client,guild.id);assert.match(i.output,/berhasil/);assert.equal(installed.inbox.sent.length,1);
 i=interaction('community:feedback',{channel:feedback,memberRoles:[]}); await handleCommunityInteraction(i,client,guild.id); assert.match(i.output.content,/pilih role/);
 i=interaction('community:add',{channel:installed.manage,memberRoles:[]});await handleCommunityInteraction(i,client,guild.id);assert.match(i.output.content,/Hanya/);
 i=interaction('community:add',{channel:installed.manage});await handleCommunityInteraction(i,client,guild.id);assert.equal(i.modal.title,'Tambah kategori');
 i=interaction('community:add-submit',{channel:installed.manage,type:'modal',fields:{names:'Alpha\nBeta'}});await handleCommunityInteraction(i,client,guild.id);assert.match(i.output.content,/2 dibuat/);
 const a=channels.find(c=>c.name==='Alpha'),b=channels.find(c=>c.name==='Beta');
 i=interaction('community:select-edit',{channel:installed.manage,type:'select',values:[a.id,b.id]});await handleCommunityInteraction(i,client,guild.id);let modalId=i.modal.custom_id;
 i=interaction(modalId,{channel:installed.manage,type:'modal',fields:{names:`${a.id} | Satu\n${b.id} | Dua`}});await handleCommunityInteraction(i,client,guild.id);assert.equal(a.name,'Satu');assert.equal(b.name,'Dua');
 i=interaction('community:select-delete',{channel:installed.manage,type:'select',values:[a.id,b.id]});await handleCommunityInteraction(i,client,guild.id);const confirm=i.output.components[0].toJSON().components[0].custom_id;assert(i.output.embeds[0].toJSON().description.includes('Dua'));
 i=interaction(confirm,{channel:installed.manage});await handleCommunityInteraction(i,client,guild.id);assert(!channels.has(a.id)&&!channels.has(b.id));
 i=interaction('community:select-delete',{channel:installed.manage,type:'select',values:[installed.category.id]});await handleCommunityInteraction(i,client,guild.id);assert.match(i.output.content,/dilindungi/);
 // Channel management: membuat, mengganti nama, mengonfirmasi dan melindungi channel.
 const managed=installed.manageChannels; assert(managed); assert.equal(managed.sent.length,1);
 assert(managed.permissionOverwrites.cache.get(guild.id).deny.has(PermissionsBitField.Flags.ViewChannel));
 i=interaction('community:channel-add',{channel:managed,memberRoles:[]}); await handleCommunityInteraction(i,client,guild.id); assert.match(i.output.content,/Hanya/);
 i=interaction('community:channel-add',{channel:managed}); await handleCommunityInteraction(i,client,guild.id); assert.equal(i.output.components[0].toJSON().components[0].max_values,1);
 const category=channel('TEST KANAL',ChannelType.GuildCategory);
 i=interaction('community:channel-create-category',{channel:managed,type:'select',values:[category.id]}); await handleCommunityInteraction(i,client,guild.id);
 let typeButton=i.output.components[0].toJSON().components[0].custom_id;
 i=interaction(typeButton,{channel:managed}); await handleCommunityInteraction(i,client,guild.id); let addModal=i.modal.custom_id;
 i=interaction(addModal,{channel:managed,type:'modal',fields:{names:'berita-baru\nchat-baru'}}); await handleCommunityInteraction(i,client,guild.id); assert.match(i.output.content,/2 channel dibuat/);
 const c1=channels.find(c=>c.name==='berita-baru'),c2=channels.find(c=>c.name==='chat-baru'); assert.equal(c1.parentId,category.id); assert.equal(c1.type,ChannelType.GuildText);
 i=interaction('community:channel-edit',{channel:managed}); await handleCommunityInteraction(i,client,guild.id); assert.equal(i.output.components[0].toJSON().components[0].max_values,25);
 i=interaction('community:channel-select-edit',{channel:managed,type:'select',values:[c1.id,c2.id]}); await handleCommunityInteraction(i,client,guild.id); let editChannelModal=i.modal.custom_id;
 i=interaction(editChannelModal,{channel:managed,type:'modal',fields:{names:`${c1.id} | pertama\n${c2.id} | kedua`}}); await handleCommunityInteraction(i,client,guild.id); assert.equal(c1.name,'pertama'); assert.equal(c2.name,'kedua');
 i=interaction('community:channel-select-delete',{channel:managed,type:'select',values:[c1.id,c2.id]}); await handleCommunityInteraction(i,client,guild.id); let confirmChannel=i.output.components[0].toJSON().components[0].custom_id; assert.match(i.output.content,/permanen/); assert.match(i.output.embeds[0].toJSON().description,/kedua/);
 i=interaction(confirmChannel,{channel:managed}); i.user.id='100000000000000099'; await handleCommunityInteraction(i,client,guild.id); assert.match(i.output.content,/kedaluwarsa/); assert(channels.has(c1.id));
 i=interaction(confirmChannel,{channel:managed}); await handleCommunityInteraction(i,client,guild.id); assert(!channels.has(c1.id) && !channels.has(c2.id));
 for (const protectedCh of [installed.manage,installed.manageChannels,installed.inbox,installed.welcome]) {
   i=interaction('community:channel-select-delete',{channel:managed,type:'select',values:[protectedCh.id]}); await handleCommunityInteraction(i,client,guild.id); assert.match(i.output.content,/dilindungi/);
 }
 i=interaction('community:channel-create-category',{channel:managed,type:'select',values:[category.id]}); await handleCommunityInteraction(i,client,guild.id); typeButton=i.output.components[0].toJSON().components[1].custom_id;
 i=interaction(typeButton,{channel:managed}); await handleCommunityInteraction(i,client,guild.id); addModal=i.modal.custom_id;
 i=interaction(addModal,{channel:managed,type:'modal',fields:{names:'Suara Uji'}}); await handleCommunityInteraction(i,client,guild.id); assert.equal(channels.find(c=>c.name==='Suara Uji').type,ChannelType.GuildVoice);
 // Channel baru di kategori privat menyalin deny ViewChannel dari kategori.
 i=interaction('community:channel-create-category',{channel:managed,type:'select',values:[installed.category.id]}); await handleCommunityInteraction(i,client,guild.id); typeButton=i.output.components[0].toJSON().components[0].custom_id;
 i=interaction(typeButton,{channel:managed}); await handleCommunityInteraction(i,client,guild.id); addModal=i.modal.custom_id;
 i=interaction(addModal,{channel:managed,type:'modal',fields:{names:'channel-private-uji'}}); await handleCommunityInteraction(i,client,guild.id);
 assert(channels.find(c=>c.name==='channel-private-uji').permissionOverwrites.cache.get(guild.id).deny.has(PermissionsBitField.Flags.ViewChannel));
 installed.inbox.permissionOverwrites.cache.set('bad',{id:'bad',allow:new PermissionsBitField(PermissionsBitField.Flags.ViewChannel),deny:new PermissionsBitField()});
 i=interaction('community:feedback-submit',{channel:feedback,memberRoles:[worker],type:'modal',fields:{judul:'x',isi:'y'}});await assert.rejects(handleCommunityInteraction(i,client,guild.id),/belum aman/);assert.equal(installed.inbox.sent.length,1);
 console.log('LULUS: setup idempotent, izin privat, form, role, kategori tambah/edit/hapus dan konfirmasi, perlindungan kategori, privasi inbox dan kelola channel teks/suara.');
})().catch(e=>{console.error(e);process.exitCode=1});
