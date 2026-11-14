'use strict';
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ComponentType,MessageFlags,PermissionsBitField}=require('discord.js');
const {isDisabled}=require('./features');
function report(r){
 const lines=[`Akses: ${r.verified}/${r.checked} lokasi terverifikasi; ${r.updated} overwrite bot diperbarui.`];
 if(r.skipped.length||r.errors.length||!r.recognized)lines.push('⚠️ Belum semua akses terverifikasi. Pemilik: tambahkan akun bot (bukan role) dengan View Channel, Read Message History, Send Messages, Embed Links, Attach Files di kategori dan tiap channel tidak sinkron; hapus deny khusus bot. Bot membutuhkan Manage Channels dan Manage Roles.');
 if(r.skipped.length)lines.push(`Dilewati (${r.skipped.length}): `+r.skipped.slice(0,5).join(' | '));
 if(r.errors.length)lines.push(`Gagal (${r.errors.length}): `+r.errors.slice(0,5).join(' | '));
 return lines.join('\n');
}
async function handleSetup(i,{client,state,register,activateGuild,restoreAccess,setupServer,setupCommunity,isOwner,running}){
 await i.deferReply({flags:MessageFlags.Ephemeral});
 if(running.has(i.guildId))return i.editReply({content:'Setup sedang berjalan di server ini.'});
 const active=!!state.get(i.guildId),owner=i.guild.ownerId===i.user.id;
 if(!i.memberPermissions?.has(PermissionsBitField.Flags.Administrator)||(!owner&&(!active||!isOwner(i))))return i.editReply({content:'Hanya pemilik server, atau role Owner dengan Administrator pada server aktif, yang boleh melakukan setup. Untuk mengaktifkan server nonaktif, gunakan akun pemilik server.'});
 let cfg;try{cfg=await state.readConfig(i.guildId);}catch{return i.editReply({content:'Tidak dapat memverifikasi pengaturan layanan. Periksa MongoDB.'});}
 if(isDisabled(cfg,'setup-server'))return i.editReply({content:'Perintah /setup-server dinonaktifkan oleh pengelola layanan bot.'});
 const row=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('recover-safe-setup').setLabel('Pulihkan akses').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('confirm-safe-setup').setLabel('Setup struktur').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('cancel-safe-setup').setLabel('Batal').setStyle(ButtonStyle.Secondary));
 await i.editReply({content:'Pilih **Pulihkan akses** untuk mengaktifkan server dan memeriksa/memperbaiki izin bot pada channel setup yang terlihat; tidak membuat atau menghapus channel.\n\nPilih **Setup struktur** hanya untuk setup baru/ulang: membuat role dan channel yang belum terlihat, mengganti izin kategori/channel kelola, backup dan feedback serta mengubah welcome sistem Discord. **Channel yang bot tidak bisa lihat dapat dianggap belum ada dan menyebabkan duplikat.** Beri akses View Channel dulu jika server sudah pernah disiapkan.\n\nServer nonaktif akan diaktifkan setelah memilih salah satu tindakan.',components:[row]});
 const msg=await i.fetchReply();let confirmation;
 try{confirmation=await msg.awaitMessageComponent({componentType:ComponentType.Button,time:60000,filter:x=>x.user.id===i.user.id&&['recover-safe-setup','confirm-safe-setup','cancel-safe-setup'].includes(x.customId)});}catch{return i.editReply({content:'Konfirmasi kedaluwarsa; setup tidak dilakukan.',components:[]}).catch(()=>{});}
 if(confirmation.customId==='cancel-safe-setup')return confirmation.update({content:'Setup dibatalkan.',components:[]});
 if(running.has(i.guildId))return confirmation.update({content:'Setup sedang berjalan.',components:[]});
 running.add(i.guildId);
 try{
  await confirmation.update({content:'Memverifikasi dan memproses setup. Jangan hentikan bot.',components:[]});
  const current=await state.readConfig(i.guildId),nowActive=!!state.get(i.guildId),nowOwner=confirmation.guild.ownerId===confirmation.user.id;
  if(isDisabled(current,'setup-server')||!confirmation.memberPermissions?.has(PermissionsBitField.Flags.Administrator)||(!nowOwner&&(!nowActive||!isOwner(confirmation))))throw Error('Akses atau pengaturan perintah berubah. Setup dibatalkan.');
  if(!nowActive){const activation=await activateGuild(i.guild,register);if(activation.status!=='active')throw Error('Aktivasi lain masih berjalan; coba lagi.');}
  // Refetch actual effective access even for an already active server.
  const access=await restoreAccess(i.guild,client);
  if(confirmation.customId==='recover-safe-setup')return i.followUp({content:('✅ Server aktif. '+report(access)).slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  // Do not create potentially duplicate private setup when its category is not
  // visible but an Owner role already exists: ask for explicit visibility first.
  if(!access.recognized){const roles=await i.guild.roles.fetch();if(roles.some(r=>r.id!==i.guildId&&r.name==='Owner'))throw Error('Role Owner sudah ada tetapi kategori kelola tidak terlihat/aman. Untuk mencegah duplikat, beri bot akses kategori lama dulu, lalu pilih Pulihkan akses atau setup ulang.');}
  const x=await setupServer(i.guild,client,setupCommunity);
  const verified=await restoreAccess(i.guild,client);
  return i.followUp({content:(`✅ Server aktif. Struktur: ${x.createdRoles.length} role dan ${x.createdChannels.length} channel baru. ${x.warnings.join(' ')}\n`+report(verified)).slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
 }catch(e){return i.followUp({content:`❌ Setup belum selesai: ${e.message}. Jika server sudah aktif, status aktif dipertahankan. Pastikan bot dapat melihat channel privat, serta mempunyai Manage Channels dan Manage Roles.`,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}}).catch(()=>{});}finally{running.delete(i.guildId);}
}
module.exports={handleSetup,report};
