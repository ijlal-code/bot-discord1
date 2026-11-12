const http = require('http');
const {
  Client,
  GatewayIntentBits,
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActivityType,
  AutoModerationRuleTriggerType,
  AutoModerationRuleEventType,
  AutoModerationActionType,
  REST,
  Routes,
  SlashCommandBuilder,
} = require('discord.js');

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
// 2. KONFIGURASI ENVIRONMENT & DATA KOMUNITAS
// =========================================================================
const TOKEN = process.env.DISCORD_TOKEN;
const GUILD_ID = process.env.GUILD_ID || '1569980330629275819';
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID; // Opsional (default: #announcements)

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

// Satu tautan HTTPS bersih per media sosial
const SOCIAL_LINKS_BLOCK =
  '• **YouTube:** https://www.youtube.com/@ainunijlal\n' +
  '• **TikTok:** https://www.tiktok.com/@ainunijlal\n' +
  '• **Instagram:** https://www.instagram.com/ainunijlal_ai/\n' +
  '• **LinkedIn:** https://www.linkedin.com/in/ainunijlal\n' +
  '• **Email:** ijlalainun@gmail.com';

// Kategori Role Eksklusif (Maksimal 1 role aktif per bagian)
const ROLE_GROUPS = {
  status: ['Pekerja', 'Pelajar', 'Umum'],
  skill: ['Frontend Developer', 'Backend Developer', 'UI/UX Designer'],
};

// Skema Role Komunitas
const rolesToCreate = [
  { name: 'Owner', color: 0xE74C3C, hoist: true, permissions: [] },
  {
    name: 'Admin',
    color: 0xE67E22,
    hoist: true,
    permissions: [
      PermissionsBitField.Flags.ManageChannels,
      PermissionsBitField.Flags.ManageMessages,
      PermissionsBitField.Flags.KickMembers,
      PermissionsBitField.Flags.BanMembers,
      PermissionsBitField.Flags.ModerateMembers,
      PermissionsBitField.Flags.MuteMembers,
      PermissionsBitField.Flags.DeafenMembers,
    ],
  },
  { name: 'Frontend Developer', color: 0x3498DB, hoist: false, permissions: [] },
  { name: 'Backend Developer', color: 0x2ECC71, hoist: false, permissions: [] },
  { name: 'UI/UX Designer', color: 0x9B59B6, hoist: false, permissions: [] },
  { name: 'Pekerja', color: 0x1ABC9C, hoist: true, permissions: [] },
  { name: 'Pelajar', color: 0xF1C40F, hoist: true, permissions: [] },
  { name: 'Umum', color: 0x34495E, hoist: true, permissions: [] },
  { name: 'Member', color: 0x95A5A6, hoist: false, permissions: [] },
];

// =========================================================================
// 3. BUILDER PANEL PERATURAN & PEMILIHAN ROLE (TOMBOL INTERAKTIF)
// =========================================================================
function buildRulesAndRolePanel(guild) {
  const embed = new EmbedBuilder()
    .setColor(0x1E293B)
    .setAuthor({
      name: 'AINUN IJLAL STUDIO • COMMUNITY GUIDELINES',
      iconURL: guild?.iconURL({ dynamic: true }) || undefined,
    })
    .setTitle('Peraturan Komunitas & Registrasi Role Anggota')
    .setDescription(
      'Selamat datang di komunitas resmi **Ainun Ijlal Studio**. Demi menjaga lingkungan diskusi tetap sehat dan produktif, harap mematuhi ketentuan berikut:\n\n' +
      '**I. Etika & Tata Tertib Komunitas**\n' +
      '1. **Saling Menghargai:** Jaga etika diskusi yang konstruktif, sopan, dan bebas dari SARA maupun ujaran kebencian.\n' +
      '2. **Kepatuhan Topik Kanal:** Ajukan pertanyaan coding di `#diskusi` dan masukan ide di `#feedback-and-request`.\n' +
      '3. **Keamanan & Anti-Spam:** Dilarang mengirim pesan berulang, promosi tanpa izin, maupun tautan phishing/berbahaya.\n\n' +
      '**II. Pemilihan Role Identitas (Maksimal 1 Role per Bagian)**\n' +
      'Klik tombol di bawah ini untuk menetapkan identitas Anda. Memilih opsi baru pada bagian yang sama akan otomatis menggantikan pilihan sebelumnya.'
    )
    .addFields(
      {
        name: 'Bagian 1 — Status Saat Ini (Pilih 1)',
        value: '`Pekerja` • `Pelajar` • `Umum`',
        inline: true,
      },
      {
        name: 'Bagian 2 — Fokus Keahlian Utama (Pilih 1)',
        value: '`Frontend Developer` • `Backend Developer` • `UI/UX Designer`',
        inline: true,
      }
    )
    .setFooter({ text: 'Ainun Ijlal Studio • Sistem Registrasi Role Otomatis' });

  const rowStatus = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('select_role:status:Pekerja')
      .setLabel('Pekerja')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('select_role:status:Pelajar')
      .setLabel('Pelajar')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('select_role:status:Umum')
      .setLabel('Umum')
      .setStyle(ButtonStyle.Secondary)
  );

  const rowSkill = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('select_role:skill:Frontend Developer')
      .setLabel('Frontend Developer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('select_role:skill:Backend Developer')
      .setLabel('Backend Developer')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId('select_role:skill:UI/UX Designer')
      .setLabel('UI/UX Designer')
      .setStyle(ButtonStyle.Primary)
  );

  return { embeds: [embed], components: [rowStatus, rowSkill] };
}

