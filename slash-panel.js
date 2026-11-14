'use strict';
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, StringSelectMenuBuilder, MessageFlags, ChannelType } = require('discord.js');
const state = require('./state');
const auth = require('./web-auth');
const rows=(...x)=>new ActionRowBuilder().addComponents(...x);
const pending=new Map(), applying=new Set();
function panel(){return {embeds:[new EmbedBuilder().setColor(0x2873c9).setTitle('Akses slash command untuk member').setDescription('Pilih perintah yang aman untuk member di #diskusi. Perintah pengelola dan reset tetap khusus pengelola.\n\nSebelum menyimpan, otorisasi Discord melalui link yang diberikan bot agar bot mendapatkan izin perubahan command. Pengaturan akan **mengganti overwrite perintah tersebut** di Integrations.')],components:[rows(new ButtonBuilder().setCustomId('community:slash-open').setLabel('Pilih perintah').setStyle(ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
async function handle(i,client){
 const id=i.customId;
 if(id==='community:slash-open'&&i.isButton()){
  const current=state.get(i.guildId)?.enabledMemberCommands?.includes('onboarding-member');
  return i.reply({content:'Pilih perintah untuk member; pilih **Tidak ada** untuk menyembunyikan semuanya. Perintah lain tetap khusus pengelola.',flags:MessageFlags.Ephemeral,components:[rows(new StringSelectMenuBuilder().setCustomId('community:slash-pick').setPlaceholder('Pilih akses member').addOptions([{label:'Tidak ada',value:'none',default:!current},{label:'/onboarding-member',value:'onboarding-member',default:!!current}])),rows(new ButtonBuilder().setCustomId('community:slash-cancel').setLabel('Batal').setStyle(ButtonStyle.Secondary))]});
 }
 if(id==='community:slash-cancel'&&i.isButton()){await i.deferUpdate();return i.deleteReply();}
 if(id==='community:slash-pick'&&i.isStringSelectMenu()){
  const value=i.values[0];if(!['none','onboarding-member'].includes(value))throw Error('Pilihan tidak valid.');
  for(const [k,v] of pending)if(v.expires<Date.now())pending.delete(k);
  const key=`${i.guildId}:${i.user.id}:${i.message.id}`;pending.set(key,{value,expires:Date.now()+600000});
  return i.update({content:`Pilihan: **${value==='none'?'Tidak ada':'/onboarding-member'}**. Tekan Terapkan untuk mengganti overwrite perintah ini di Integrations.`,components:[rows(new StringSelectMenuBuilder().setCustomId('community:slash-pick').setPlaceholder('Ubah pilihan').addOptions([{label:'Tidak ada',value:'none',default:value==='none'},{label:'/onboarding-member',value:'onboarding-member',default:value!=='none'}])),rows(new ButtonBuilder().setCustomId('community:slash-apply').setLabel('Terapkan').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('community:slash-cancel').setLabel('Batal').setStyle(ButtonStyle.Secondary))]});
 }
 if(id==='community:slash-apply'&&i.isButton()){
  const key=`${i.guildId}:${i.user.id}:${i.message.id}`, choice=pending.get(key);
  if(!choice||choice.expires<Date.now())return i.reply({content:'Pilihan kedaluwarsa; buka panel lagi.',flags:MessageFlags.Ephemeral});
  const token=auth.tokenFor(i.user.id);if(!token)return i.reply({content:`Otorisasi Discord untuk mengubah izin command, lalu kembali tekan Terapkan: ${process.env.DASHBOARD_URL}/auth/permissions`,flags:MessageFlags.Ephemeral});
  if(applying.has(i.guildId))return i.reply({content:'Pengaturan lain sedang diproses. Coba lagi.',flags:MessageFlags.Ephemeral});
  applying.add(i.guildId);
  try{
   await i.deferUpdate();
   const guild=i.guild; await guild.roles.fetch(); const member=await guild.members.fetch({user:i.user.id,force:true});
   if(!auth.canManage(guild,member))throw Error('Akun harus memiliki role Owner dan izin Manage Server serta Manage Roles.');
   const channels=await guild.channels.fetch();const matches=channels.filter(c=>c?.type===ChannelType.GuildText&&c.name==='diskusi');
   if(matches.size!==1)throw Error('Harus ada tepat satu channel teks #diskusi.');
   const discussion=matches.first();
   const commands=await guild.commands.fetch(); const cmd=commands.find(c=>c.name==='onboarding-member'&&c.type===1); if(!cmd)throw Error('Perintah guild belum terdaftar; aktifkan ulang server di dashboard.');
   const enabled=choice.value==='onboarding-member';
   if(!enabled)await state.select(guild.id,false,null);
   const ownerRole=guild.roles.cache.find(r=>r.name==='Owner'&&r.id!==guild.id);
   const permissions=[{id:guild.id,type:1,permission:enabled},{id:ownerRole.id,type:1,permission:true},{id:(BigInt(guild.id)-1n).toString(),type:3,permission:false},{id:discussion.id,type:3,permission:true}];
   const r=await fetch(`https://discord.com/api/v10/applications/${client.user.id}/guilds/${guild.id}/commands/${cmd.id}/permissions`,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({permissions}),signal:AbortSignal.timeout(15000)});
   if(!r.ok)throw Error(`Discord menolak perubahan izin (HTTP ${r.status}). Login ulang dan periksa Manage Server/Manage Roles serta Integrations.`);
   if(enabled)await state.select(guild.id,true,discussion.id);
   pending.delete(key);await i.editReply({content:`✅ Akses member ${enabled?'diaktifkan untuk /onboarding-member di #diskusi':'dinonaktifkan'}. Periksa izin dan perintah global lama di Integrations.`,components:[]});
  }catch(e){await i.editReply({content:`❌ ${e.message} Pilih ulang atau tekan Terapkan lagi setelah login.`,components:i.message.components}).catch(()=>{});}finally{applying.delete(i.guildId);}
 }
}
module.exports={panel,handle};
