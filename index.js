const http = require('http');
const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

// =========================================================================
// 1. SERVER HTTP MINI (WAJIB UNTUK RENDER WEB SERVICE 24 JAM)
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
  console.log(`[HTTP] Server health-check berjalan di port ${PORT}`);
});

// =========================================================================
// 2. KONFIGURASI BOT & ENVIRONMENT VARIABLES
// =========================================================================
const TOKEN = process.env.DISCORD_TOKEN;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID; // Opsional (fallback ke #announcements)
const RULES_CHANNEL_ID = process.env.RULES_CHANNEL_ID;     // Opsional (fallback ke #rules-and-role)

if (!TOKEN) {
  console.error('[ERROR] DISCORD_TOKEN belum diatur di Environment Variables Render!');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // Wajib aktif di Discord Developer Portal
  ],
});

// Daftar Role Status (Eksklusif: memilih satu akan mengganti status sebelumnya)
const STATUS_ROLES = ['Pekerja', 'Pelajar', 'Umum'];

// Daftar Role Keahlian / Bidang (Toggle: bisa memilih lebih dari satu)
const SKILL_ROLES = ['Frontend Developer', 'Backend Developer', 'UI/UX Designer'];

// =========================================================================
// 3. BUILDER PANEL ONBOARDING & SELF-ROLE
// =========================================================================
function buildOnboardingMessage() {
  const embed = new EmbedBuilder()
    .setColor(0x3498DB)
    .setTitle('📌 Peraturan Komunitas & Pemilihan Role')
    .setDescription(
      'Selamat datang di komunitas resmi **Ainun Ijlal Studio**! Demi menjaga lingkungan diskusi tetap sehat dan produktif, harap patuhi tata tertib berikut:\n\n' +
      '1. **Saling Menghargai:** Jaga etika diskusi yang konstruktif, sopan, dan bebas dari SARA/ujaran kebencian.\n' +
      '2. **Gunakan Kanal Sesuai Topik:** Ajukan pertanyaan coding di `#diskusi` dan masukan ide di `#feedback-and-request`.\n' +
      '3. **Dilarang Spam & Phishing:** Dilarang mengirim pesan berulang, promosi tanpa izin, maupun tautan mencurigakan.\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
      '**🎭 Langkah 1 — Pilih Role Status (Pilih Salah Satu):**\n' +
      'Klik tombol di bawah sesuai kesibukan kamu saat ini (**Pekerja**, **Pelajar**, atau **Umum**).\n\n' +
      '**💻 Langkah 2 — Pilih Role Bidang / Minat (Bisa Lebih dari Satu):**\n' +
      'Klik tombol di baris kedua untuk memasang atau melepas role keahlian kamu.'
    )
    .setFooter({ text: 'Ainun Ijlal Studio Community • Klik tombol di bawah untuk mengambil role' });

  // Baris 1: Tombol Status (Eksklusif)
  const rowStatus = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_status:Pekerja')
      .setLabel('Pekerja')
      .setEmoji('💼')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId('role_status:Pelajar')
      .setLabel('Pelajar')
      .setEmoji('🎓')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('role_status:Umum')
      .setLabel('Umum')
      .setEmoji('🌐')
      .setStyle(ButtonStyle.Secondary)
  );

  // Baris 2: Tombol Bidang / Skill (Toggle)
  const rowSkill = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('role_skill:Frontend Developer')
      .setLabel('Frontend Dev')
      .setEmoji('🎨')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('role_skill:Backend Developer')
      .setLabel('Backend Dev')
      .setEmoji('⚙️')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('role_skill:UI/UX Designer')
      .setLabel('UI/UX Designer')
      .setEmoji('✨')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [rowStatus, rowSkill] };
}