// =========================================================================
// 4. STRUKTUR KATEGORI, CHANNEL & EMBED PEMBUKA PROFESIONAL
// =========================================================================
const serverStructure = [
  {
    category: '📢 WELCOME & INFO',
    isPrivateOwnerOnly: false,
    channels: [
      {
        name: 'rules-and-role',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Peraturan komunitas, etika saling menghargai, serta registrasi role anggota.',
        useInteractiveRolePanel: true,
      },
      {
        name: 'announcements',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Sambutan pembuka resmi, pengumuman peluncuran server, dan tautan portofolio.',
        embed: new EmbedBuilder()
          .setColor(0x0F172A)
          .setAuthor({ name: 'AINUN IJLAL STUDIO • OFFICIAL ANNOUNCEMENT' })
          .setTitle('Selamat Datang di Komunitas Ainun Ijlal Studio')
          .setDescription(
            'Terima kasih telah bergabung menjadi bagian dari komunitas ini.\n\n' +
            'Server ini dibangun sebagai wadah berbagi wawasan seputar **Web Development**, **UI/UX Design**, tren teknologi modern, diskusi pemecahan error, serta distribusi starter template gratis karya studio.\n\n' +
            '**Website & Portofolio Resmi:**\n' +
            '• Portofolio Pribadi: https://ainunijlal.com/\n' +
            '• Layanan Studio: https://studio.ainunijlal.com/\n\n' +
            'Mulai perkenalan dan diskusi teknis perdana Anda pada kanal `#diskusi`.'
          )
          .setFooter({ text: 'Ainun Ijlal Studio Community' }),
      },
    ],
  },
  {
    category: '🌐 BERITA',
    isPrivateOwnerOnly: false,
    channels: [
      {
        name: 'berita',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Kurasi update tren web modern, rilis framework, browser API baru, dan tools developer.',
        embed: new EmbedBuilder()
          .setColor(0x1E293B)
          .setAuthor({ name: 'AINUN IJLAL STUDIO • TECH & WEB PULSE' })
          .setTitle('Kurasi Berita Teknologi & Pengembangan Web')
          .setDescription(
            'Kanal ini menyajikan rangkuman informasi terkurasi seputar dunia pengembangan web dan desain antarmuka modern:\n\n' +
            '• Pembaruan versi framework (Laravel, Next.js, Astro, Tailwind CSS)\n' +
            '• Fitur baru Browser API & standar CSS modern\n' +
            '• Rilis tools produktivitas & AI untuk rekayasa perangkat lunak'
          )
          .setFooter({ text: 'Ainun Ijlal Studio • Curated Tech Updates' }),
      },
    ],
  },
  {
    category: '💬 DISKUSI BELAJAR BERSAMA',
    isPrivateOwnerOnly: false,
    channels: [
      {
        name: 'diskusi',
        type: ChannelType.GuildText,
        readOnly: false,
        topic: 'Panduan bertanya yang efektif (menyertakan konteks masalah, cuplikan kode, dan pesan error).',
        embed: new EmbedBuilder()
          .setColor(0x1E293B)
          .setAuthor({ name: 'AINUN IJLAL STUDIO • TECHNICAL FORUM' })
          .setTitle('Ruang Diskusi & Belajar Bersama')
          .setDescription(
            'Gunakan kanal ini untuk berdiskusi mengenai pemrograman, arsitektur sistem, pemecahan bug, maupun ulasan desain UI/UX.\n\n' +
            '**Standar Bertanya yang Efektif:**\n' +
            '1. Jelaskan konteks permasalahan serta hasil akhir yang diharapkan.\n' +
            '2. Sertakan pesan error secara lengkap atau tangkapan layar yang relevan.\n' +
            '3. Gunakan format blok kode (` ``` `) saat membagikan cuplikan script.'
          )
          .setFooter({ text: 'Ainun Ijlal Studio • Collaborative Learning' }),
      },
    ],
  },
  {
    category: '🔊 DISKUSI SUARA',
    isPrivateOwnerOnly: false,
    channels: [
      {
        name: '🔊 Diskusi Santai',
        type: ChannelType.GuildVoice,
        readOnly: false,
      },
    ],
  },
  {
    category: '⚡ AINUN IJLAL STUDIO',
    isPrivateOwnerOnly: false,
    channels: [
      {
        name: 'konten',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Publikasi artikel, tips web development/UI, dokumentasi riset, serta tautan kontak & media sosial resmi.',
        embed: new EmbedBuilder()
          .setColor(0x0F172A)
          .setAuthor({ name: 'AINUN IJLAL STUDIO • PUBLICATIONS & MEDIA' })
          .setTitle('Konten Edukasi, Riset & Kanal Resmi')
          .setDescription(
            'Kanal ini memuat publikasi artikel teknis, panduan pengembangan web, studi kasus UI/UX, serta dokumentasi riset dari **Ainun Ijlal Studio**.\n\n' +
            '**Kontak & Media Sosial Resmi:**\n' +
            SOCIAL_LINKS_BLOCK
          )
          .setFooter({ text: 'Ainun Ijlal Studio Official Channels' }),
      },
      {
        name: 'template-gratis',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Distribusi starter template, komponen UI, cheatsheet, free resources karya studio, serta tautan media sosial.',
        embed: new EmbedBuilder()
          .setColor(0x0F172A)
          .setAuthor({ name: 'AINUN IJLAL STUDIO • OPEN RESOURCES' })
          .setTitle('Starter Template & Free Resources')
          .setDescription(
            'Kumpulan aset siap pakai yang didistribusikan secara gratis untuk mendukung produktivitas pengembangan proyek Anda:\n\n' +
            '• Starter Template Website (HTML/Tailwind CSS, Astro, Laravel)\n' +
            '• Komponen UI & Snippet Kode Siap Pakai\n' +
            '• Cheatsheet & Dokumentasi Teknis\n\n' +
            '**Media Sosial & Kontak:**\n' +
            SOCIAL_LINKS_BLOCK
          )
          .setFooter({ text: 'Ainun Ijlal Studio • Free Developer Assets' }),
      },
      {
        name: 'feedback-and-request',
        type: ChannelType.GuildText,
        readOnly: false,
        topic: 'Panduan bagi member untuk memberikan masukan ide fitur, topik pembahasan, usulan template baru, serta tautan media sosial.',
        embed: new EmbedBuilder()
          .setColor(0x1E293B)
          .setAuthor({ name: 'AINUN IJLAL STUDIO • FEEDBACK & REQUESTS' })
          .setTitle('Masukan Fitur & Permintaan Konten / Template')
          .setDescription(
            'Sampaikan usulan topik pembahasan, ide fitur komunitas, maupun permintaan starter template baru untuk pengembangan **Ainun Ijlal Studio**.\n\n' +
            '**Media Sosial & Kontak:**\n' +
            SOCIAL_LINKS_BLOCK
          )
          .setFooter({ text: 'Ainun Ijlal Studio • Community Feedback' }),
      },
    ],
  },
  {
    category: '🔒 OWNER / AUDIT LOG',
    isPrivateOwnerOnly: true,
    channels: [
      {
        name: 'log-spam',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Menampung laporan otomatis AutoMod untuk indikasi spam pesan.',
      },
      {
        name: 'log-phishing',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Menampung laporan otomatis AutoMod untuk tautan berbahaya atau scam.',
      },
      {
        name: 'log-kata-kasar',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Menampung laporan otomatis AutoMod untuk kata kotor atau SARA.',
      },
    ],
  },
];

