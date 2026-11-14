const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
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
        readOnly: true, // Kanal khusus form, bukan tempat chat
        topic: 'Panduan bagi member untuk memberikan masukan ide fitur, topik pembahasan, usulan template baru, serta tautan media sosial.',
        embed: new EmbedBuilder()
          .setColor(0x1E293B)
          .setAuthor({ name: 'AINUN IJLAL STUDIO • FEEDBACK & REQUESTS' })
          .setTitle('Masukan Fitur & Permintaan Konten / Template')
          .setDescription(
            'Gunakan tombol formulir di kanal ini untuk menyampaikan usulan dan permintaan.\n\n' +
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

// Konfigurasi struktur digunakan oleh safe-setup.js; tidak ada reset otomatis.
module.exports = { SOCIAL_LINKS_BLOCK, rolesToCreate, serverStructure };
