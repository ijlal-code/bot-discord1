const assert=require('node:assert/strict');
const {Collection,ChannelType,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle,PermissionsBitField}=require('discord.js');
const {handle,panel}=require('./message-management');
const client={user:{id:'100000000000000004'}};
const category={name:'⚡ AINUN IJLAL STUDIO'};
const comp=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('select_role:status:Umum').setLabel('Umum').setStyle(ButtonStyle.Secondary));
const message={id:'100000000000000010',content:'Teks asli',author:client.user,embeds:[new EmbedBuilder().setAuthor({name:'Asli'}).setTitle('Aturan').setDescription('Isi lama').addFields({name:'Pilihan',value:'Role',inline:false}).setFooter({text:'Lama'})],components:[comp],async edit(p){this.payload=p;this.content=p.content;this.embeds=p.embeds;return this}};
const messages=new Collection([[message.id,message]]);
const ch={id:'100000000000000011',name:'rules-and-role',type:ChannelType.GuildText,parent:category,permissionsFor:()=>new PermissionsBitField([PermissionsBitField.Flags.ViewChannel,PermissionsBitField.Flags.ReadMessageHistory]),messages:{async fetch(o){if(o.message)return messages.get(o.message);return messages}}};
const guild={id:'100000000000000012',channels:{fetch:async(id)=>id===ch.id?ch:null}};
function i(customId,type,extra={}){return {customId,guild,guildId:guild.id,user:{id:'100000000000000013'},values:[],isButton:()=>type==='button',isChannelSelectMenu:()=>type==='channel',isStringSelectMenu:()=>type==='string',isModalSubmit:()=>type==='modal',async reply(p){this.output=p},async update(p){this.output=p},async showModal(m){this.modal=m.toJSON()},async deferReply(){},async editReply(x){this.output=x},...extra}}
(async()=>{
 assert.equal(panel().components.length,1);
 let x=i('community:initial-open','button');await handle(x,client);assert.equal(x.output.components.length,2);
 x=i('community:initial-channel','channel',{values:[ch.id]});await handle(x,client);assert.equal(x.output.components.length,2);const sid=x.output.components[0].toJSON().components[0].custom_id;
 x=i(sid,'string',{values:[message.id]});await handle(x,client);assert.equal(x.modal.components.length,5);const mid=x.modal.custom_id;
 const values={header:'Editor\nAturan baru',body:'Isi baru',details:'Pilihan | Pekerja, Pelajar, Umum | YA\nKedua | Baris 1\\nBaris 2 | TIDAK',footer:'YA\nFooter baru',content:'Teks baru'};
 x=i(mid,'modal',{fields:{getTextInputValue:k=>values[k]}});await handle(x,client);assert.match(x.output,/diperbarui/);const embed=message.embeds[0].toJSON();assert.equal(embed.title,'Aturan baru');assert.equal(embed.author.name,'Editor');assert.equal(embed.description,'Isi baru');assert.equal(embed.fields[1].value,'Baris 1\nBaris 2');assert.equal(embed.footer.text,'Footer baru');assert(embed.timestamp);assert.equal(message.content,'Teks baru');assert.equal(message.components[0],comp);assert.equal(message.payload.components,undefined);
 // Changed target cannot be overwritten using stale modal.
 x=i('community:initial-channel','channel',{values:[ch.id]});await handle(x,client);const sid2=x.output.components[0].toJSON().components[0].custom_id;
 x=i(sid2,'string',{values:[message.id]});await handle(x,client);const mid2=x.modal.custom_id;message.content='Diubah orang lain';
 x=i(mid2,'modal',{fields:{getTextInputValue:k=>values[k]}});await assert.rejects(handle(x,client),/telah berubah/);assert.equal(message.content,'Diubah orang lain');
 const outside={...ch,id:'100000000000000014',name:'secret',parent:{name:'other'}};guild.channels.fetch=async()=>outside;
 x=i('community:initial-channel','channel',{values:[outside.id]});await handle(x,client);assert.equal(x.output.components.length,2);
 outside.permissionsFor=()=>new PermissionsBitField();x=i('community:initial-channel','channel',{values:[outside.id]});await assert.rejects(handle(x,client),/di luar/);
 console.log('LULUS: editor pesan, simpan in-place, tombol tetap, channel valid, deteksi perubahan.');
})().catch(e=>{console.error(e);process.exitCode=1});
