const http = require('http');
const {
  Client,
  GatewayIntentBits,
  ActivityType,
  PermissionsBitField,
  MessageFlags,
  REST,
} = require('discord.js');

const { STATUS_ROLES, buildRulesAndRolePanel, handleRoleButtonInteraction } = require('./role');
const { runFullServerSetup } = require('./setup');
const { applyRoleLock, lockNewChannel } = require('./role-lock');
const { setupCommunity, handleCommunityInteraction, isOwner, sendError } = require('./community');
const { announceJoin, welcomeAfterRole, suppressSystemWelcome, buildMemberOnboarding } = require('./welcome');
const { handleMemberCommand } = require('./member-management');
const { registerCommands } = require('./register-commands');

// =========================================================================
// 1. SERVER HTTP MINI (HEALTH-CHECK RENDER 24 JAM)
// =========================================================================
const PORT = process.env.PORT || 3000;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(
    JSON.stringify({
      status: 'online',
      bot: client.user ? client.user.tag : 'Starting...',
      uptime: Math.floor(process.uptime()) + 's',
    })
  );
});

server.listen(PORT, () => {
  console.log(`[HTTP] Server health-check aktif pada port ${PORT}`);
});

// =========================================================================
// 2. KONFIGURASI ENVIRONMENT & CLIENT
// =========================================================================
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1569980330629275819';
if (!process.env.GUILD_ID) console.warn(`[CONFIG] GUILD_ID belum diatur; menggunakan ID lama ${GUILD_ID}. Pastikan ini ID server yang benar.`);

if (!TOKEN) {
  console.error('[ERROR] Variabel DISCORD_TOKEN belum diatur pada Environment Render.');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Wajib aktif di Discord Developer Portal
  ],
});

// Pengaman agar proses setup tidak pernah berjalan dua kali secara bersamaan
let isSetupRunning = false;

// =========================================================================
// 3. EVENT SAAT BOT AKTIF (clientReady) DENGAN VALIDASI API LANGSUNG
// =========================================================================
client.once('clientReady', async () => {
  console.log(`[DISCORD] Bot aktif sebagai ${client.user.tag}`);
  client.user.setActivity('Ainun Ijlal Studio', { type: ActivityType.Watching });

  // /setup-komunitas dan /onboarding-member didaftarkan sebagai guild command
  // agar muncul lebih cepat pada server yang ditentukan oleh GUILD_ID.
  try {
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    const registration = await registerCommands(rest, client.user.id, GUILD_ID);
    if (registration.errors.length) console.warn(`[SLASH] ${registration.errors.length} masalah registrasi; periksa [SLASH ERROR] di log.`);
  } catch (err) {
    console.error('[SLASH ERROR] Registrasi slash command gagal:', err.message);
  }

  // Ambil data server langsung dari API Discord (bukan cache lokal)
  let targetGuild = null;
  try {
    targetGuild =
      GUILD_ID && (await client.guilds.fetch(GUILD_ID).catch(() => null));
  } catch (err) {
    console.error('[GUILD FETCH ERROR]', err.message);
  }

  if (!targetGuild) {
    console.warn('[INIT] Server target tidak ditemukan. Melewati pengecekan otomatis demi keamanan data.');
    return;
  }

  try { await suppressSystemWelcome(targetGuild); }
  catch (err) { console.warn('[WELCOME SYSTEM] Gagal mematikan pesan join bawaan Discord:', err.message); }

  try {
    // Wajib fetch() langsung ke API Discord agar daftar channel akurat 100%
    const channels = await targetGuild.channels.fetch();

    // Pengaman ekstra: jika hasil fetch kosong/gagal, JANGAN jalankan reset otomatis
    if (!channels || channels.size === 0) {
      console.warn('[SAFEGUARD] Daftar channel kosong dari API, membatalkan pengecekan setup otomatis.');
      return;
    }

    const hasRulesChannel = channels.some((ch) => ch && ch.name === 'rules-and-role');

    if (!hasRulesChannel) {
      // Jangan pernah menghapus channel/role secara otomatis saat startup.
      console.warn('[INIT] #rules-and-role belum ada. Buat panel dan role dahulu; setup ulang hanya melalui /setup-server.');
    } else {
      console.log('[SAFEGUARD] Struktur server sudah ada. Riwayat chat & channel aman (tidak di-reset).');
      try {
        const result = await applyRoleLock(targetGuild, client);
        console.log(`[ROLE LOCK] ${result.checked} kanal diperiksa; ${result.errors.length} gagal.`);
      } catch (error) {
        console.error('[ROLE LOCK] Penguncian dibatalkan:', error.message);
      }

      // Sinkronisasi panel tombol interaktif 1 baris (Pekerja, Pelajar, Umum) di #rules-and-role
      const rulesCh = channels.find(
        (ch) => ch && ch.name === 'rules-and-role' && ch.isTextBased()
      );

      if (rulesCh) {
        const msgs = await rulesCh.messages.fetch({ limit: 10 }).catch(() => null);
        const hasUpdatedPanel = msgs?.some(m => m.author.id === client.user.id && m.components.some(row => row.components.some(c => c.customId?.startsWith('select_role:'))));
        if (!hasUpdatedPanel) {
          await rulesCh.send(buildRulesAndRolePanel(targetGuild)).catch(err => console.error('[PANEL SEND ERROR]', err.message));
          console.log('[PANEL] Panel role disiapkan tanpa menghapus pesan lain.');
        }
      }
    }
  } catch (err) {
    // Jika terjadi gangguan koneksi API saat fetch channel, jangan lakukan reset apa pun
    console.error('[SAFEGUARD ERROR] Gagal memverifikasi channel saat startup (reset dibatalkan):', err.message);
  }
});

