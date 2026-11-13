const assert = require('node:assert/strict');
const { Collection, ChannelType, EmbedBuilder, SystemChannelFlagsBitField } = require('discord.js');
let welcome = require('./welcome');
const client={user:{id:'100000000000000004'}};
const channels=new Collection(); let seq=1000;
const guild={id:'100000000000000001',name:'Komunitas Test',memberCount:25,systemChannelFlags:new SystemChannelFlagsBitField(0),
  channels:{cache:channels,fetch:async()=>channels},async edit(data){this.systemChannelFlags=data.systemChannelFlags;this.editCount=(this.editCount||0)+1}};
function makeChannel(id,name,type,parentId=null) {
  const list=[];
  const channel={id,name,type,parentId, get parent(){return channels.get(parentId)}, sent:list,
    messages:{async fetch(opts){let all=[...list].reverse();if(opts.before){const n=all.findIndex(m=>m.id===opts.before); all=n<0?[]:all.slice(n+1)}; return new Collection(all.slice(0,opts.limit).map(m=>[m.id,m]));}},
    async send(payload){for(const e of payload.embeds||[])e.toJSON(); const m={id:String(++seq),author:client.user,createdTimestamp:Date.now(),embeds:(payload.embeds||[]).map(e=>e.toJSON()),components:(payload.components||[]).map(r=>r.toJSON()),payload,
      async edit(p){this.embeds=(p.embeds||[]).map(e=>e.toJSON());return this}};list.push(m);return m;}};
  channels.set(id,channel);return channel;
}
const category=makeChannel('200','🔐 KELOLA KOMUNITAS',ChannelType.GuildCategory);
const settings=makeChannel('201','kelola-embed-welcome-member',ChannelType.GuildText,category.id);
const announcements=makeChannel('202','announcements',ChannelType.GuildText);
const discussion=makeChannel('203','diskusi',ChannelType.GuildText);
const member={id:'100000000000000999',user:{username:'Rina',bot:false},guild,joinedTimestamp:Date.now()};
function form(target,fields) {return {customId:`community:welcome-save:${target}`,guild,channel:settings,user:{id:'555'},fields:{getTextInputValue:k=>fields[k]},isButton:()=>false,isModalSubmit:()=>true,async deferReply(){},async editReply(value){this.output=value}};}
function edit(target) {return {customId:`community:welcome-edit:${target}`,guild,channel:settings,isButton:()=>true,isModalSubmit:()=>false,async showModal(modal){this.modal=modal.toJSON()}};}
(async()=>{
 await welcome.suppressSystemWelcome(guild); await welcome.suppressSystemWelcome(guild); assert.equal(guild.editCount,1);assert(guild.systemChannelFlags.has(SystemChannelFlagsBitField.Flags.SuppressJoinNotifications));
 let a=edit('announcements'); await welcome.handleWelcomeInteraction(a,client);assert.equal(a.modal.components.length,3);
 let i=form('announcements',{title:'Halo {username}',body:'Bergabung di {server}: {member}',banner:'https://example.com/banner.png'});await welcome.handleWelcomeInteraction(i,client);assert.match(i.output,/disimpan/);
 i=form('diskusi',{title:'Role {role}',body:'Hai {member}, diskusi sekarang',banner:''});await welcome.handleWelcomeInteraction(i,client);
 i=form('diskusi',{title:'x',body:'y',banner:'http://contoh.com/a.png'});await welcome.handleWelcomeInteraction(i,client);assert.match(i.output,/HTTPS/);
 // Hilangkan cache Node module, lalu cek konfigurasi tetap berada di pesan Discord.
 delete require.cache[require.resolve('./welcome')]; welcome=require('./welcome');
 a=edit('announcements');await welcome.handleWelcomeInteraction(a,client);assert.equal(a.modal.components[0].components[0].value,'Halo {username}');
 await welcome.announceJoin(member,client);assert.equal(announcements.sent.length,1);assert.equal(discussion.sent.length,0);
 assert.equal(announcements.sent[0].embeds[0].title,'Halo Rina');assert.equal(announcements.sent[0].embeds[0].image.url,'https://example.com/banner.png');assert.equal(announcements.sent[0].payload.content,undefined);
 await welcome.welcomeAfterRole(member,client,'Pelajar');assert.equal(discussion.sent.length,1);assert.equal(discussion.sent[0].embeds[0].title,'Role Pelajar');assert.match(announcements.sent[0].embeds[0].footer.text,/:done$/);
 await welcome.welcomeAfterRole(member,client,'Pekerja');assert.equal(discussion.sent.length,1);
 const oldMember={...member,id:'100000000000000888'};await welcome.welcomeAfterRole(oldMember,client,'Umum');assert.equal(discussion.sent.length,1);
 i=form('announcements',{title:'Halo',body:'Pesan',banner:''});await welcome.handleWelcomeInteraction(i,client);
 a=edit('announcements');await welcome.handleWelcomeInteraction(a,client);assert.equal(a.modal.components[2].components[0].value,undefined);
 console.log('LULUS: setting terpisah tersimpan, banner, validasi, welcome join, role pertama, deduplikasi dan flag sistem.');
})().catch(e=>{console.error(e);process.exitCode=1});