// =========================================================================
// 5. FUNGSI RESET & BUILD STRUKTUR SERVER (DIPANGGIL VIA /setup-server)
// =========================================================================
async function runFullServerSetup(guild, progressCallback = null) {
  const report = async (msg) => {
    console.log(msg);
    if (progressCallback) await progressCallback(msg).catch(() => {});
  };

  await report(`Memulai RESET & SETUP server: **${guild.name}**...`);

  // --- TAHAP 1: RESET & BUAT ULANG ROLE ---
  const existingRoles = await guild.roles.fetch();
  const createdRolesMap = {};

  for (const r of rolesToCreate) {
    const oldRoles = existingRoles.filter((role) => role.name === r.name);
    for (const [, oldRole] of oldRoles) {
      try {
        await oldRole.delete('Reset role lama');
      } catch (err) {
        console.log(`[!] Lewati hapus role ${r.name}: ${err.message}`);
      }
    }

    try {
      const newRole = await guild.roles.create({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: r.permissions || [],
        reason: 'Setup skema role komunitas',
      });
      createdRolesMap[r.name] = newRole;
    } catch (err) {
      console.error(`Gagal membuat role ${r.name}:`, err.message);
      const fallbackRole = existingRoles.find((role) => role.name === r.name);
      if (fallbackRole) createdRolesMap[r.name] = fallbackRole;
    }
  }

  const everyoneRole = guild.roles.everyone;
  const ownerRole = createdRolesMap['Owner'];
  const adminRole = createdRolesMap['Admin'];

  // --- TAHAP 2: BERSIHKAN & BUAT ULANG KATEGORI / CHANNEL ---
  const existingChannels = await guild.channels.fetch();
  const managedCategoryNames = serverStructure.map((g) => g.category);
  const managedChannelNames = serverStructure.flatMap((g) => g.channels.map((c) => c.name));
  const defaultOldNames = ['general', 'General', 'Text Channels', 'Voice Channels'];

  for (const [, ch] of existingChannels) {
    if (!ch || ch.type === ChannelType.GuildCategory) continue;
    if (managedChannelNames.includes(ch.name) || defaultOldNames.includes(ch.name)) {
      try {
        await ch.delete('Reset channel lama');
      } catch (err) {
        console.log(`[!] Lewati hapus #${ch.name}: ${err.message}`);
      }
    }
  }

  const remainingCategories = await guild.channels.fetch();
  for (const [, cat] of remainingCategories) {
    if (!cat || cat.type !== ChannelType.GuildCategory) continue;
    if (managedCategoryNames.includes(cat.name) || defaultOldNames.includes(cat.name)) {
      try {
        await cat.delete('Reset kategori lama');
      } catch (err) {
        console.log(`[!] Lewati hapus kategori ${cat.name}: ${err.message}`);
      }
    }
  }

  const logChannelsMap = {};
  let diskusiChannelObj = null;

  for (const group of serverStructure) {
    const categoryOverwrites = [];

    if (group.isPrivateOwnerOnly) {
      categoryOverwrites.push({
        id: everyoneRole.id,
        deny: [PermissionsBitField.Flags.ViewChannel],
      });
      if (adminRole) {
        categoryOverwrites.push({
          id: adminRole.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        });
      }
      if (ownerRole) {
        categoryOverwrites.push({
          id: ownerRole.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        });
      }
      categoryOverwrites.push({
        id: client.user.id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.SendMessages,
          PermissionsBitField.Flags.ManageChannels,
        ],
      });
    }

    let category;
    try {
      category = await guild.channels.create({
        name: group.category,
        type: ChannelType.GuildCategory,
        permissionOverwrites: categoryOverwrites,
      });
    } catch (err) {
      console.error(`Gagal membuat kategori ${group.category}:`, err.message);
      continue;
    }

    for (const ch of group.channels) {
      const channelOverwrites = [];

      if (group.isPrivateOwnerOnly) {
        channelOverwrites.push(...categoryOverwrites);
      } else if (ch.type === ChannelType.GuildText) {
        if (ch.readOnly) {
          channelOverwrites.push({
            id: everyoneRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AddReactions,
            ],
            deny: [
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.CreatePublicThreads,
              PermissionsBitField.Flags.CreatePrivateThreads,
            ],
          });
        } else {
          channelOverwrites.push({
            id: everyoneRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.EmbedLinks,
              PermissionsBitField.Flags.AttachFiles,
              PermissionsBitField.Flags.AddReactions,
            ],
          });
        }
      }

      try {
        const channelObj = await guild.channels.create({
          name: ch.name,
          type: ch.type,
          parent: category.id,
          topic: ch.topic || undefined,
          permissionOverwrites: channelOverwrites.length > 0 ? channelOverwrites : undefined,
        });

        if (ch.name === 'diskusi') {
          diskusiChannelObj = channelObj;
        }

        if (ch.type === ChannelType.GuildText) {
          if (ch.useInteractiveRolePanel) {
            await channelObj.send(buildRulesAndRolePanel(guild));
          } else if (ch.embed) {
            await channelObj.send({ embeds: [ch.embed] });
          }
        }

        if (group.isPrivateOwnerOnly) {
          logChannelsMap[ch.name] = channelObj;
        }
      } catch (err) {
        console.error(`Gagal membuat channel ${ch.name}:`, err.message);
      }
    }
  }

  // --- TAHAP 3: INTEGRASI DISCORD AUTOMOD KE LOG PRIVAT ---
  try {
    const existingRules = await guild.autoModerationRules.fetch();
    for (const [, rule] of existingRules) {
      await rule.delete('Reset aturan AutoMod lama');
    }
  } catch (err) {
    console.log(`[!] Lewati hapus aturan AutoMod lama: ${err.message}`);
  }

  const logSpamChannel = logChannelsMap['log-spam'];
  const logPhishingChannel = logChannelsMap['log-phishing'];
  const logKataKasarChannel = logChannelsMap['log-kata-kasar'];

  // A. AutoMod Spam -> #log-spam
  try {
    const actionsSpam = [{ type: AutoModerationActionType.BlockMessage }];
    if (logSpamChannel) {
      actionsSpam.push({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: { channel: logSpamChannel.id },
      });
    }
    await guild.autoModerationRules.create({
      name: 'AutoMod: Anti-Spam Pesan',
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Spam,
      actions: actionsSpam,
      enabled: true,
    });
  } catch (err) {
    console.log(`[AutoMod] Anti-Spam dilewati: ${err.message}`);
  }

  // B. AutoMod Phishing & Scam -> #log-phishing
  try {
    const actionsPhishing = [{ type: AutoModerationActionType.BlockMessage }];
    if (logPhishingChannel) {
      actionsPhishing.push({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: { channel: logPhishingChannel.id },
      });
    }
    await guild.autoModerationRules.create({
      name: 'AutoMod: Anti-Phishing & Scam Links',
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: {
        keywordFilter: [
          '*free nitro*', '*discord nitro gift*', '*discord-gift*', '*airdrop free*',
          '*steamcommunity.ru*', '*claim-nitro*', '*t.me/*', '*bit.ly/*',
        ],
      },
      actions: actionsPhishing,
      enabled: true,
    });
  } catch (err) {
    console.log(`[AutoMod] Anti-Phishing dilewati: ${err.message}`);
  }

  // C. AutoMod Kata Kasar & SARA (EN/ID) -> #log-kata-kasar
  try {
    const actionsKataKasar = [{ type: AutoModerationActionType.BlockMessage }];
    if (logKataKasarChannel) {
      actionsKataKasar.push({
        type: AutoModerationActionType.SendAlertMessage,
        metadata: { channel: logKataKasarChannel.id },
      });
    }
    await guild.autoModerationRules.create({
      name: 'AutoMod: Filter Toksik & SARA (EN)',
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.KeywordPreset,
      triggerMetadata: { presets: [1, 2, 3] },
      actions: actionsKataKasar,
      enabled: true,
    });
    await guild.autoModerationRules.create({
      name: 'AutoMod: Filter Kata Kasar & SARA (ID)',
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: {
        keywordFilter: [
          '*anjing*', '*babi*', '*kontol*', '*memek*', '*bangsat*', '*pantek*', '*tolol*', '*goblok*',
        ],
      },
      actions: actionsKataKasar,
      enabled: true,
    });
  } catch (err) {
    console.log(`[AutoMod] Filter Kata Kasar dilewati: ${err.message}`);
  }

  // --- TAHAP 4: SYSTEM WELCOME MESSAGES BAWAAN KE #diskusi ---
  if (diskusiChannelObj) {
    try {
      await guild.edit({
        systemChannel: diskusiChannelObj.id,
        reason: 'Arahkan System Welcome Messages bawaan Discord ke #diskusi',
      });
    } catch (err) {
      console.log(`[System Channel] Dilewati: ${err.message}`);
    }
  }

  console.log('✅ Struktur server selesai dibangun dan bot tetap aktif 24 jam.');
}

