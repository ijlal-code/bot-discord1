'use strict';
const {Client,GatewayIntentBits,ActivityType,PermissionsBitField,MessageFlags,REST,ActionRowBuilder,ButtonBuilder,ButtonStyle,ComponentType}=require('discord.js');
const {STATUS_ROLES,buildRulesAndRolePanel,handleRoleButtonInteraction}=require('./role');
const {setup:setupServer}=require('./safe-setup');
const {reconcileAtStartup}=require('./startup-reconcile');
const {restoreAccess}=require('./restore-access');
const {isDisabled}=require('./features');
const {handleSetup}=require('./setup-command');
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
 // Startup reconciles newly invited/left guilds, without scanning permissions.
 console.log(`[INIT] ${state.active.size} server aktif dimuat.`);
 await reconcileAtStartup(client.guilds.cache.values(),{state});
});
client.on('guildCreate',async guild=>{if(!client.isReady())return;try{await state.markJoined(guild.id);console.log(`[GUILD ${guild.id}] Menunggu aktivasi dashboard.`);}catch(e){console.error(`[GUILD ${guild.id}] Gagal mencatat server: ${e.message}`);}});
client.on('guildDelete',async guild=>{try{await state.markLeft(guild.id);console.log('[GUILD] Bot keluar; pengaturan server disimpan.');}catch(e){console.error('[GUILD] Gagal menyimpan status keluar; periksa MongoDB.');}});
client.on('guildMemberAdd',async member=>{
 if(!state.get(member.guild.id)||state.get(member.guild.id).appliedMode==='new'||member.user.bot)return;
 try{await announceJoin(member,client);}catch(e){console.error('[WELCOME]',e.message);}
});
client.on('interactionCreate',async i=>{
 try{
  // The setup component collector owns these replies, even while the guild is inactive.
  if(i.isButton() && ['recover-safe-setup','confirm-safe-setup','cancel-safe-setup'].includes(i.customId))return;
  // Setup cannot activate an inactive server; the dashboard controls activation.
  if(i.guild && i.isChatInputCommand() && i.commandName==='setup-server'){
   await handleSetup(i,{client,state,restoreAccess,setupServer,setupCommunity,isOwner,running:setupRunning});return;
  }
  if(!i.guild || !state.get(i.guildId)){
   if(i.isChatInputCommand()||i.isMessageComponent()||i.isModalSubmit())await i.reply({content:'Server belum aktif. Pengelola layanan harus mengaktifkannya melalui dashboard terlebih dahulu.',flags:MessageFlags.Ephemeral}).catch(()=>{});
   return;
  }
  if(i.customId?.startsWith('community:')){await handleCommunityInteraction(i,client,i.guildId);return;}
  if(i.isButton()){
   if(i.customId.startsWith('select_role:'))await handleRoleButtonInteraction(i,async(member,role)=>{if(state.get(member.guild.id)&&state.get(member.guild.id).appliedMode!=='new'&&!member.user.bot)await welcomeAfterRole(member,client,role);});
   return;
  }
  if(!i.isChatInputCommand())return;
  if(isDisabled(state.get(i.guildId),i.commandName)){await i.reply({content:'Perintah ini sedang dinonaktifkan oleh pengelola layanan bot.',flags:MessageFlags.Ephemeral});return;}
  if(state.get(i.guildId).appliedMode==='new'&&['onboarding-member','setup-komunitas','kunci-chat','panel-role'].includes(i.commandName)){await i.reply({content:'Perintah ini memakai struktur bawaan dan tidak tersedia dalam mode Buat baru.',flags:MessageFlags.Ephemeral});return;}
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
  if(i.commandName==='kunci-chat'){
   await i.deferReply({flags:MessageFlags.Ephemeral});try{const x=await applyRoleLock(i.guild,client);await i.editReply(`Penguncian: ${x.checked} channel, ${x.errors.length} gagal.`);}catch(e){await i.editReply('Penguncian gagal: '+e.message);}return;
  }
  if(i.commandName==='panel-role'){await i.reply({content:'Panel role dikirim.',flags:MessageFlags.Ephemeral});await i.channel.send(buildRulesAndRolePanel(i.guild));}
 }catch(e){console.error('[INTERACTION]',e.message);await sendError(i,'Proses gagal. Periksa izin dan konfigurasi server.').catch(()=>{});}
});
client.on('channelCreate',async channel=>{if(!channel.guild||!state.get(channel.guild.id)||setupRunning.has(channel.guild.id))return;try{await lockNewChannel(channel,client);}catch(e){console.error('[ROLE LOCK]',e.message);}});
process.on('unhandledRejection',e=>console.error('[UNHANDLED]',e?.message||'unknown'));
(async()=>{try{await state.init();await client.login(token);}catch(e){console.error('[START ERROR]',e.message);await state.close().catch(()=>{});process.exit(1);}})();
