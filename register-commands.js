const { PermissionsBitField, Routes, SlashCommandBuilder } = require('discord.js');

function definitions() {
  const guild = [
    new SlashCommandBuilder().setName('setup-komunitas')
      .setDescription('Siapkan panel privat Owner dan formulir feedback tanpa reset server').toJSON(),
    new SlashCommandBuilder().setName('onboarding-member')
      .setDescription('Tampilkan onboarding untuk satu member di #diskusi')
      .addUserOption(option => option.setName('member').setDescription('Member yang ingin ditampilkan').setRequired(true)).toJSON(),
  ];
  const global = [
    new SlashCommandBuilder().setName('setup-server')
      .setDescription('Reset & bangun ulang seluruh kategori, channel, role, dan AutoMod server')
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON(),
    new SlashCommandBuilder().setName('kunci-chat')
      .setDescription('Terapkan izin wajib pilih role tanpa mereset server')
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON(),
    new SlashCommandBuilder().setName('panel-role')
      .setDescription('Kirim ulang panel peraturan & tombol pilihan role pada kanal ini')
      .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator).toJSON(),
  ];
  return { guild, global };
}
function findSlash(list, name) { return list.find(c => c.name === name && (c.type == null || c.type === 1)); }

// Perbarui satu perintah saja; jangan bulk replace atau hapus perintah lain.
async function registerCommands(rest, applicationId, guildId) {
  const { guild, global } = definitions();
  const result = { guildSucceeded: [], errors: [] };
  const guildRoute = Routes.applicationGuildCommands(applicationId, guildId);
  try {
    const existing = await rest.get(guildRoute);
    for (const definition of guild) {
      try {
        const previous = findSlash(existing, definition.name);
        if (previous) await rest.patch(Routes.applicationGuildCommand(applicationId, guildId, previous.id), { body: definition });
        else await rest.post(guildRoute, { body: definition });
        result.guildSucceeded.push(definition.name);
        console.log(`[SLASH] /${definition.name} siap untuk GUILD_ID ${guildId}.`);
      } catch (error) {
        result.errors.push(`/${definition.name}: ${error.message}`);
        console.error(`[SLASH ERROR] Gagal mendaftarkan /${definition.name} pada server ${guildId}: ${error.message}`);
      }
    }
  } catch (error) {
    result.errors.push(`Guild: ${error.message}`);
    console.error(`[SLASH ERROR] Gagal membaca command untuk GUILD_ID ${guildId}: ${error.message}`);
  }

  // Pertahankan perintah global lama tanpa menghapus perintah lain yang mungkin ada.
  try {
    const route = Routes.applicationCommands(applicationId);
    const existing = await rest.get(route);
    for (const definition of global) {
      try {
        const previous = findSlash(existing, definition.name);
        if (previous) await rest.patch(Routes.applicationCommand(applicationId, previous.id), { body: definition });
        else await rest.post(route, { body: definition });
      } catch (error) {
        result.errors.push(`/${definition.name}: ${error.message}`);
        console.error(`[SLASH ERROR] Gagal mendaftarkan /${definition.name}: ${error.message}`);
      }
    }
    // Kedua command ini memang hanya untuk GUILD_ID. Hapus versi global lama
    // SETELAH versi server terdaftar agar tidak muncul dua kali di server target.
    for (const name of result.guildSucceeded) {
      const previous = findSlash(existing, name);
      if (!previous) continue;
      try { await rest.delete(Routes.applicationCommand(applicationId, previous.id)); }
      catch (error) { console.warn(`[SLASH] Versi global lama /${name} belum dapat dihapus: ${error.message}`); }
    }
  } catch (error) {
    result.errors.push(`Global: ${error.message}`);
    console.error(`[SLASH ERROR] Gagal membaca command global: ${error.message}`);
  }
  return result;
}
module.exports = { definitions, registerCommands };
