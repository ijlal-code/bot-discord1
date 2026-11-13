const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require('discord.js');

// Hanya 3 Role Status (Maksimal 1 role aktif per member)
const STATUS_ROLES = ['Pekerja', 'Pelajar', 'Umum'];

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
      '1. **Profesionalisme & Saling Menghargai:** Gunakan bahasa yang santun, konstruktif, serta bebas dari unsur SARA maupun ujaran kebencian.\n' +
      '2. **Kepatuhan Topik Kanal:** Sampaikan pertanyaan teknis pada `#diskusi` dan usulan pengembangan pada `#feedback-and-request`.\n' +
      '3. **Keamanan & Anti-Spam:** Dilarang mengirim pesan berulang, promosi tanpa izin, maupun tautan phishing/berbahaya.\n\n' +
      '**II. Verifikasi Role Status (Wajib untuk Mengirim Pesan)**\n' +
      'Anda wajib memilih **1 role status** di bawah ini sebelum dapat mengirim pesan pada kanal diskusi. Memilih role baru akan otomatis menggantikan pilihan sebelumnya.'
    )
    .addFields({
      name: 'Pilihan Role Status (Pilih 1)',
      value: '`Pekerja` • `Pelajar` • `Umum`',
      inline: false,
    })
    .setFooter({ text: 'Ainun Ijlal Studio • Pilih role di bawah untuk membuka akses chat' });

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

  return { embeds: [embed], components: [rowStatus] };
}

async function handleRoleButtonInteraction(interaction, onFirstRole) {
  const { customId, member, guild } = interaction;
  if (!customId.startsWith('select_role:')) return false;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    // Mendukung format 'select_role:status:Pekerja' maupun 'select_role:Pekerja'
    const parts = customId.split(':');
    const selectedRoleName = parts[parts.length - 1];

    if (!STATUS_ROLES.includes(selectedRoleName)) {
      await interaction.editReply({
        content: 'Pilihan role tersebut sudah tidak tersedia. Silakan pilih **Pekerja**, **Pelajar**, atau **Umum**.',
      });
      return true;
    }

    const targetRole = guild.roles.cache.find((r) => r.name === selectedRoleName);
    if (!targetRole) {
      await interaction.editReply({
        content: `Role **${selectedRoleName}** belum ditemukan di server. Hubungi Administrator.`,
      });
      return true;
    }

    if (guild.members.me.roles.highest.position <= targetRole.position) {
      await interaction.editReply({
        content: `Konfigurasi izin diperlukan: Posisi role bot harus berada di atas role **${selectedRoleName}** pada pengaturan server.`,
      });
      return true;
    }

    const alreadyHasTarget = member.roles.cache.has(targetRole.id);

    // Jika klik role yang sudah aktif, lepas role (akses kirim pesan otomatis terkunci kembali)
    if (alreadyHasTarget) {
      await member.roles.remove(targetRole);
      await interaction.editReply({
        content: `Role **${selectedRoleName}** telah dilepas. Anda perlu memilih salah satu role status untuk kembali mengirim pesan.`,
      });
      return true;
    }

    // Hapus role status sebelumnya agar hanya 1 role status yang aktif
    const previousStatusRoles = guild.roles.cache.filter(
      (r) => STATUS_ROLES.includes(r.name) && member.roles.cache.has(r.id)
    );

    let replacedRoleName = null;
    if (previousStatusRoles.size > 0) {
      replacedRoleName = previousStatusRoles.map((r) => r.name).join(', ');
      await member.roles.remove(previousStatusRoles);
    }

    await member.roles.add(targetRole);

    if (replacedRoleName) {
      await interaction.editReply({
        content: `Role status Anda diperbarui dari **${replacedRoleName}** menjadi **${selectedRoleName}**. Akses kirim pesan aktif.`,
      });
    } else {
      await interaction.editReply({
        content: `Role **${selectedRoleName}** berhasil ditetapkan. Sekarang Anda sudah dapat mengirim pesan di kanal diskusi.`,
      });
    }
    if (!replacedRoleName && onFirstRole) {
      // Kegagalan welcome tidak membatalkan pemberian role yang sudah berhasil.
      try { await onFirstRole(member, selectedRoleName); }
      catch (error) { console.error('[WELCOME DISKUSI ERROR]', error); }
    }
  } catch (error) {
    console.error('[ROLE SELECTION ERROR]', error);
    await interaction.editReply({
      content: 'Terjadi kendala saat memperbarui role Anda. Pastikan bot memiliki izin Manage Roles.',
    }).catch(() => {});
  }

  return true;
}

module.exports = {
  STATUS_ROLES,
  buildRulesAndRolePanel,
  handleRoleButtonInteraction,
};