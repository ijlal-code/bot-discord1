const assert = require('node:assert/strict');
const {Collection, ChannelType, EmbedBuilder, PermissionsBitField, SystemChannelFlagsBitField} = require('discord.js');
let welcome = require('./welcome');
const client={user:{id:'100000000000000004'}};
const channels=new Collection(); let seq=1000;
const guild={id:'100000000000000001',name:'Ainun Ijlal Studio',memberCount:25,iconURL:()=>null,systemChannelFlags:new SystemChannelFlagsBitField(0),
  roles:{cache:new Collection([['owner',{id:'owner',name:'Owner'}]])},channels:{cache:channels,fetch:async()=>channels},async edit(data){this.systemChannelFlags=data.systemChannelFlags;this.editCount=(this.editCount||0)+1}};
function makeChannel(id,name,type,parentId=null) {
  const list=[];
  const channel={id,name,type,parentId, get parent(){return channels.get(parentId)}, sent:list,permissionOverwrites:{cache:new Collection([[guild.id,{id:guild.id,deny:new PermissionsBitField(PermissionsBitField.Flags.ViewChannel),allow:new PermissionsBitField()}]])},
    messages:{async fetch(opts){if(opts.message)return list.find(m=>m.id===opts.message)||null;let all=[...list].reverse();if(opts.before){const n=all.findIndex(m=>m.id===opts.before);all=n<0?[]:all.slice(n+1)};return new Collection(all.slice(0,opts.limit).map(m=>[m.id,m]));}},
    async send(payload){for(const e of payload.embeds||[])e.toJSON();const m={id:String(++seq),channelId:id,author:client.user,createdTimestamp:Date.now(),embeds:(payload.embeds||[]).map(e=>e.toJSON()),components:(payload.components||[]).map(r=>r.toJSON()),payload,
      async edit(p){this.embeds=(p.embeds||[]).map(e=>e.toJSON());return this}};list.push(m);return m;}};
  channels.set(id,channel);return channel;
}
const category=makeChannel('200','🔐 KELOLA KOMUNITAS',ChannelType.GuildCategory);
const settings=makeChannel('201','kelola-embed-welcome-member',ChannelType.GuildText,category.id);
const memberManager=makeChannel('206','kelola-member',ChannelType.GuildText,category.id);
const announcements=makeChannel('202','announcements',ChannelType.GuildText);
const discussion=makeChannel('203','diskusi',ChannelType.GuildText);
makeChannel('204','rules-and-role',ChannelType.GuildText);makeChannel('205','template-gratis',ChannelType.GuildText);
const member={id:'100000000000000999',user:{username:'Rina',tag:'rina#0001',createdTimestamp:1700000000000,displayAvatarURL:()=> 'https://example.com/avatar.png'},guild,joinedTimestamp:Date.now()};
function form(target,body) {return {customId:`community:welcome-save:${target}`,guildId:guild.id,guild,channel:settings,fields:{getTextInputValue:k=>k==='body'?body:undefined},isButton:()=>false,isModalSubmit:()=>true,async deferReply(){},async editReply(value){this.output=value}};}
function edit(target) {return {customId:`community:welcome-edit:${target}`,guild,channel:settings,isButton:()=>true,isModalSubmit:()=>false,async showModal(modal){this.modal=modal.toJSON()}};}
(async()=>{
 await welcome.suppressSystemWelcome(guild);await welcome.suppressSystemWelcome(guild);assert.equal(guild.editCount,1);
 let a=edit('announcements');await welcome.handleWelcomeInteraction(a,client);assert.equal(a.modal.components.length,4);assert.match(a.modal.components[1].components[0].value,/pilih role/i);
 let d=edit('diskusi');await welcome.handleWelcomeInteraction(d,client);assert.equal(d.modal.components.length,4);assert.match(d.modal.components[1].components[0].value,/telah memilih role/);
 const fields={header:'Author {username}\nJudul {username}',body:'Halo {member}, pilih role {rules}',details:'Member | {tag}\n-\nDibuat | {account_created}',footer:'TIDAK\nFooter {id}'};
 const form=(target,values)=>({customId:`community:welcome-save-all:${target}`,guildId:guild.id,guild,channel:settings,fields:{getTextInputValue:k=>values[k]},isButton:()=>false,isModalSubmit:()=>true,async deferReply(){},async editReply(v){this.output=v}});
 let i=form('announcements',fields);await welcome.handleWelcomeInteraction(i,client);assert.match(i.output,/disimpan/);
 await welcome.announceJoin(member,client);assert.equal(announcements.sent.length,0);assert.equal(discussion.sent.length,1);
 let first=discussion.sent[0].embeds[0];assert.equal(first.author.name,'Author Rina');assert.equal(first.title,'Judul Rina');assert.equal(first.fields.length,2);assert.match(first.footer.text,/100000000000000999/);assert.equal(first.timestamp,undefined);assert.match(first.description,/pilih role/);
 await welcome.welcomeAfterRole(member,client,'Pelajar');assert.equal(discussion.sent.length,2);assert.match(discussion.sent[1].embeds[0].description,/Pelajar/);
 await welcome.welcomeAfterRole(member,client,'Umum');assert.equal(discussion.sent.length,2);
 delete require.cache[require.resolve('./welcome')];welcome=require('./welcome');a=edit('announcements');await welcome.handleWelcomeInteraction(a,client);assert.match(a.modal.components[0].components[0].value,/Author/);
 i=form('diskusi',{...fields,footer:'SALAH\nfoo'});await welcome.handleWelcomeInteraction(i,client);assert.match(i.output,/YA atau TIDAK/);
 assert.equal(welcome.welcomePanel().components[0].toJSON().components.length,2);
 console.log('LULUS: satu formulir tiap pesan, migrasi, dua pesan diskusi, bagian footer/waktu dan persistensi.');
})().catch(e=>{console.error(e);process.exitCode=1});
