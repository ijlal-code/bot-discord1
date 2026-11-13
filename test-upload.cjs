const assert = require('node:assert/strict');
const {Collection, ChannelType} = require('discord.js');
let welcome=require('./welcome');
const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=','base64');
const store=new Map([['https://cdn.discordapp.com/ephemeral-attachments/abc/file.png',bytes]]);
const oldFetch=global.fetch; global.fetch=async (url,opts)=>{assert.equal(opts.redirect,'error');const body=store.get(String(url));return new Response(body||null,{status:body?200:404});};
const client={user:{id:'111'}}; const channels=new Collection();let counter=900;
const guild={id:'222',name:'Server',memberCount:10,channels:{cache:channels,fetch:async()=>channels}};
function channel(id,name,type,parentId){
 const list=[];const c={id,name,type,parentId,get parent(){return channels.get(parentId)},sent:list,
 messages:{async fetch(opts){if(opts.message)return list.find(m=>m.id===opts.message);let v=[...list].reverse(); if(opts.before){const pos=v.findIndex(m=>m.id===opts.before);v=pos<0?[]:v.slice(pos+1)} return new Collection(v.slice(0,opts.limit).map(m=>[m.id,m]))}},
 async send(payload){for(const e of payload.embeds||[])e.toJSON(); const id=String(++counter); const attachments=new Collection();for(const f of payload.files||[]){const url=`https://cdn.discordapp.com/attachments/test/${id}/${f.name}`;store.set(url,f.attachment);attachments.set('a',{id:'a',url,size:f.attachment.length,name:f.name})};
 const m={id,author:client.user,createdTimestamp:Date.now(),attachments,embeds:(payload.embeds||[]).map(x=>x.toJSON()),payload,async edit(p){this.embeds=p.embeds.map(x=>x.toJSON());return this},async delete(){let n=list.indexOf(this);if(n>=0)list.splice(n,1)}};list.push(m);return m;}};
 channels.set(id,c);return c;
}
const cat=channel('301','🔐 KELOLA KOMUNITAS',ChannelType.GuildCategory);
const settings=channel('302','kelola-embed-welcome-member',ChannelType.GuildText,cat.id);
const announcements=channel('303','announcements',ChannelType.GuildText);
const diskusi=channel('304','diskusi',ChannelType.GuildText);
const user={id:'444',user:{username:'Ari'},guild,joinedTimestamp:Date.now()};
function form(target,{title='Judul {username}',body='Halo {member}',banner='',remove='',upload=null}={}){
 const values={title,body,banner,remove};return {customId:`community:welcome-save:${target}`,guildId:guild.id,guild,channel:settings,fields:{getTextInputValue:k=>values[k],getUploadedFiles:()=>upload?new Collection([['x',upload]]):null},isButton:()=>false,isModalSubmit:()=>true,async deferReply(){},async editReply(t){this.output=t}};
}
function edit(target){return {customId:`community:welcome-edit:${target}`,guildId:guild.id,guild,channel:settings,isButton:()=>true,isModalSubmit:()=>false,async showModal(f){this.modal=f.toJSON()}}}
const file={url:'https://cdn.discordapp.com/ephemeral-attachments/abc/file.png',size:bytes.length};
(async()=>{
 let e=edit('announcements');await welcome.handleWelcomeInteraction(e,client);assert.equal(e.modal.components.length,5);assert.equal(e.modal.components[3].component.type,19);assert.equal(e.modal.components[3].component.required,false);
 // File diprioritaskan dibanding URL lama dan dipindah ke pesan bot yang bertahan.
 let f=form('announcements',{banner:'https://example.com/old.png',upload:file});await welcome.handleWelcomeInteraction(f,client);assert.match(f.output,/disimpan/);assert.equal(settings.sent.length,1);assert.equal(settings.sent[0].attachments.size,1);assert.equal(settings.sent[0].embeds[0].fields.find(x=>x.name==='Banner URL').value,'[gambar diunggah]');
 // Setelah restart, salin lampiran Discord ke embed welcome anggota.
 delete require.cache[require.resolve('./welcome')];welcome=require('./welcome');await welcome.announceJoin(user,client);assert.equal(announcements.sent.length,1);assert.equal(announcements.sent[0].payload.files[0].name,'welcome-banner.png');assert.equal(announcements.sent[0].embeds[0].image.url,'attachment://welcome-banner.png');
 // Mengubah judul tanpa unggah atau URL tetap mempertahankan gambar.
 f=form('announcements',{title:'Baru'});await welcome.handleWelcomeInteraction(f,client);assert.equal(settings.sent.length,1);assert.equal(settings.sent[0].attachments.size,1);
 const user2={...user,id:'445'};await welcome.announceJoin(user2,client);assert.equal(announcements.sent.at(-1).payload.files[0].name,'welcome-banner.png');
 // URL bisa menggantikan unggahan dan hanya untuk target tersebut.
 f=form('announcements',{banner:'https://example.com/banner.png'});await welcome.handleWelcomeInteraction(f,client);assert.equal(settings.sent.length,1);assert.equal(settings.sent[0].attachments.size,0);
 const user3={...user,id:'446'};await welcome.announceJoin(user3,client);assert.equal(announcements.sent.at(-1).embeds[0].image.url,'https://example.com/banner.png');assert.equal(announcements.sent.at(-1).payload.files,undefined);
 // URL pada diskusi tetap independen.
 f=form('diskusi',{banner:'https://example.com/other.png'});await welcome.handleWelcomeInteraction(f,client);await welcome.welcomeAfterRole(user3,client,'Umum');assert.equal(diskusi.sent[0].embeds[0].image.url,'https://example.com/other.png');
 // Upload diskusi berdiri sendiri dan muncul setelah memilih role.
 f=form('diskusi',{upload:file});await welcome.handleWelcomeInteraction(f,client);
 const user4={...user,id:'447'};await welcome.announceJoin(user4,client);await welcome.welcomeAfterRole(user4,client,'Pelajar');
 assert.equal(diskusi.sent.at(-1).payload.files[0].name,'welcome-banner.png');assert.equal(diskusi.sent.at(-1).embeds[0].image.url,'attachment://welcome-banner.png');
 // HAPUS meniadakan banner meski URL lama terisi.
 f=form('announcements',{banner:'https://example.com/banner.png',remove:'HAPUS'});await welcome.handleWelcomeInteraction(f,client);e=edit('announcements');await welcome.handleWelcomeInteraction(e,client);assert.equal(e.modal.components[2].components[0].value,undefined);
 // File mencurigakan/terlalu besar ditolak dan config tetap aman.
 f=form('announcements',{upload:{url:'https://evil.example/image.png',size:1}});await assert.rejects(welcome.handleWelcomeInteraction(f,client),/bukan CDN/);
 f=form('announcements',{upload:{...file,size:9*1024*1024}});await assert.rejects(welcome.handleWelcomeInteraction(f,client),/8 MB/);
 store.set('https://cdn.discordapp.com/ephemeral-attachments/abc/bad.png',Buffer.from('not an image'));f=form('announcements',{upload:{url:'https://cdn.discordapp.com/ephemeral-attachments/abc/bad.png',size:12}});await assert.rejects(welcome.handleWelcomeInteraction(f,client),/PNG, JPG/);
 f=form('announcements',{remove:'HAPUS',upload:file});await welcome.handleWelcomeInteraction(f,client);assert.match(f.output,/Pilih satu/);
 console.log('LULUS: unggah/URL, pemisahan channel, restart, penyimpanan, hapus, validasi ukuran/format/CDN.');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>{global.fetch=oldFetch});
