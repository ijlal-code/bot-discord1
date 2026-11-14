'use strict';
const {Client,GatewayIntentBits,ActivityType,PermissionsBitField,MessageFlags,REST,ActionRowBuilder,ButtonBuilder,ButtonStyle,ComponentType}=require('discord.js');
const {STATUS_ROLES,buildRulesAndRolePanel,handleRoleButtonInteraction}=require('./role');
const {setup:setupServer}=require('./safe-setup');
const {activateGuild}=require('./auto-activate');
const {applyRoleLock,lockNewChannel}=require('./role-lock');
const {setupCommunity,handleCommunityInteraction,isOwner,getOwnerRole,sendError}=require('./community');
const {announceJoin,welcomeAfterRole,buildMemberOnboarding}=require('./welcome');
const {handleMemberCommand}=require('./member-management');
const {deleteCommand}=require('./backup');
const {registerCommands,registerGlobal}=require('./register-commands');
const state=require('./state'),web=require('./web-auth');
const token=process.env.DISCORD_TOKEN;
if(!token){console.error('[CONFIG] DISCORD_TOKEN wajib diatur di Render.');process.exit(1);}
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent,GatewayIntentBits.GuildMembers]});
const setupRunning=new Set();
const rest=new REST({version:'10'}).setToken(token);
const register=id=>registerCommands(rest,client.user.id,id);
client.once('clientReady',async()=>{
 console.log(`[DISCORD] Aktif sebagai ${client.user.tag}`);
 client.user.setActivity('komunitas', {type:ActivityType.Watching});
 try{const globalResult=await registerGlobal(rest,client.user.id);if(globalResult.errors.length)console.error('[SLASH GLOBAL] Sebagian registrasi gagal:',globalResult.errors.join('; '));}catch(e){console.error('[SLASH GLOBAL] Registrasi gagal:',e.message);}
 try{web.start(client,register);}catch(e){console.error('[CONFIG]',e.message);process.exit(1);}
 // Jangan mengubah role, channel, atau izin Discord secara otomatis saat startup.
 console.log(`[INIT] ${state.active.size} server aktif dimuat.`);
 // Server yang sudah dinonaktifkan tidak diaktifkan ulang saat restart.
 for(const guild of client.guilds.cache.values()){try{await activateGuild(guild,register,{onlyNew:true});}catch(e){console.warn(`[AKTIVASI ${guild.id}] ${e.message}`);}}
});
client.on('guildCreate',async guild=>{if(!client.isReady())return;try{await activateGuild(guild,register);console.log(`[GUILD ${guild.id}] Terdaftar otomatis.`);}catch(e){console.error(`[GUILD ${guild.id}] Aktivasi gagal: ${e.message}`);}});
client.on('guildDelete',async guild=>{if(state.get(guild.id))try{await state.deactivate(guild.id);console.log('[GUILD] Server dinonaktifkan setelah bot keluar.');}catch(e){console.error('[GUILD] Gagal menyimpan penonaktifan; periksa MongoDB.');}});
client.on('guildMemberAdd',async member=>{
 if(!state.get(member.guild.id)||member.user.bot)return;
 try{await announceJoin(member,client);}catch(e){console.error('[WELCOME]',e.message);}
});
client.on('interactionCreate',async i=>{
 try{
  if(!i.guild || !state.get(i.guildId)){
   if(i.isChatInputCommand()||i.isMessageComponent()||i.isModalSubmit())await i.reply({content:'Server belum aktif. Tunggu aktivasi otomatis atau minta pengelola mengaktifkan ulang di dashboard.',flags:MessageFlags.Ephemeral}).catch(()=>{});
   return;
  }
  if(i.customId?.startsWith('community:')){await handleCommunityInteraction(i,client,i.guildId);return;}
  if(i.isButton()){
   if(i.customId.startsWith('select_role:'))await handleRoleButtonInteraction(i,async(member,role)=>{if(state.get(member.guild.id)&&!member.user.bot)await welcomeAfterRole(member,client,role);});
   return;
  }
  if(!i.isChatInputCommand())return;
  if(i.commandName==='onboarding-member'){
   const cfg=state.get(i.guildId);
   if(!isOwner(i)&&(!cfg.enabledMemberCommands?.includes('onboarding-member')||i.channelId!==cfg.discussionId)){await i.reply({content:'Perintah ini belum diaktifkan untuk member di channel ini.',flags:MessageFlags.Ephemeral});return;}
   await handleMemberCommand(i,client,i.guildId,{isOwner,statusRoles:STATUS_ROLES,buildMemberOnboarding});return;
  }
  if(!isOwner(i)){await i.reply({content:'Perintah ini khusus role Owner.',flags:MessageFlags.Ephemeral});return;}
  if(i.commandName==='hapus-pesan'){await deleteCommand(i,client,i.guildId,isOwner,getOwnerRole);return;}
  if(i.commandName==='setup-komunitas'){
   await i.deferReply({flags:MessageFlags.Ephemeral});
   try{const x=await setupCommunity(i.guild,client);await i.editReply({content:`✅ Panel privat siap: ${x.manage}, ${x.manageChannels}, ${x.slash}, ${x.welcome}, ${x.member}, ${x.messageEditor}, ${x.inbox}. ${x.feedbackWarning||''} ${x.welcomeWarning||''}`,allowedMentions:{parse:[]}});}catch(e){await i.editReply('❌ Setup gagal: '+e.message);}
   return;
  }
  if(!i.memberPermissions?.has(PermissionsBitField.Flags.Administrator)){await i.reply({content:'Perintah ini memerlukan role Owner dan izin Administrator.',flags:MessageFlags.Ephemeral});return;}
  if(i.commandName==='setup-server'){
   if(setupRunning.has(i.guildId)){await i.reply({content:'Setup sedang berjalan di server ini.',flags:MessageFlags.Ephemeral});return;}
   const controls=new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('confirm-safe-setup').setLabel('Lanjutkan setup').setStyle(ButtonStyle.Primary),new ButtonBuilder().setCustomId('cancel-safe-setup').setLabel('Batal').setStyle(ButtonStyle.Secondary));
   await i.reply({content:'Setup akan membuat role, kategori, dan channel yang belum ada serta mencoba memberikan role Owner kepada pemilik. Data lama tidak dihapus. **Izin khusus kategori/channel kelola, backup dan #feedback-and-request akan diganti, serta welcome sistem Discord diubah**; periksa terlebih dahulu.',components:[controls],flags:MessageFlags.Ephemeral});
   const msg=await i.fetchReply();let confirmation;
   try{confirmation=await msg.awaitMessageComponent({componentType:ComponentType.Button,time:60000,filter:x=>x.user.id===i.user.id&&['confirm-safe-setup','cancel-safe-setup'].includes(x.customId)});}catch{await i.editReply({content:'Konfirmasi kedaluwarsa; setup tidak dilakukan.',components:[]}).catch(()=>{});return;}
   if(confirmation.customId==='cancel-safe-setup'){await confirmation.update({content:'Setup dibatalkan.',components:[]});return;}
   if(!state.get(i.guildId)||!isOwner(confirmation)||!confirmation.memberPermissions?.has(PermissionsBitField.Flags.Administrator)||setupRunning.has(i.guildId)){await confirmation.update({content:'Setup dibatalkan: akses berubah atau setup sedang berjalan.',components:[]});return;}
   setupRunning.add(i.guildId);
   try{await confirmation.update({content:'Setup sedang berjalan. Jangan hentikan bot.',components:[]});const x=await setupServer(i.guild,client,setupCommunity);const info=`Selesai: ${x.createdRoles.length} role dan ${x.createdChannels.length} channel baru. ${x.warnings.join(' ')} Channel lama tidak diubah selain izin kelola, backup, feedback, dan pengaturan welcome sistem Discord.`;await i.followUp({content:info.slice(0,1900),flags:MessageFlags.Ephemeral,allowedMentions:{parse:[]}});}catch(e){await i.followUp({content:'Setup belum selesai: '+e.message,flags:MessageFlags.Ephemeral});}finally{setupRunning.delete(i.guildId);}return;
  }
  if(i.commandName==='kunci-chat'){
   await i.deferReply({flags:MessageFlags.Ephemeral});try{const x=await applyRoleLock(i.guild,client);await i.editReply(`Penguncian: ${x.checked} channel, ${x.errors.length} gagal.`);}catch(e){await i.editReply('Penguncian gagal: '+e.message);}return;
  }
  if(i.commandName==='panel-role'){await i.reply({content:'Panel role dikirim.',flags:MessageFlags.Ephemeral});await i.channel.send(buildRulesAndRolePanel(i.guild));}
 }catch(e){console.error('[INTERACTION]',e.message);await sendError(i,'Proses gagal. Periksa izin dan konfigurasi server.').catch(()=>{});}
});
client.on('channelCreate',async channel=>{if(!channel.guild||!state.get(channel.guild.id)||setupRunning.has(channel.guild.id))return;try{await lockNewChannel(channel,client);}catch(e){console.error('[ROLE LOCK]',e.message);}});
process.on('unhandledRejection',e=>console.error('[UNHANDLED]',e?.message||'unknown'));
(async()=>{try{await state.init();await client.login(token);}catch(e){console.error('[START ERROR]',e.message);await state.close().catch(()=>{});process.exit(1);}})();
