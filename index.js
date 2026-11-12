const http = require('http');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActivityType,
  PermissionsBitField,
  MessageFlags,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

const { buildRulesAndRolePanel, handleRoleButtonInteraction } = require('./role');
const { SOCIAL_LINKS_BLOCK, runFullServerSetup } = require('./setup');

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
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

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

  // Registrasi Slash Commands (/setup-server & /panel-role) khusus Administrator
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName('setup-server')
        .setDescription('Reset & bangun ulang seluruh kategori, channel, role, dan AutoMod server')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .toJSON(),
      new SlashCommandBuilder()
        .setName('panel-role')
        .setDescription('Kirim ulang panel peraturan & tombol pilihan role pada kanal ini')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .toJSON(),
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[SLASH] Perintah /setup-server dan /panel-role berhasil terdaftar.');
  } catch (err) {
    console.error('[SLASH ERROR]', err.message);
  }

  // Ambil data server langsung dari API Discord (bukan cache lokal)
  let targetGuild = null;
  try {
    targetGuild =
      (GUILD_ID && (await client.guilds.fetch(GUILD_ID).catch(() => null))) ||
      client.guilds.cache.first();
  } catch (err) {
    console.error('[GUILD FETCH ERROR]', err.message);
  }

  if (!targetGuild) {
    console.warn('[INIT] Server target tidak ditemukan. Melewati pengecekan otomatis demi keamanan data.');
    return;
  }

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
      if (isSetupRunning) return;
      isSetupRunning = true;
      try {
        console.log('[INIT] Kanal #rules-and-role belum ada di server, menjalankan setup awal...');
        await runFullServerSetup(targetGuild, client);
      } finally {
        isSetupRunning = false;
      }
    } else {
      console.log('[SAFEGUARD] Struktur server sudah ada. Riwayat chat & channel aman (tidak di-reset).');

      // Sinkronisasi panel tombol interaktif 1 baris (Pekerja, Pelajar, Umum) di #rules-and-role
      const rulesCh = channels.find(
        (ch) => ch && ch.name === 'rules-and-role' && ch.isTextBased()
      );

      if (rulesCh) {
        const msgs = await rulesCh.messages.fetch({ limit: 10 }).catch(() => null);
        const hasUpdatedPanel = msgs?.some(
          (m) => m.author.id === client.user.id && m.components.length === 1
        );

        if (!hasUpdatedPanel) {
          const oldBotMsgs = msgs?.filter((m) => m.author.id === client.user.id);
          if (oldBotMsgs) {
            for (const [, oldMsg] of oldBotMsgs) {
              await oldMsg.delete().catch(() => {});
            }
          }
          await rulesCh.send(buildRulesAndRolePanel(targetGuild)).catch((err) => {
            console.error('[PANEL SEND ERROR]', err.message);
          });
          console.log('[PANEL] Panel tombol pilih role terbaru berhasil diperbarui di #rules-and-role.');
        }
      }
    }
  } catch (err) {
    // Jika terjadi gangguan koneksi API saat fetch channel, jangan lakukan reset apa pun
    console.error('[SAFEGUARD ERROR] Gagal memverifikasi channel saat startup (reset dibatalkan):', err.message);
  }
});

// =========================================================================
// 4. EVENT SAMBUTAN MEMBER BARU (WELCOME EMBED + AUTO ROLE MEMBER)
// =========================================================================
client.on('guildMemberAdd', async (member) => {
  try {
    // 1. Berikan role "Member" otomatis
    const memberRole = member.guild.roles.cache.find((r) => r.name === 'Member');
    if (memberRole) {
      await member.roles.add(memberRole).catch(() => {});
    }

    // 2. Cari kanal welcome (WELCOME_CHANNEL_ID -> #announcements -> systemChannel)
    const channels = await member.guild.channels.fetch().catch(() => member.guild.channels.cache);
    const welcomeChannel =
      (WELCOME_CHANNEL_ID && channels.get(WELCOME_CHANNEL_ID)) ||
      channels.find((ch) => ch && ch.name === 'announcements' && ch.isTextBased()) ||
      member.guild.systemChannel;

    if (!welcomeChannel) return;

    const rulesCh = channels.find((ch) => ch && ch.name === 'rules-and-role');
    const diskusiCh = channels.find((ch) => ch && ch.name === 'diskusi');
    const templateCh = channels.find((ch) => ch && ch.name === 'template-gratis');

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x0F172A)
      .setAuthor({
        name: 'AINUN IJLAL STUDIO • MEMBER ONBOARDING',
        iconURL: member.guild.iconURL({ dynamic: true }) || undefined,
      })
      .setTitle(`Selamat Datang, ${member.user.username}`)
      .setDescription(
        `Halo ${member}, terima kasih telah bergabung di komunitas resmi **Ainun Ijlal Studio**.\n\n` +
        '**Panduan Memulai:**\n' +
        `• **Verifikasi Role Status:** Pilih role status Anda pada ${rulesCh ? `${rulesCh}` : '`#rules-and-role`'} untuk membuka akses kirim pesan.\n` +
        `• **Diskusi Teknis:** Ajukan pertanyaan pemrograman dan desain pada ${diskusiCh ? `${diskusiCh}` : '`#diskusi`'}.\n` +
        `• **Aset & Resource:** Akses starter template gratis pada ${templateCh ? `${templateCh}` : '`#template-gratis`'}.\n\n` +
        '**Portofolio & Kanal Resmi:**\n' +
        '• Website: https://ainunijlal.com/\n' +
        '• Studio: https://studio.ainunijlal.com/\n' +
        SOCIAL_LINKS_BLOCK
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: 'Nama Pengguna', value: `\`${member.user.tag}\``, inline: true },
        { name: 'Anggota Ke', value: `**#${member.guild.memberCount}**`, inline: true },
        {
          name: 'Akun Dibuat',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:D>`,
          inline: true,
        }
      )
      .setFooter({
        text: `Ainun Ijlal Studio Community • User ID: ${member.id}`,
        iconURL: member.guild.iconURL({ dynamic: true }) || undefined,
      })
      .setTimestamp();

    await welcomeChannel.send({
      content: `Selamat datang di komunitas, ${member}.`,
      embeds: [welcomeEmbed],
    });
  } catch (error) {
    console.error('[WELCOME ERROR]', error);
  }
});

// =========================================================================
// 5. EVENT INTERAKSI (DELEGASI KE role.js & setup.js DENGAN VALIDASI IZIN)
// =========================================================================
client.on('interactionCreate', async (interaction) => {
  // 1. Tangani tombol pemilihan role di role.js
  if (interaction.isButton()) {
    await handleRoleButtonInteraction(interaction);
    return;
  }

  // 2. Tangani Slash Command
  if (!interaction.isChatInputCommand()) return;

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
      await interaction.followUp({
        content: '✅ Seluruh struktur server, embed pembuka, panel role, dan aturan AutoMod berhasil dibangun ulang!',
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

  if (interaction.commandName === 'panel-role') {
    await interaction.reply({
      content: '✅ Panel registrasi role telah dikirim ke kanal ini.',
      flags: MessageFlags.Ephemeral,
    });
    await interaction.channel.send(buildRulesAndRolePanel(interaction.guild));
  }
});

// =========================================================================
// 6. PENANGANAN ERROR GLOBAL
// =========================================================================
process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
});

client.login(TOKEN);