// =========================================================================
// 6. EVENT SAAT BOT AKTIF (clientReady)
// =========================================================================
client.once('clientReady', async () => {
  console.log(`[DISCORD] Bot aktif sebagai ${client.user.tag}`);
  client.user.setActivity('Ainun Ijlal Studio', { type: ActivityType.Watching });

  // Daftarkan Slash Commands (/setup-server dan /panel-role)
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

  // Cek otomatis saat startup: jika channel #rules-and-role belum ada sama sekali, bangun struktur awal
  const targetGuild = client.guilds.cache.get(GUILD_ID) || client.guilds.cache.first();
  if (targetGuild) {
    const hasRulesChannel = targetGuild.channels.cache.some((ch) => ch.name === 'rules-and-role');
    if (!hasRulesChannel) {
      console.log('[INIT] Struktur channel belum ditemukan, menjalankan setup otomatis...');
      await runFullServerSetup(targetGuild);
    } else {
      // Pastikan panel interaktif ada di #rules-and-role
      const rulesCh = targetGuild.channels.cache.find(
        (ch) => ch.name === 'rules-and-role' && ch.isTextBased()
      );
      if (rulesCh) {
        const msgs = await rulesCh.messages.fetch({ limit: 10 }).catch(() => null);
        const hasPanel = msgs?.some(
          (m) => m.author.id === client.user.id && m.components.length > 0
        );
        if (!hasPanel) {
          await rulesCh.send(buildRulesAndRolePanel(targetGuild)).catch(() => {});
        }
      }
    }
  }
});

