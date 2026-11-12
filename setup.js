const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  AutoModerationRuleTriggerType,
  AutoModerationRuleEventType,
  AutoModerationActionType,
} = require('discord.js');
const { STATUS_ROLES, buildRulesAndRolePanel } = require('./role');

const SOCIAL_LINKS_BLOCK =
  '• **YouTube:** https://www.youtube.com/@ainunijlal\n' +
  '• **TikTok:** https://www.tiktok.com/@ainunijlal\n' +
  '• **Instagram:** https://www.instagram.com/ainunijlal_ai/\n' +
  '• **LinkedIn:** https://www.linkedin.com/in/ainunijlal\n' +
  '• **Email:** ijlalainun@gmail.com';

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
  { name: 'Pekerja', color: 0x1ABC9C, hoist: true, permissions: [] },
  { name: 'Pelajar', color: 0xF1C40F, hoist: true, permissions: [] },
  { name: 'Umum', color: 0x34495E, hoist: true, permissions: [] },
];

const serverStructure = [
  {
    category: '📢 WELCOME & INFO',
    isPrivateOwnerOnly: false,
    channels: [
      {
        name: 'rules-and-role',
        type: ChannelType.GuildText,
        readOnly: true,
        topic: 'Peraturan komunitas, etika saling menghargai, serta registrasi role status.',
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
            'Pilih role status Anda di `#rules-and-role` untuk mulai berdiskusi di `#diskusi`.'
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
        readOnly: false, // Terbuka khusus bagi member yang sudah memilih role status
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
        readOnly: false, // Terbuka khusus bagi member yang sudah memilih role status
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

async function runFullServerSetup(guild, client) {
  console.log(`Memulai RESET & SETUP server: "${guild.name}"...`);

  // --- TAHAP 1: RESET & BUAT ULANG ROLE ---
  const existingRoles = await guild.roles.fetch();
  const createdRolesMap = {};

  // Hapus juga role lama yang sudah tidak dipakai (Frontend/Backend/UI-UX)
  const obsoleteRoleNames = ['Frontend Developer', 'Backend Developer', 'UI/UX Designer'];
  for (const obsName of obsoleteRoleNames) {
    const obsRoles = existingRoles.filter((role) => role.name === obsName);
    for (const [, obsRole] of obsRoles) {
      await obsRole.delete('Hapus role lama yang tidak digunakan').catch(() => {});
    }
  }

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
          // Channel Read-Only: Semua hanya bisa baca & reaksi
          channelOverwrites.push({
            id: everyoneRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AddReactions,
            ],
            deny: [
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.SendMessagesInThreads,
              PermissionsBitField.Flags.CreatePublicThreads,
              PermissionsBitField.Flags.CreatePrivateThreads,
            ],
          });
        } else {
          // Channel Terbuka (#diskusi, #feedback-and-request):
          // @everyone dikunci agar TIDAK bisa kirim pesan sebelum pilih role
          channelOverwrites.push({
            id: everyoneRole.id,
            allow: [
              PermissionsBitField.Flags.ViewChannel,
              PermissionsBitField.Flags.ReadMessageHistory,
              PermissionsBitField.Flags.AddReactions,
            ],
            deny: [
              PermissionsBitField.Flags.SendMessages,
              PermissionsBitField.Flags.SendMessagesInThreads,
              PermissionsBitField.Flags.CreatePublicThreads,
              PermissionsBitField.Flags.CreatePrivateThreads,
            ],
          });

          // Buka izin kirim pesan HANYA untuk role Pekerja, Pelajar, dan Umum
          for (const statusRoleName of STATUS_ROLES) {
            const roleObj = createdRolesMap[statusRoleName];
            if (roleObj) {
              channelOverwrites.push({
                id: roleObj.id,
                allow: [
                  PermissionsBitField.Flags.ViewChannel,
                  PermissionsBitField.Flags.ReadMessageHistory,
                  PermissionsBitField.Flags.SendMessages,
                  PermissionsBitField.Flags.SendMessagesInThreads,
                  PermissionsBitField.Flags.EmbedLinks,
                  PermissionsBitField.Flags.AttachFiles,
                  PermissionsBitField.Flags.AddReactions,
                ],
              });
            }
          }
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

  console.log('✅ Struktur server selesai dibangun.');
}

module.exports = {
  SOCIAL_LINKS_BLOCK,
  runFullServerSetup,
};