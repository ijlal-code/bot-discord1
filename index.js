const http = require('http');
const { Client, GatewayIntentBits, EmbedBuilder, ActivityType } = require('discord.js');

// ============================================================
// 1. SERVER HTTP MINI (WAJIB UNTUK RENDER WEB SERVICE)
// ============================================================
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
  console.log(`[HTTP] Server health-check berjalan di port ${PORT}`);
});

// ============================================================
// 2. KONFIGURASI BOT DISCORD
// ============================================================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Wajib diaktifkan juga di Discord Developer Portal
  ],
});

const TOKEN = process.env.DISCORD_TOKEN;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;

if (!TOKEN) {
  console.error('[ERROR] DISCORD_TOKEN belum diatur di Environment Variables!');
  process.exit(1);
}

// ============================================================
// 3. EVENT SAAT BOT ONLINE
// ============================================================
client.once('ready', () => {
  console.log(`[DISCORD] Bot berhasil login sebagai ${client.user.tag}`);

  // Mengatur status aktivitas bot
  client.user.setActivity('Member Baru 👋', { type: ActivityType.Watching });
});

// ============================================================
// 4. EVENT OTOMATIS SAAT MEMBER BARU BERGABUNG
// ============================================================
client.on('guildMemberAdd', async (member) => {
  try {
    if (!WELCOME_CHANNEL_ID) {
      console.warn('[WARN] WELCOME_CHANNEL_ID belum diatur.');
      return;
    }

    const channel =
      member.guild.channels.cache.get(WELCOME_CHANNEL_ID) ||
      (await member.guild.channels.fetch(WELCOME_CHANNEL_ID));

    if (!channel) {
      console.error(`[ERROR] Channel dengan ID ${WELCOME_CHANNEL_ID} tidak ditemukan.`);
      return;
    }

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#4e9af1')
      .setTitle(`Selamat Datang di ${member.guild.name}!`)
      .setDescription(
        `Halo ${member}, selamat datang dan selamat bergabung di server kami!\n\n` +
        `• Pastikan membaca **Peraturan Server** terlebih dahulu.\n` +
        `• Ambil **Role** kamu agar bisa mengakses semua channel.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        {
          name: '👤 Username',
          value: `\`${member.user.username}\``,
          inline: true,
        },
        {
          name: '📊 Member Ke',
          value: `**#${member.guild.memberCount}**`,
          inline: true,
        },
        {
          name: '📅 Akun Dibuat',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        }
      )
      .setFooter({
        text: `User ID: ${member.id}`,
        iconURL: member.guild.iconURL({ dynamic: true }) || undefined,
      })
      .setTimestamp();

    await channel.send({
      content: `Halo ${member}, selamat datang! 🎉`,
      embeds: [welcomeEmbed],
    });

    console.log(`[WELCOME] Pesan terkirim untuk ${member.user.tag}`);
  } catch (error) {
    console.error('[ERROR] Gagal mengirim pesan welcome:', error);
  }
});

// ============================================================
// 5. PENANGANAN ERROR AGAR BOT TIDAK CRASH
// ============================================================
process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
});

client.login(TOKEN);