'use strict';
const {ChannelType,PermissionsBitField}=require('discord.js');
const F=PermissionsBitField.Flags;
const managed=['kelola-kategori','kelola-channel','terima-form','kelola-embed-welcome-member','kelola-member','edit-pesan-channel-awal','kelola-slash-command'];
const backup=['pesan-dihapus','riwayat-chat'];
const publicNames=['diskusi','rules-and-role','feedback-and-request'];
const rights={ViewChannel:true,ReadMessageHistory:true,SendMessages:true,EmbedLinks:true,AttachFiles:true};
const pause=()=>new Promise(r=>setTimeout(r,300));
// Only repair pre-existing recognizable bot setup, and only the bot's own
// overwrite. Never replace another overwrite or defeat an explicit bot deny.
async function restoreAccess(guild,client,{wait=pause}={}){
 const [channels,roles]=await Promise.all([guild.channels.fetch(),guild.roles.fetch()]);
 const cats=channels.filter(c=>c?.type===ChannelType.GuildCategory&&c.name==='🔐 KELOLA KOMUNITAS');
 const owners=roles.filter(r=>r.id!==guild.id&&r.name==='Owner');
 const result={updated:0,skipped:[],errors:[]};
 if(cats.size!==1||owners.size!==1)return result;
 const owner=owners.first(), cat=cats.first();
 const safe=c=>{const p=c.permissionOverwrites?.cache;return !!p?.get(guild.id)?.deny.has(F.ViewChannel)&&!p.some(o=>![guild.id,client.user.id,owner.id].includes(o.id)&&o.allow.has(F.ViewChannel));};
 if(!safe(cat)){result.skipped.push('Kategori kelola tidak privat');return result;}
 // Require the two key channels as evidence of an earlier setup.
 for(const name of ['kelola-member','kelola-embed-welcome-member']){
  if(channels.filter(c=>c?.type===ChannelType.GuildText&&c.parentId===cat.id&&c.name===name).size!==1)return result;
 }
 const targets=[cat];
 function addUnique(name,category,secure){const matches=channels.filter(c=>c?.type===ChannelType.GuildText&&c.name===name&&(!category||c.parentId===category.id));if(matches.size===1){const c=matches.first();if(!secure||safe(c))targets.push(c);else result.skipped.push('#'+name+' tidak privat');}else if(matches.size>1)result.skipped.push('#'+name+' duplikat');}
 for(const n of managed)addUnique(n,cat,true);
 const backs=channels.filter(c=>c?.type===ChannelType.GuildCategory&&c.name==='🗄️ BACKUP');
 if(backs.size===1&&safe(backs.first())){targets.push(backs.first());for(const n of backup)addUnique(n,backs.first(),true);}
 else if(backs.size>0)result.skipped.push('Kategori backup tidak aman atau duplikat');
 for(const n of publicNames)addUnique(n,null,false);
 for(const ch of targets){
  const ow=ch.permissionOverwrites?.cache.get(client.user.id);
  // A direct explicit deny is an administrator's decision, not something to undo.
  if(ow&&Object.keys(rights).some(k=>ow.deny.has(F[k]))){result.skipped.push('#'+ch.name+' menolak akses bot');continue;}
  if(ow&&Object.keys(rights).every(k=>ow.allow.has(F[k])))continue;
  try{await ch.permissionOverwrites.edit(client.user.id,rights,{reason:'Pulihkan akses bot untuk channel setup komunitas setelah undangan ulang'});result.updated++;await wait();}
  catch(e){result.errors.push(`${ch.name}: ${e.code===50013?'Missing Permissions':e.message}`);}
 }
 return result;
}
module.exports={restoreAccess};
