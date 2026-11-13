const assert = require('node:assert/strict');
const {Collection, ChannelType, EmbedBuilder, SystemChannelFlagsBitField} = require('discord.js');
let welcome = require('./welcome');
const client={user:{id:'100000000000000004'}};
const channels=new Collection(); let seq=1000;
const guild={id:'100000000000000001',name:'Ainun Ijlal Studio',memberCount:25,iconURL:()=>null,systemChannelFlags:new SystemChannelFlagsBitField(0),
  channels:{cache:channels,fetch:async()=>channels},async edit(data){this.systemChannelFlags=data.systemChannelFlags;this.editCount=(this.editCount||0)+1}};
function makeChannel(id,name,type,parentId=null) {
  const list=[];
  const channel={id,name,type,parentId, get parent(){return channels.get(parentId)}, sent:list,
    messages:{async fetch(opts){let all=[...list].reverse();if(opts.before){const n=all.findIndex(m=>m.id===opts.before);all=n<0?[]:all.slice(n+1)};return new Collection(all.slice(0,opts.limit).map(m=>[m.id,m]));}},
    async send(payload){for(const e of payload.embeds||[])e.toJSON();const m={id:String(++seq),author:client.user,createdTimestamp:Date.now(),embeds:(payload.embeds||[]).map(e=>e.toJSON()),components:(payload.components||[]).map(r=>r.toJSON()),payload,
      async edit(p){this.embeds=(p.embeds||[]).map(e=>e.toJSON());return this}};list.push(m);return m;}};
  channels.set(id,channel);return channel;
}
const category=makeChannel('200','🔐 KELOLA KOMUNITAS',ChannelType.GuildCategory);
const settings=makeChannel('201','kelola-embed-welcome-member',ChannelType.GuildText,category.id);
const announcements=makeChannel('202','announcements',ChannelType.GuildText);
const discussion=makeChannel('203','diskusi',ChannelType.GuildText);
makeChannel('204','rules-and-role',ChannelType.GuildText);makeChannel('205','template-gratis',ChannelType.GuildText);
const member={id:'100000000000000999',user:{username:'Rina',tag:'rina#0001',createdTimestamp:1700000000000,displayAvatarURL:()=> 'https://example.com/avatar.png'},guild,joinedTimestamp:Date.now()};
function form(target,body) {return {customId:`community:welcome-save:${target}`,guildId:guild.id,guild,channel:settings,fields:{getTextInputValue:k=>k==='body'?body:undefined},isButton:()=>false,isModalSubmit:()=>true,async deferReply(){},async editReply(value){this.output=value}};}
function edit(target) {return {customId:`community:welcome-edit:${target}`,guild,channel:settings,isButton:()=>true,isModalSubmit:()=>false,async showModal(modal){this.modal=modal.toJSON()}};}
(async()=>{
 await welcome.suppressSystemWelcome(guild);await welcome.suppressSystemWelcome(guild);assert.equal(guild.editCount,1);
 // Konfigurasi v1 sebelumnya tidak dihapus dan tidak dipakai otomatis sebagai template baru.
 const legacy=await settings.send({embeds:[new EmbedBuilder().setTitle('Lama').setDescription('Isi lama bebas').setFooter({text:'welcome-config:v1:announcements'})]});
 let a=edit('announcements');await welcome.handleWelcomeInteraction(a,client);assert.equal(a.modal.components.length,1);
 const initial=a.modal.components[0].components[0].value;assert.match(initial,/Verifikasi Role Status/);assert.match(initial,/ainunijlal.com/);assert.doesNotMatch(initial,/Isi lama bebas/);
 let d=edit('diskusi');await welcome.handleWelcomeInteraction(d,client);assert.match(d.modal.components[0].components[0].value,/telah memilih role/);
 await welcome.announceJoin(member,client);assert.equal(announcements.sent.length,1);assert.equal(discussion.sent.length,0);
 const first=announcements.sent[0];assert.equal(first.payload.content,undefined);const e=first.embeds[0];
 assert.equal(e.author.name,'AINUN IJLAL STUDIO • MEMBER ONBOARDING');assert.equal(e.title,'Selamat Datang, Rina');assert.equal(e.fields.length,3);assert.equal(e.thumbnail.url,'https://example.com/avatar.png');assert.equal(e.image,undefined);
 assert.match(e.description,/<#204>/);assert.match(e.description,/<#203>/);assert.match(e.description,/<#205>/);assert.match(e.description,/pilih role/i);
 await welcome.welcomeAfterRole(member,client,'Pelajar');assert.equal(discussion.sent.length,1);assert.equal(discussion.sent[0].embeds[0].title,e.title);assert.match(discussion.sent[0].embeds[0].description,/\*\*Pelajar\*\*/);assert.match(first.embeds[0].footer.text,/:done$/);
 await welcome.welcomeAfterRole(member,client,'Umum');assert.equal(discussion.sent.length,1);
 let i=form('announcements','Halo {member}, pilih role pada {rules}.');await welcome.handleWelcomeInteraction(i,client);assert.match(i.output,/disimpan/);
 i=form('diskusi','Halo {username}, role {role} sudah aktif di {diskusi}.');await welcome.handleWelcomeInteraction(i,client);assert(settings.sent.includes(legacy));
 // Isi tersimpan di pesan Discord dan bertahan setelah restart.
 delete require.cache[require.resolve('./welcome')];welcome=require('./welcome');a=edit('announcements');await welcome.handleWelcomeInteraction(a,client);assert.equal(a.modal.components[0].components[0].value,'Halo {member}, pilih role pada {rules}.');
 const member2={...member,id:'100000000000000998'};await welcome.announceJoin(member2,client);assert.match(announcements.sent.at(-1).embeds[0].description,/pilih role pada/);await welcome.welcomeAfterRole(member2,client,'Pekerja');assert.match(discussion.sent.at(-1).embeds[0].description,/role Pekerja sudah aktif/);
 // Pending dari versi footer terdahulu tetap diproses setelah pembaruan.
 const oldMember={...member,id:'100000000000000888'};await announcements.send({embeds:[new EmbedBuilder().setDescription('Legacy').setFooter({text:`welcome-member:v1:${oldMember.id}:${oldMember.joinedTimestamp}:pending`})]});
 const n=discussion.sent.length;await welcome.welcomeAfterRole(oldMember,client,'Umum');assert.equal(discussion.sent.length,n+1);
 i=form('diskusi','  ');await welcome.handleWelcomeInteraction(i,client);assert.match(i.output,/wajib/);
 assert(!JSON.stringify(welcome.welcomePanel().components.map(c=>c.toJSON())).includes('upload'));
 console.log('LULUS: format onboarding lama, isi terpisah, role, migrasi aman, tidak ada banner dan persistensi.');
})().catch(e=>{console.error(e);process.exitCode=1});