// =========================================================================
// 4. EVENT SAAT BOT SIAP (clientReady)
// =========================================================================
client.once('clientReady', async () => {
  console.log(`[DISCORD] Bot berhasil login sebagai ${client.user.tag}`);
  client.user.setActivity('Ainun Ijlal Studio 👋', { type: ActivityType.Watching });

  // Daftarkan Slash Command /setup-roles secara otomatis
  try {
    const commands = [
      new SlashCommandBuilder()
        .setName('setup-roles')
        .setDescription('Kirim panel tombol pilih role ke channel ini (Khusus Admin)')
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
        .toJSON(),
    ];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    console.log('[SLASH] Perintah /setup-roles berhasil terdaftar.');
  } catch (err) {
    console.error('[SLASH ERROR] Gagal mendaftarkan slash command:', err.message);
  }

  // Otomatis pastikan panel tombol pilih role sudah ada di #rules-and-role
  for (const [, guild] of client.guilds.cache) {
    try {
      const rulesChannel =
        (RULES_CHANNEL_ID && guild.channels.cache.get(RULES_CHANNEL_ID)) ||
        guild.channels.cache.find((ch) => ch.name === 'rules-and-role' && ch.isTextBased());

      if (rulesChannel) {
        const recentMessages = await rulesChannel.messages.fetch({ limit: 10 });
        const hasBotButtonPanel = recentMessages.some(
          (msg) => msg.author.id === client.user.id && msg.components.length > 0
        );

        if (!hasBotButtonPanel) {
          // Bersihkan pesan embed statis lama milik bot (jika ada) lalu kirim versi interaktif
          const oldBotMessages = recentMessages.filter((msg) => msg.author.id === client.user.id);
          for (const [, oldMsg] of oldBotMessages) {
            await oldMsg.delete().catch(() => {});
          }

          await rulesChannel.send(buildOnboardingMessage());
          console.log(`[ONBOARDING] Panel tombol pilih role dikirim ke #${rulesChannel.name}`);
        }
      }
    } catch (err) {
      console.error(`[ONBOARDING ERROR] Gagal mengecek #rules-and-role di ${guild.name}:`, err.message);
    }
  }
});

// =========================================================================
// 5. EVENT OTOMATIS SAAT MEMBER BARU BERGABUNG (WELCOME + AUTO ROLE)
// =========================================================================
client.on('guildMemberAdd', async (member) => {
  try {
    // A. Otomatis berikan role default "Member"
    const defaultMemberRole = member.guild.roles.cache.find((r) => r.name === 'Member');
    if (defaultMemberRole) {
      await member.roles.add(defaultMemberRole).catch((err) => {
        console.warn(`[AUTO-ROLE] Gagal memberi role Member ke ${member.user.tag}:`, err.message);
      });
    }

    // B. Cari channel tujuan Welcome (prioritas: WELCOME_CHANNEL_ID -> #announcements -> systemChannel)
    const welcomeChannel =
      (WELCOME_CHANNEL_ID &&
        (member.guild.channels.cache.get(WELCOME_CHANNEL_ID) ||
          (await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null)))) ||
      member.guild.channels.cache.find((ch) => ch.name === 'announcements' && ch.isTextBased()) ||
      member.guild.systemChannel;

    if (!welcomeChannel) {
      console.warn('[WELCOME] Channel welcome tidak ditemukan.');
      return;
    }

    // Cari referensi channel #rules-and-role dan #diskusi untuk clickable mention
    const rulesCh = member.guild.channels.cache.find((ch) => ch.name === 'rules-and-role');
    const diskusiCh = member.guild.channels.cache.find((ch) => ch.name === 'diskusi');

    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x2ECC71)
      .setTitle(`🎉 Selamat Datang di ${member.guild.name}!`)
      .setDescription(
        `Halo ${member}, selamat datang dan selamat bergabung di komunitas **Ainun Ijlal Studio**!\n\n` +
        `• Baca peraturan & ambil **Role** kamu di ${rulesCh ? `${rulesCh}` : '`#rules-and-role`'}.\n` +
        `• Mulai kenalan atau tanya seputar coding & UI/UX di ${diskusiCh ? `${diskusiCh}` : '`#diskusi`'}.\n` +
        `• Cek resource & starter template gratis di \`#template-gratis\`.`
      )
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👤 Username', value: `\`${member.user.username}\``, inline: true },
        { name: '📊 Member Ke', value: `**#${member.guild.memberCount}**`, inline: true },
        {
          name: '📅 Akun Dibuat',
          value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
          inline: true,
        }
      )
      .setFooter({
        text: `Ainun Ijlal Studio • ID: ${member.id}`,
        iconURL: member.guild.iconURL({ dynamic: true }) || undefined,
      })
      .setTimestamp();

    await welcomeChannel.send({
      content: `Selamat datang ${member}! 👋`,
      embeds: [welcomeEmbed],
    });

    console.log(`[WELCOME] Pesan welcome & auto-role terkirim untuk ${member.user.tag}`);
  } catch (error) {
    console.error('[WELCOME ERROR] Gagal memproses member baru:', error);
  }
});

