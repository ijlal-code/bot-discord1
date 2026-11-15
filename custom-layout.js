'use strict';
const {ChannelType,PermissionsBitField}=require('discord.js');
const {serverStructure}=require('./setup');
const {STATUS_ROLES}=require('./role');
const F=PermissionsBitField.Flags;
const emptyLayout=()=>({mode:'default',categories:[]});
const ranks={public:0,status:1,owner:2};
function validateLayout(input){
 if(input?.mode==='new')return require('./new-layout').validateNew(input);
 if(!input||typeof input!=='object'||!['default','extra'].includes(input.mode)||!Array.isArray(input.categories)||input.categories.length>5)throw Error('Konfigurasi tidak valid (maksimal 5 kategori).');
 const reservedCategories=new Set([...serverStructure.map(x=>x.category),'🔐 KELOLA KOMUNITAS','🗄️ BACKUP'].map(x=>x.toLowerCase()));
 const reservedChannels=new Set([...serverStructure.flatMap(x=>x.channels.map(c=>c.name)),'kelola-kategori','kelola-channel','terima-form','kelola-embed-welcome-member','kelola-member','edit-pesan-channel-awal','kelola-slash-command','pesan-dihapus','riwayat-chat']);
 const cats=new Set(),names=new Set();let total=0;
 const categories=input.categories.map(c=>{
  if(!c||typeof c.name!=='string'||c.name!==c.name.trim()||c.name.length<1||c.name.length>80||/[\u0000-\u001f\u007f]/.test(c.name))throw Error('Nama kategori harus 1–80 karakter tanpa karakter kontrol.');
  const key=c.name.toLowerCase();if(cats.has(key)||reservedCategories.has(key))throw Error('Nama kategori duplikat atau merupakan kategori bawaan.');cats.add(key);
  if(!Object.hasOwn(ranks,c.visibility)||!Array.isArray(c.channels)||c.channels.length<1||c.channels.length>5)throw Error('Kategori memerlukan 1–5 channel dan visibilitas yang valid.');
  const channels=c.channels.map(ch=>{
   if(!ch||typeof ch.name!=='string'||! /^[a-z0-9][a-z0-9_-]{0,79}$/.test(ch.name))throw Error('Nama channel hanya boleh huruf kecil, angka, - atau _, maksimal 80 karakter.');
   if(names.has(ch.name)||reservedChannels.has(ch.name))throw Error('Nama channel duplikat atau merupakan channel bawaan.');names.add(ch.name);
   if(!['text','voice'].includes(ch.type)||!Object.hasOwn(ranks,ch.visibility)||ranks[ch.visibility]<ranks[c.visibility])throw Error('Jenis/visibilitas tidak valid; channel tidak boleh lebih terbuka daripada kategorinya.');
   total++;return {name:ch.name,type:ch.type,visibility:ch.visibility};
  });return {name:c.name,visibility:c.visibility,channels};
 });
 if(total>20)throw Error('Maksimal 20 channel tambahan.');
 if(input.mode==='extra'&&!categories.length)throw Error('Tambahkan setidaknya satu kategori.');
 return {mode:input.mode,categories};
}
function permissions(guild,client,roles,visibility,type){
 const everyone=guild.roles.everyone.id,bot=client.user.id;
 const result=[{id:everyone,...(visibility==='public'?{allow:[F.ViewChannel]}:{deny:[F.ViewChannel]})}];
 if(type==='text'){
  result[0].deny=[...(result[0].deny||[]),F.SendMessages,F.SendMessagesInThreads,F.CreatePublicThreads,F.CreatePrivateThreads];
 }
 const allow=[F.ViewChannel];if(type==='text')allow.push(F.ReadMessageHistory,F.SendMessages,F.SendMessagesInThreads,F.EmbedLinks,F.AttachFiles,F.AddReactions);
 const intended=visibility==='owner'?['Owner']:['Owner',...STATUS_ROLES];
 for(const name of intended){const role=roles.find(r=>r.name===name&&r.id!==guild.id);if(!role)throw Error(`Role ${name} tidak ditemukan. Jalankan setup bawaan.`);result.push({id:role.id,allow});}
 result.push({id:bot,allow:[F.ViewChannel,...(type==='text'?[F.ReadMessageHistory,F.SendMessages,F.EmbedLinks,F.AttachFiles]:[])]});return result;
}
async function createExtras(guild,client,state,layout){
 const out={categories:0,channels:0,skipped:[],errors:[]};if(layout.mode!=='extra')return out;
 const roles=await guild.roles.fetch(),channels=await guild.channels.fetch();
 let records=(await state.readConfig(guild.id))?.customCategories||[];
 const ensureActive=()=>{if(!state.get(guild.id))throw Error('Server dinonaktifkan; pembuatan tambahan dihentikan.');};
 for(const group of layout.categories){
  try{
   ensureActive();let matches=channels.filter(c=>c?.type===ChannelType.GuildCategory&&c.name.toLowerCase()===group.name.toLowerCase());
   let category;
   if(matches.size){
    const record=records.find(r=>r.name===group.name&&r.visibility===group.visibility&&matches.has(r.id));
    if(matches.size!==1||!record){out.skipped.push(`Kategori ${group.name} sudah ada atau visibilitas berubah; tidak diubah.`);continue;}
    category=matches.get(record.id);
   }else{
    category=await guild.channels.create({name:group.name,type:ChannelType.GuildCategory,permissionOverwrites:permissions(guild,client,roles,group.visibility,'category'),reason:'Setup kategori tambahan sesuai konfigurasi dashboard'});
    channels.set(category.id,category);out.categories++;
    await state.recordCustomCategory(guild.id,{name:group.name,visibility:group.visibility,id:category.id});records.push({name:group.name,visibility:group.visibility,id:category.id});
   }
   for(const ch of group.channels){
    ensureActive();
    if(channels.some(c=>c?.name?.toLowerCase()===ch.name)){out.skipped.push(`Channel #${ch.name} sudah ada; tidak diubah.`);continue;}
    try{const created=await guild.channels.create({name:ch.name,type:ch.type==='text'?ChannelType.GuildText:ChannelType.GuildVoice,parent:category.id,permissionOverwrites:permissions(guild,client,roles,ch.visibility,ch.type),reason:'Setup channel tambahan sesuai konfigurasi dashboard'});channels.set(created.id,created);out.channels++;}
    catch(e){out.errors.push(`#${ch.name}: ${e.message}`);}
   }
  }catch(e){out.errors.push(`${group.name}: ${e.message}`);if(!state.get(guild.id))break;}
 }
 return out;
}
module.exports={emptyLayout,validateLayout,createExtras,permissions};