// =========================================================================
// 7. EVENT SAMBUTAN MEMBER BARU (WELCOME EMBED + AUTO ROLE MEMBER)
// =========================================================================
client.on('guildMemberAdd', async (member) => {
  try {
    // 1. Berikan role "Member" otomatis
    const memberRole = member.guild.roles.cache.find((r) => r.name === 'Member');
    if (memberRole) {
      await member.roles.add(memberRole).catch(() => {});
    }

    // 2. Cari kanal welcome (WELCOME_CHANNEL_ID -> #announcements -> systemChannel)
    const welcomeChannel =
      (WELCOME_CHANNEL_ID &&
        (member.guild.channels.cache.get(WELCOME_CHANNEL_ID) ||
          (await member.guild.channels.fetch(WELCOME_CHANNEL_ID).catch(() => null)))) ||
      member.guild.channels.cache.find((ch) => ch.name === 'announcements' && ch.isTextBased()) ||
      member.guild.systemChannel;

    if (!welcomeChannel) return;

    const rulesCh = member.guild.channels.cache.find((ch) => ch.name === 'rules-and-role');
    const diskusiCh = member.guild.channels.cache.find((ch) => ch.name === 'diskusi');
    const templateCh = member.guild.channels.cache.find((ch) => ch.name === 'template-gratis');

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
        `• **Registrasi Identitas:** Pilih status dan bidang keahlian Anda pada ${rulesCh ? `${rulesCh}` : '`#rules-and-role`'}.\n` +
        `• **Diskusi Teknis:** Ajukan pertanyaan pemrograman dan desain pada ${diskusiCh ? `${diskusiCh}` : '`#diskusi`'}.\n` +
        `• **Aset & Resource:** Akses starter template gratis pada ${templateCh ? `${templateCh}` : '`#template-gratis`'}.\n\n` +
        '**Portofolio & Kanal Resmi:**\n' +
        '• Website: [https://ainunijlal.com/](https://ainunijlal.com/)\n' +
        '• Studio: [https://studio.ainunijlal.com/](https://studio.ainunijlal.com/)\n' +
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
// 8. EVENT INTERAKSI SLASH COMMAND & TOMBOL PILIH ROLE (1 PER BAGIAN)
// =========================================================================
client.on('interactionCreate', async (interaction) => {
  // A. Slash Command: /setup-server
  if (interaction.isChatInputCommand() && interaction.commandName === 'setup-server') {
    await interaction.reply({
      content: '⏳ Sedang menjalankan reset & pembuatan ulang seluruh role, kategori, channel, dan AutoMod. Mohon tunggu sekitar 15–30 detik...',
      ephemeral: true,
    });

    await runFullServerSetup(interaction.guild);

    await interaction.followUp({
      content: '✅ Seluruh struktur server, embed pembuka, panel role, dan aturan AutoMod berhasil dibangun ulang!',
      ephemeral: true,
    }).catch(() => {});
    return;
  }

  // B. Slash Command: /panel-role
  if (interaction.isChatInputCommand() && interaction.commandName === 'panel-role') {
    await interaction.reply({
      content: 'Panel registrasi role telah dikirim ke kanal ini.',
      ephemeral: true,
    });
    await interaction.channel.send(buildRulesAndRolePanel(interaction.guild));
    return;
  }

  // C. Tombol Pemilihan Role (Eksklusif 1 Role per Bagian)
  if (!interaction.isButton()) return;

  const { customId, member, guild } = interaction;
  if (!customId.startsWith('select_role:')) return;

  await interaction.deferReply({ ephemeral: true });

  try {
    const [, groupKey, selectedRoleName] = customId.split(':');
    const groupRolesList = ROLE_GROUPS[groupKey];

    if (!groupRolesList) {
      return interaction.editReply({ content: 'Kategori role tidak valid.' });
    }

    const targetRole = guild.roles.cache.find((r) => r.name === selectedRoleName);
    if (!targetRole) {
      return interaction.editReply({
        content: `Role **${selectedRoleName}** tidak ditemukan. Jalankan \`/setup-server\` terlebih dahulu.`,
      });
    }

    if (guild.members.me.roles.highest.position <= targetRole.position) {
      return interaction.editReply({
        content: `Konfigurasi izin diperlukan: Posisi role bot harus berada di atas role **${selectedRoleName}** di pengaturan server.`,
      });
    }

    const alreadyHasTarget = member.roles.cache.has(targetRole.id);
    const sectionLabel = groupKey === 'status' ? 'Status' : 'Fokus Keahlian';

    if (alreadyHasTarget) {
      await member.roles.remove(targetRole);
      return interaction.editReply({
        content: `Role **${selectedRoleName}** pada bagian **${sectionLabel}** telah dilepas.`,
      });
    }

    // Hapus role lain dalam bagian yang sama agar hanya 1 role aktif per bagian
    const previousRolesInGroup = guild.roles.cache.filter(
      (r) => groupRolesList.includes(r.name) && member.roles.cache.has(r.id)
    );

    let replacedRoleName = null;
    if (previousRolesInGroup.size > 0) {
      replacedRoleName = previousRolesInGroup.map((r) => r.name).join(', ');
      await member.roles.remove(previousRolesInGroup);
    }

    await member.roles.add(targetRole);

    if (replacedRoleName) {
      return interaction.editReply({
        content: `Role **${sectionLabel}** Anda telah diperbarui dari **${replacedRoleName}** menjadi **${selectedRoleName}**.`,
      });
    }

    return interaction.editReply({
      content: `Role **${selectedRoleName}** berhasil ditetapkan pada bagian **${sectionLabel}**.`,
    });
  } catch (error) {
    console.error('[ROLE SELECTION ERROR]', error);
    return interaction.editReply({
      content: 'Terjadi kendala saat memperbarui role Anda. Pastikan bot memiliki izin Manage Roles.',
    });
  }
});

// =========================================================================
// 9. PENANGANAN ERROR GLOBAL
// =========================================================================
process.on('unhandledRejection', (error) => {
  console.error('[UNHANDLED REJECTION]', error);
});

client.login(TOKEN);