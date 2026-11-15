'use strict';
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ComponentType,MessageFlags,PermissionsBitField,AttachmentBuilder}=require('discord.js');
const {isDisabled}=require('./features');
const {emptyLayout,validateLayout,createExtras}=require('./custom-layout');
const {createNew}=require('./new-layout');
function report(r){
 const lines=[`Akses: ${r.verified}/${r.checked} lokasi terverifikasi; ${r.updated} overwrite bot diperbarui.`];
 if(r.skipped.length||r.errors.length||!r.recognized)lines.push('⚠️ Belum semua akses terverifikasi. Pemilik: tambahkan akun bot (bukan role) dengan View Channel, Read Message History, Send Messages, Embed Links, Attach Files di kategori dan tiap channel tidak sinkron; hapus deny khusus bot. Bot membutuhkan Manage Channels dan Manage Roles.');
 if(r.skipped.length)lines.push(`Dilewati (${r.skipped.length}): `+r.skipped.slice(0,5).join(' | '));
 if(r.errors.length)lines.push(`Gagal (${r.errors.length}): `+r.errors.slice(0,5).join(' | '));
 return lines.join('\n');
}
function describeNew(layout){
 const b=layout.builder,lines=['RINCIAN SETUP BARU — tinjau sebelum konfirmasi','Role server: '+(b.roles.map(r=>r.name).join(', ')||'(tidak ada)'),'Role baru tidak diberi izin server istimewa. Role yang sudah ada dipakai tanpa diubah.','Template Welcome & Info: '+(b.templates.welcome?'YA — publik, pesan statis, tanpa kirim untuk @everyone':'TIDAK'),'Template Kelola Komunitas: '+(b.templates.manage?'YA — hanya kelola-kategori, kelola-channel, edit-pesan-channel-awal; role Owner dapat mengakses':'TIDAK')];
 if(b.templates.welcome)lines.push('Pesan rules-and-role:',b.welcome.rulesTitle,b.welcome.rulesBody,'Pesan announcements:',b.welcome.announcementTitle,b.welcome.announcementBody);
 for(const c of b.categories){lines.push(`\nKategori ${c.name} | ${c.visibility} | role melihat: ${c.access.join(', ')||'-'}`);for(const ch of c.channels){lines.push(`  #${ch.name} | ${ch.type} | ${ch.visibility} | @everyone: ${JSON.stringify(ch.everyone)}`);for(const p of ch.permissions){if(p.view||p.denyView)lines.push(`    ${p.role}: lihat=${p.view?'izinkan':p.denyView?'tolak':'ikuti'}, kirim=${p.send}, riwayat=${p.history}, gabung=${p.connect}, bicara=${p.speak}`);}if(ch.body)lines.push(`  Pesan awal: ${ch.title}\n${ch.body}`);}}
 lines.push('\nBot hanya membuat yang belum ada; tidak mengubah channel atau kategori lama. Discord Administrator dapat melewati batasan.');return lines.join('\n');
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
 const layoutSummary=layout.mode==='new'?`Buat baru; ${layout.builder.categories.length} kategori kustom; template welcome ${layout.builder.templates.welcome?'dipilih':'tidak'}, template kelola ${layout.builder.templates.manage?'dipilih':'tidak'}.`:layout.mode==='extra'?`Bawaan + ${layout.categories.length} kategori tambahan (${layout.categories.map(c=>c.name).join(', ').slice(0,300)}).`:'Hanya struktur bawaan.';
 const row=new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('recover-safe-setup').setLabel('Pulihkan akses').setStyle(ButtonStyle.Primary),
  new ButtonBuilder().setCustomId('confirm-safe-setup').setLabel('Setup struktur').setStyle(ButtonStyle.Secondary),
  new ButtonBuilder().setCustomId('cancel-safe-setup').setLabel('Batal').setStyle(ButtonStyle.Secondary));
 await i.editReply({content:`Konfigurasi: **${layoutSummary}** Pengaturan ditentukan di dashboard penjual. Periksa rincian terlampir jika memilih mode baru. Role Owner lama dapat dimiliki orang lain; tinjau anggotanya sebelum memakai template pengelola.\n\nPilih **Pulihkan akses** untuk memeriksa dan memperbaiki izin bot, atau **Setup struktur** untuk membuat struktur sesuai mode yang dipilih. Mode bawaan dapat mengganti izin channel kelola, backup dan feedback serta welcome sistem Discord; mode baru tidak mengubah channel lama. Channel yang bot tidak bisa lihat mungkin terduplikasi; pastikan bot memiliki akses terlebih dahulu.`,components:[row],allowedMentions:{parse:[]},...(layout.mode==='new'?{files:[new AttachmentBuilder(Buffer.from(describeNew(layout),'utf8'),{name:'rincian-setup.txt'})]}:{})});
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
  if(layout.mode==='new'&&confirmation.customId==='confirm-safe-setup'){
   const created=await createNew(i.guild,client,state,layout);
   if(!created.errors.length&&!created.skipped.length)await state.setAppliedMode(i.guildId,'new');
   const modeInfo=(created.errors.length||created.skipped.length)?' Mode operasional tidak diganti karena ada bagian yang gagal atau dilewati; periksa hasil dan jalankan ulang.':' Mode baru aktif.';
   const info=`Buat baru: ${created.roles} role, ${created.categories} kategori, ${created.channels} channel dibuat.`+(created.skipped.length?` Dilewati: ${created.skipped.join(' | ')}.`:'')+(created.errors.length?` Gagal: ${created.errors.join(' | ')}.`:'')+modeInfo;
   return i.followUp({content:info.slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  }
  const access=await restoreAccess(i.guild,client);
  if(confirmation.customId==='recover-safe-setup')return i.followUp({content:('✅ Server aktif. '+report(access)).slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
  // Do not create potentially duplicate private setup when its category is not
  // visible but an Owner role already exists: ask for explicit visibility first.
  if(!access.recognized){const roles=await i.guild.roles.fetch();if(roles.some(r=>r.id!==i.guildId&&r.name==='Owner'))throw Error('Role Owner sudah ada tetapi kategori kelola tidak terlihat/aman. Untuk mencegah duplikat, beri bot akses kategori lama dulu, lalu pilih Pulihkan akses atau setup ulang.');}
  const x=await setupServer(i.guild,client,setupCommunity);
  const extras=await createExtras(i.guild,client,state,layout);
  await state.setAppliedMode(i.guildId,'default');
  const verified=await restoreAccess(i.guild,client);
  const extraReport=`Tambahan: ${extras.categories} kategori, ${extras.channels} channel dibuat.`+(extras.skipped.length?` Dilewati: ${extras.skipped.join(' | ')}.`:'')+(extras.errors.length?` Gagal: ${extras.errors.join(' | ')}.`:'');
  return i.followUp({content:(`✅ Struktur bawaan: ${x.createdRoles.length} role dan ${x.createdChannels.length} channel baru. ${x.warnings.join(' ')}\n${extraReport}\n`+report(verified)).slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});
 }catch(e){return i.followUp({content:`❌ Setup belum selesai: ${e.message}. Jika server sudah aktif, status aktif dipertahankan. Pastikan bot dapat melihat channel privat, serta mempunyai Manage Channels dan Manage Roles.`,flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}}).catch(()=>{});}finally{running.delete(i.guildId);}
}
module.exports={handleSetup,report};