// =========================================================================
// 4. EVENT SAMBUTAN MEMBER BARU (TANPA AUTO ROLE)
// =========================================================================
client.on('guildMemberAdd', async (member) => {
  if (member.guild.id !== GUILD_ID || member.user.bot) return;
  try {
    // Tidak ada DM atau auto-role. Embed welcome ke #diskusi saat bergabung.
    await announceJoin(member, client);
  } catch (error) {
    console.error('[WELCOME JOIN ERROR]', error);
  }
});

// =========================================================================
// 5. EVENT INTERAKSI (DELEGASI KE role.js & setup.js DENGAN VALIDASI IZIN)
// =========================================================================
client.on('interactionCreate', async (interaction) => {
  // Interaksi panel kategori dan form harus ditangani sebelum tombol role.
  if (interaction.customId?.startsWith('community:')) {
    try {
      await handleCommunityInteraction(interaction, client, GUILD_ID);
    } catch (error) {
      console.error('[COMMUNITY ERROR]', error);
      await sendError(interaction, `❌ Proses gagal: ${error.message}`).catch(() => {});
    }
    return;
  }

  // 1. Tangani tombol pemilihan role di role.js
  if (interaction.isButton()) {
    await handleRoleButtonInteraction(interaction, async (member, role) => {
      if (member.guild.id === GUILD_ID && !member.user.bot) await welcomeAfterRole(member, client, role);
    });
    return;
  }

  // 2. Tangani Slash Command
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'onboarding-member') {
    await handleMemberCommand(interaction, client, GUILD_ID, { isOwner, statusRoles: STATUS_ROLES, buildMemberOnboarding });
    return;
  }

  // Panel ini hanya bisa dipasang anggota role Owner, termasuk jika bukan Administrator.
  if (interaction.commandName === 'setup-komunitas') {
    if (!interaction.guild || interaction.guildId !== GUILD_ID || !isOwner(interaction)) {
      await interaction.reply({ content: '⛔ Gunakan pada server GUILD_ID yang benar dengan role Owner (atau role pada OWNER_ROLE_ID). Pemilik server tetap harus memiliki role tersebut.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const result = await setupCommunity(interaction.guild, client);
      const feedbackText = result.feedbackWarning ? `⚠️ ${result.feedbackWarning}` : `Formulir tersedia di ${result.feedback}.`;
      await interaction.editReply({ content: `✅ Kanal privat siap: ${result.manage}, ${result.manageChannels}, ${result.welcome}, ${result.member}, ${result.messageEditor}, dan ${result.inbox}. ${feedbackText}${result.welcomeWarning ? ` ⚠️ ${result.welcomeWarning}` : ''}`, allowedMentions: { parse: [] } });
    } catch (error) {
      console.error('[SETUP KOMUNITAS ERROR]', error);
      await interaction.editReply({ content: `❌ Setup belum selesai: ${error.message}. Periksa izin bot lalu jalankan ulang /setup-komunitas.` });
    }
    return;
  }

  // Validasi keamanan sisi server: pastikan eksekutor benar-benar memiliki izin Administrator
  if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({
      content: '⛔ Akses ditolak: Perintah ini hanya dapat dijalankan oleh Administrator atau Owner server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.commandName === 'setup-server') {
    if (isSetupRunning) {
      await interaction.reply({
        content: '⏳ Proses reset & setup server sedang berjalan. Harap tunggu hingga selesai.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    isSetupRunning = true;
    await interaction.reply({
      content: '⏳ Sedang menjalankan reset & pembuatan ulang seluruh role, kategori, channel, dan AutoMod. Mohon tunggu sekitar 15–30 detik...',
      flags: MessageFlags.Ephemeral,
    });

    try {
      await runFullServerSetup(interaction.guild, client);
      const lockResult = await applyRoleLock(interaction.guild, client);
      await interaction.followUp({
        content: lockResult.errors.length
          ? `⚠️ Setup selesai, tetapi penguncian gagal pada ${lockResult.errors.length} kanal: ${lockResult.errors.join('; ').slice(0, 1200)}`
          : '✅ Setup selesai dan izin wajib pilih role telah diterapkan. Jalankan /setup-komunitas untuk memasang panel dan formulir.',
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    } catch (err) {
      console.error('[SETUP COMMAND ERROR]', err);
      await interaction.followUp({
        content: `❌ Terjadi kesalahan saat menjalankan setup: ${err.message}`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    } finally {
      isSetupRunning = false;
    }
    return;
  }

  if (interaction.commandName === 'kunci-chat') {
    if (interaction.guildId !== GUILD_ID) {
      await interaction.reply({ content: 'Perintah ini hanya tersedia pada server GUILD_ID yang dikonfigurasi.', flags: MessageFlags.Ephemeral });
      return;
    }
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
      const result = await applyRoleLock(interaction.guild, client);
      await interaction.editReply({ content: result.errors.length
        ? `⚠️ ${result.checked} kanal diperiksa; ${result.errors.length} gagal: ${result.errors.join('; ').slice(0, 1200)}`
        : `✅ Penguncian diterapkan pada ${result.checked} kanal tanpa menghapus channel atau role.` });
    } catch (error) {
      await interaction.editReply({ content: `❌ Penguncian dibatalkan: ${error.message}` });
    }
    return;
  }

  if (interaction.commandName === 'panel-role') {
    await interaction.reply({
      content: '✅ Panel registrasi role telah dikirim ke kanal ini.',
      flags: MessageFlags.Ephemeral,
    });
    await interaction.channel.send(buildRulesAndRolePanel(interaction.guild));
  }
});

// Kanal baru juga dikunci; thread mengikuti permission channel induknya.
client.on('channelCreate', async (channel) => {
  if (!channel.guild || channel.guild.id !== GUILD_ID || isSetupRunning) return;
  try {
    await lockNewChannel(channel, client);
  } catch (error) {
    console.error(`[ROLE LOCK] Kanal baru ${channel.name}: ${error.message}`);
  }
});

// =========================================================================
// 6. PENANGANAN ERROR GLOBAL
// =========================================================================
process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
});

client.login(TOKEN);