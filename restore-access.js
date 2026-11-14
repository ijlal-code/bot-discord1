'use strict';
const {ChannelType,PermissionsBitField}=require('discord.js');
const F=PermissionsBitField.Flags;
const managed=['kelola-kategori','kelola-channel','terima-form','kelola-embed-welcome-member','kelola-member','edit-pesan-channel-awal','kelola-slash-command'];
const backup=['pesan-dihapus','riwayat-chat'];
const publicNames=['diskusi','rules-and-role','feedback-and-request'];
const rights={ViewChannel:true,ReadMessageHistory:true,SendMessages:true,EmbedLinks:true,AttachFiles:true};
const pause=()=>new Promise(r=>setTimeout(r,300));
// Only modify the bot's own overwrite on recognized channels; never remove
// explicit denies or other members' access. Verify effective permissions.
async function restoreAccess(guild,client,{wait=pause}={}){
 const result={updated:0,verified:0,checked:0,recognized:false,skipped:[],errors:[]};
 const [channels,roles,me]=await Promise.all([guild.channels.fetch(),guild.roles.fetch(),guild.members.fetchMe({force:true})]);
 const cats=channels.filter(c=>c?.type===ChannelType.GuildCategory&&c.name==='🔐 KELOLA KOMUNITAS');
 const owners=roles.filter(r=>r.id!==guild.id&&r.name==='Owner');
 if(cats.size!==1){result.skipped.push('Kategori 🔐 KELOLA KOMUNITAS tidak terlihat, tidak ada, atau duplikat. Minta pemilik memberi View Channel kepada bot.');return result;}
 if(owners.size!==1){result.skipped.push('Role Owner tidak ada atau duplikat.');return result;}
 const owner=owners.first(),cat=cats.first();
 const safe=c=>{const p=c.permissionOverwrites?.cache;return !!p?.get(guild.id)?.deny.has(F.ViewChannel)&&!p.some(o=>![guild.id,client.user.id,owner.id].includes(o.id)&&o.allow.has(F.ViewChannel));};
 if(!safe(cat)){result.skipped.push('Kategori kelola belum terbukti privat; periksa overwrite dan akses bot.');return result;}
 result.recognized=true;
 const targets=[cat];
 function addUnique(name,category,secure){const matches=channels.filter(c=>c?.type===ChannelType.GuildText&&c.name===name&&(!category||c.parentId===category.id));if(matches.size===1){const c=matches.first();if(!secure||safe(c))targets.push(c);else result.skipped.push(`#${name} tidak terbukti privat; periksa izin.`);}else result.skipped.push(`#${name} ${matches.size?'duplikat':'tidak ditemukan atau tidak terlihat'}.`);}
 for(const n of managed)addUnique(n,cat,true);
 const backs=channels.filter(c=>c?.type===ChannelType.GuildCategory&&c.name==='🗄️ BACKUP');
 if(backs.size===1&&safe(backs.first())){targets.push(backs.first());for(const n of backup)addUnique(n,backs.first(),true);}else result.skipped.push('Kategori BACKUP tidak terlihat, tidak privat, atau duplikat.');
 for(const n of publicNames)addUnique(n,null,false);
 for(const ch of targets){
  result.checked++;
  const ow=ch.permissionOverwrites?.cache.get(client.user.id);
  if(ow&&Object.keys(rights).some(k=>ow.deny.has(F[k]))){result.skipped.push(`${ch.name}: ada penolakan eksplisit untuk bot; pemilik harus mengubahnya.`);continue;}
  let current=ch;
  if(!ow||!Object.keys(rights).every(k=>ow.allow.has(F[k]))){
   try{await ch.permissionOverwrites.edit(client.user.id,rights,{reason:'Pulihkan akses bot komunitas setelah undangan ulang'});result.updated++;await wait();current=await guild.channels.fetch(ch.id,{force:true});if(!current)throw Error('channel tidak dapat diambil kembali');}
   catch(e){result.errors.push(`${ch.name}: ${e.code===50001?'Missing Access':e.code===50013?'Missing Permissions':e.message}`);continue;}
  }
  try{const effective=current.permissionsFor(me);const required=ch.type===ChannelType.GuildCategory?['ViewChannel']:Object.keys(rights);const missing=required.filter(k=>!effective?.has(F[k]));if(missing.length)result.errors.push(`${ch.name}: izin efektif kurang ${missing.join(', ')}.`);else result.verified++;}catch(e){result.errors.push(`${ch.name}: izin efektif tidak dapat diverifikasi (${e.message}).`);}
 }
 return result;
}
module.exports={restoreAccess};