// =========================================================================
// 6. EVENT INTERAKSI TOMBOL PILIH ROLE & SLASH COMMAND
// =========================================================================
client.on('interactionCreate', async (interaction) => {
  // A. Handle Slash Command /setup-roles
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-roles') {
    await interaction.reply({
      content: '✅ Panel pemilihan role berhasil dikirim ke channel ini.',
      ephemeral: true,
    });
    await interaction.channel.send(buildOnboardingMessage());
    return;
  }

  // B. Handle Klik Tombol Pilih Role
  if (!interaction.isButton()) return;

  const { customId, member, guild } = interaction;
  if (!customId.startsWith('role_status:') && !customId.startsWith('role_skill:')) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const [category, roleName] = customId.split(':');
    const targetRole = guild.roles.cache.find((r) => r.name === roleName);

    if (!targetRole) {
      return interaction.editReply({
        content: `❌ Role **${roleName}** tidak ditemukan di server. Hubungi Admin.`,
      });
    }

    // Pastikan role bot berada di atas role yang akan diberikan
    if (guild.members.me.roles.highest.position <= targetRole.position) {
      return interaction.editReply({
        content: `⚠️ Posisi role bot di **Server Settings > Roles** harus ditaruh **di atas** role **${roleName}** agar bot bisa memberikannya.`,
      });
    }

    if (category === 'role_status') {
      // Mode Eksklusif: Hapus role status lain jika sudah punya, lalu pasang yang baru
      const alreadyHas = member.roles.cache.has(targetRole.id);

      if (alreadyHas) {
        await member.roles.remove(targetRole);
        return interaction.editReply({
          content: `➖ Role status **${roleName}** telah dilepas.`,
        });
      }

      const otherStatusRoles = guild.roles.cache.filter(
        (r) => STATUS_ROLES.includes(r.name) && member.roles.cache.has(r.id)
      );
      if (otherStatusRoles.size > 0) {
        await member.roles.remove(otherStatusRoles);
      }

      await member.roles.add(targetRole);
      return interaction.editReply({
        content: `✅ Status kamu berhasil diatur menjadi **${roleName}**!`,
      });
    }

    if (category === 'role_skill') {
      // Mode Toggle: Bisa pilih lebih dari satu bidang
      const alreadyHas = member.roles.cache.has(targetRole.id);

      if (alreadyHas) {
        await member.roles.remove(targetRole);
        return interaction.editReply({
          content: `➖ Role bidang **${roleName}** telah dilepas.`,
        });
      } else {
        await member.roles.add(targetRole);
        return interaction.editReply({
          content: `✅ Role bidang **${roleName}** berhasil ditambahkan!`,
        });
      }
    }
  } catch (error) {
    console.error('[BUTTON ROLE ERROR]', error);
    return interaction.editReply({
      content: '❌ Terjadi kesalahan saat mengatur role. Pastikan izin **Manage Roles** bot aktif.',
    });
  }
});

// =========================================================================
// 7. PENANGANAN ERROR GLOBAL AGAR BOT TIDAK CRASH
// =========================================================================
process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
});

client.login(TOKEN);