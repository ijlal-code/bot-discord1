'use strict';
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ComponentType,MessageFlags,PermissionsBitField}=require('discord.js');
const {isDisabled}=require('./features');
const {emptyLayout,validateLayout,createExtras}=require('./custom-layout');
function report(r){
 const lines=[`Akses: ${r.verified}/${r.checked} lokasi terverifikasi; ${r.updated} overwrite bot diperbarui.`];
 if(r.skipped.length||r.errors.length||!r.recognized)lines.push('⚠️ Belum semua akses terverifikasi. Pemilik: tambahkan akun bot (bukan role) dengan View Channel, Read Message History, Send Messages, Embed Links, Attach Files di kategori dan tiap channel tidak sinkron; hapus deny khusus bot. Bot membutuhkan Manage Channels dan Manage Roles.');
 if(r.skipped.length)lines.push(`Dilewati (${r.skipped.length}): `+r.skipped.slice(0,5).join(' | '));
 if(r.errors.length)lines.push(`Gagal (${r.errors.length}): `+r.errors.slice(0,5).join(' | '));
 return lines.join('\n');
}
async function handleSetup(i,{client,state,restoreAccess,setupServer,setupCommunity,isOwner,running}){
 await i.deferReply({flags:MessageFlags.Ephemeral});
 if(running.has(i.guildId))return i.editReply({content:'Setup sedang berjalan di server ini.'});
 const active=!!state.get(i.guildId),owner=i.guild.ownerId===i.user.id;
 if(!active)return i.editReply({content:'Server belum aktif. Pengelola layanan bot harus mengaktifkannya melalui dashboard terlebih dahulu.'});
 if(!i.memberPermissions?.has(PermissionsBitField.Flags.Administrator)||(!owner&&(!active||!isOwner(i))))return i.editReply({content:'Hanya pemilik server, atau role Owner dengan Administrator, yang boleh melakukan setup.'});
 let cfg;try{cfg=await state.readConfig(i.guildId);}catch{return i.editReply({content:'Tidak dapat memverifikasi pengaturan layanan. Periksa MongoDB.'});}
 if(isDisabled(cfg,'setup-server'))return i.editReply({content:'Perintah /setup-server dinonaktifkan oleh pengelola layanan bot.'});
 let layout;try{layout=validateLayout(cfg?.layout||emptyLayout());}catch{return i.editReply({content:'Konfigurasi struktur tidak valid. Pengelola harus memperbaikinya di dashboard.'});}
 const snapshot=JSON.stringify(layout);
 const layoutSummary=layout.mode==='extra'?`Bawaan + ${layout.categories.length} kategori tambahan (${layout.categories.map(c=>c.name).join(', ').slice(0,300)}).`:'Hanya struktur bawaan.';
 const row=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('recover-safe-setup').setLabel('Pulihkan akses').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('confirm-safe-setup').setLabel('Setup struktur').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('cancel-safe-setup').setLabel('Batal').setStyle(ButtonStyle.Secondary));
 await i.editReply({content:`Konfigurasi: **${layoutSummary}** Pengaturan tambahan ditentukan di dashboard penjual. Nama dan izin channel tambahan yang sudah ada tidak diubah.\n\nPilih **Pulihkan akses** untuk memeriksa dan memperbaiki izin bot, atau **Setup struktur** untuk membuat struktur bawaan dan tambahan yang belum ada. Setup dapat mengganti izin channel kelola, backup dan feedback serta welcome sistem Discord. Channel yang bot tidak bisa lihat mungkin terduplikasi; pastikan bot memiliki akses terlebih dahulu.`,components:[row],allowedMentions:{parse:[]}});
 const msg=await i.fetchReply();let confirmation;
 try{confirmation=await msg.awaitMessageComponent({componentType:ComponentType.Button,time:60000,filter:x=>x.user.id===i.user.id&&['recover-safe-setup','confirm-safe-setup','cancel-safe-setup'].includes(x.customId)});}catch{return i.editReply({content:'Konfirmasi kedaluwarsa; setup tidak dilakukan.',components:[]}).catch(()=>{});}
 if(confirmation.customId==='cancel-safe-setup')return confirmation.update({content:'Setup dibatalkan.',components:[]});
 if(running.has(i.guildId))return confirmation.update({content:'Setup sedang berjalan.',components:[]});
 running.add(i.guildId);
 try{
  await confirmation.update({content:'Memverifikasi dan memproses setup. Jangan hentikan bot.',components:[]});
  const current=await state.readConfig(i.guildId),nowActive=!!state.get(i.guildId),nowOwner=confirmation.guild.ownerId===confirmation.user.id;
  if(!nowActive||isDisabled(current,'setup-server')||!confirmation.memberPermissions?.has(PermissionsBitField.Flags.Administrator)||(!nowOwner&&(!nowActive||!isOwner(confirmation))))throw Error('Akses atau pengaturan perintah berubah. Setup dibatalkan.');
  if(JSON.stringify(validateLayout(current?.layout||emptyLayout()))!==snapshot)throw Error('Pengaturan struktur berubah. Jalankan /setup-server lagi untuk meninjau konfigurasi terbaru.');
  // Refetch actual effective access even for an already active server.
  const access=await restoreAccess(i.guild,client);
  if(confirmation.customId==='recover-safe-setup')return i.followUp({content:('✅ Server aktif. '+report(access)).slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  // Do not create potentially duplicate private setup when its category is not
  // visible but an Owner role already exists: ask for explicit visibility first.
  if(!access.recognized){const roles=await i.guild.roles.fetch();if(roles.some(r=>r.id!==i.guildId&&r.name==='Owner'))throw Error('Role Owner sudah ada tetapi kategori kelola tidak terlihat/aman. Untuk mencegah duplikat, beri bot akses kategori lama dulu, lalu pilih Pulihkan akses atau setup ulang.');}
  const x=await setupServer(i.guild,client,setupCommunity);
  const extras=await createExtras(i.guild,client,state,layout);
  const verified=await restoreAccess(i.guild,client);
  const extraReport=`Tambahan: ${extras.categories} kategori, ${extras.channels} channel dibuat.`+(extras.skipped.length?` Dilewati: ${extras.skipped.join(' | ')}.`:'')+(extras.errors.length?` Gagal: ${extras.errors.join(' | ')}.`:'');
  return i.followUp({content:(`✅ Struktur bawaan: ${x.createdRoles.length} role dan ${x.createdChannels.length} channel baru. ${x.warnings.join(' ')}\n${extraReport}\n`+report(verified)).slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
 }catch(e){return i.followUp({content:`❌ Setup belum selesai: ${e.message}. Jika server sudah aktif, status aktif dipertahankan. Pastikan bot dapat melihat channel privat, serta mempunyai Manage Channels dan Manage Roles.`,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}}).catch(()=>{});}finally{running.delete(i.guildId);}
}
module.exports={handleSetup,report};
