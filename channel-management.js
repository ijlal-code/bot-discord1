const crypto = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder,
  ChannelType, EmbedBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

// Hanya channel non-thread. Thread membutuhkan aturan berbeda dari channel biasa.
const CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildAnnouncement,
  ChannelType.GuildStageVoice, ChannelType.GuildForum, ChannelType.GuildMedia];
const PROTECTED_NAMES = new Set(['kelola-kategori', 'kelola-channel', 'terima-form', 'kelola-embed-welcome-member', 'kelola-member']);
const pending = new Map();
const row = (...components) => new ActionRowBuilder().addComponents(...components);
const button = (id, label, style) => new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);

function channelManagePanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x1e293b).setTitle('Kelola channel server')
      .setDescription('Tambah beberapa channel teks atau suara di satu kategori, atau pilih beberapa channel untuk diganti namanya atau dihapus.\n\n**Penghapusan channel permanen, termasuk riwayat pesan.** Periksa daftar dan konfirmasi sebelum menghapus.')],
    components: [row(button('community:channel-add', 'Tambah channel', ButtonStyle.Success),
      button('community:channel-edit', 'Edit channel', ButtonStyle.Primary),
      button('community:channel-delete', 'Hapus channel', ButtonStyle.Danger))],
    allowedMentions: { parse: [] },
  };
}
function store(i, data) {
  for (const [key, v] of pending) if (v.expires < Date.now()) pending.delete(key);
  const token = crypto.randomBytes(12).toString('hex');
  pending.set(token, { ...data, userId: i.user.id, guildId: i.guildId, expires: Date.now() + 15 * 60 * 1000 });
  return token;
}
function take(i, token, kind) {
  const item = pending.get(token);
  if (!item || item.expires < Date.now() || item.userId !== i.user.id || item.guildId !== i.guildId || item.kind !== kind) return null;
  pending.delete(token); return item;
}
function protectedChannel(c, i) {
  return c.parentId === i.channel.parentId && PROTECTED_NAMES.has(c.name);
}
function validChannel(c, i) {
  return !!c && CHANNEL_TYPES.includes(c.type) && !protectedChannel(c, i);
}
function menu(id, types, placeholder, max) {
  return row(new ChannelSelectMenuBuilder().setCustomId(id).setPlaceholder(placeholder)
    .addChannelTypes(...types).setMinValues(1).setMaxValues(max));
}
function modal(id, title, label, value) {
  const text = new TextInputBuilder().setCustomId('names').setLabel(label)
    .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(4000);
  if (value) text.setValue(value);
  return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(row(text));
}
async function error(i, text) {
  if (i.deferred || i.replied) await i.editReply({ content: text, components: [] });
  else await i.reply({ content: text, flags: MessageFlags.Ephemeral });
}
function parseLines(value) { return value.split(/\r?\n/).map(s => s.trim()).filter(Boolean); }

// Otorisasi role Owner dan lokasi channel sudah diperiksa oleh community.js.
async function handleChannelManagement(i) {
  const id = i.customId;
  if (i.isButton() && id === 'community:channel-add') {
    await i.reply({ content: 'Pilih kategori untuk channel baru. Channel akan menggunakan izin kategori; periksa penguncian role setelahnya.',
      components: [menu('community:channel-create-category', [ChannelType.GuildCategory], 'Pilih satu kategori', 1)], flags: MessageFlags.Ephemeral });
  } else if (i.isChannelSelectMenu() && id === 'community:channel-create-category') {
    const category = i.guild.channels.cache.get(i.values[0]);
    if (i.values.length !== 1 || !category || category.type !== ChannelType.GuildCategory) { await error(i, 'Kategori tidak valid.'); return; }
    const token = store(i, { kind: 'kind', categoryId: category.id });
    await i.update({ content: `Kategori dipilih: **${category.name}**. Pilih jenis channel.`, allowedMentions: { parse: [] },
      components: [row(button(`community:channel-kind-text:${token}`, 'Channel teks', ButtonStyle.Primary), button(`community:channel-kind-voice:${token}`, 'Channel suara', ButtonStyle.Primary))] });
  } else if (i.isButton() && (id.startsWith('community:channel-kind-text:') || id.startsWith('community:channel-kind-voice:'))) {
    const data = take(i, id.split(':')[2], 'kind');
    if (!data) { await error(i, 'Pilihan kedaluwarsa atau sudah digunakan. Ulangi proses tambah.'); return; }
    const type = id.startsWith('community:channel-kind-text:') ? ChannelType.GuildText : ChannelType.GuildVoice;
    const token = store(i, { kind: 'add', categoryId: data.categoryId, type });
    await i.showModal(modal(`community:channel-add-submit:${token}`, 'Tambah channel', 'Satu nama per baris (maksimal 25)'));
  } else if (i.isModalSubmit() && id.startsWith('community:channel-add-submit:')) {
    const data = take(i, id.split(':')[2], 'add');
    if (!data) { await error(i, 'Pilihan kedaluwarsa atau sudah digunakan. Ulangi proses tambah.'); return; }
    const names = parseLines(i.fields.getTextInputValue('names'));
    if (!names.length || names.length > 25 || names.some(n => n.length > 100)) { await error(i, 'Masukkan 1–25 nama; setiap nama maksimal 100 karakter.'); return; }
    // Jangan membuat nama yang bertabrakan dengan kanal perlindungan di kategori ini.
    if (data.categoryId === i.channel.parentId && names.some(n => PROTECTED_NAMES.has(n.toLowerCase()))) {
      await error(i, 'Nama channel pengelola/inbox dilindungi di kategori ini.'); return;
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const category = await i.guild.channels.fetch(data.categoryId);
    if (!category || category.type !== ChannelType.GuildCategory) { await i.editReply('Kategori tidak lagi tersedia.'); return; }
    // Salin izin kategori secara eksplisit agar channel privat tidak dibuat terbuka.
    const inherited = category.permissionOverwrites.cache.map(o => ({ id: o.id, type: o.type, allow: o.allow.bitfield, deny: o.deny.bitfield }));
    let ok = 0; const errors = [];
    for (const name of names) {
      try {
        await i.guild.channels.create({ name, type: data.type, parent: category.id, permissionOverwrites: inherited, reason: `Dibuat oleh ${i.user.id} melalui panel` });
        ok++;
      } catch (e) { errors.push(`${name}: ${e.message}`); }
    }
    await i.editReply({ content: `Selesai: ${ok} channel dibuat, ${errors.length} gagal. Periksa izin channel baru.${errors.length ? `\n${errors.join('\n').slice(0, 1400)}` : ''}`, allowedMentions: { parse: [] } });
  } else if (i.isButton() && (id === 'community:channel-edit' || id === 'community:channel-delete')) {
    const action = id.endsWith('edit') ? 'edit' : 'delete';
    await i.reply({ content: `Pilih hingga 25 channel untuk ${action === 'edit' ? 'diubah namanya' : 'dihapus permanen'}. Channel pengelola dan inbox dilindungi.`,
      components: [menu(`community:channel-select-${action}`, CHANNEL_TYPES, 'Pilih satu atau beberapa channel', 25)], flags: MessageFlags.Ephemeral });
  } else if (i.isChannelSelectMenu() && (id === 'community:channel-select-edit' || id === 'community:channel-select-delete')) {
    const selected = i.values.map(value => i.guild.channels.cache.get(value));
    if (!selected.length || selected.length > 25 || selected.some(c => !validChannel(c, i))) { await error(i, 'Pilihan tidak valid atau memuat channel yang dilindungi.'); return; }
    if (id.endsWith('edit')) {
      const token = store(i, { kind: 'edit', ids: selected.map(c => c.id) });
      await i.showModal(modal(`community:channel-edit-submit:${token}`, 'Edit nama channel', 'Ubah nama setelah ID | (satu per baris)', selected.map(c => `${c.id} | ${c.name}`).join('\n')));
    } else {
      const token = store(i, { kind: 'delete', items: selected.map(c => ({ id: c.id, name: c.name, parentId: c.parentId, type: c.type })) });
      const list = selected.map(c => `• ${c.name} (${c.id})`).join('\n');
      await i.update({ content: '⚠️ Hapus channel berikut secara permanen? Riwayat pesan dan data di dalamnya juga akan hilang.',
        embeds: [new EmbedBuilder().setTitle('Channel yang akan dihapus').setDescription(list)],
        components: [row(button(`community:channel-confirm:${token}`, 'Ya, hapus permanen', ButtonStyle.Danger), button(`community:channel-cancel:${token}`, 'Batal', ButtonStyle.Secondary))] });
    }
  } else if (i.isModalSubmit() && id.startsWith('community:channel-edit-submit:')) {
    const data = take(i, id.split(':')[2], 'edit');
    if (!data) { await error(i, 'Pilihan kedaluwarsa atau sudah digunakan. Pilih channel lagi.'); return; }
    const entries = parseLines(i.fields.getTextInputValue('names')).map(line => {
      const pos = line.indexOf('|'); return pos < 0 ? null : { id: line.slice(0, pos).trim(), name: line.slice(pos + 1).trim() };
    });
    if (entries.length !== data.ids.length || entries.some(e => !e || !data.ids.includes(e.id) || !e.name || e.name.length > 100) || new Set(entries.map(e => e.id)).size !== data.ids.length) {
      await error(i, 'Format tidak valid. Setiap ID pilihan harus muncul sekali, diikuti | dan nama baru (maks. 100 karakter). Pilih ulang.'); return;
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    let ok = 0; const errors = [];
    for (const e of entries) {
      try {
        const c = await i.guild.channels.fetch(e.id);
        if (!validChannel(c, i)) throw Error('Channel tidak tersedia atau dilindungi');
        if (c.parentId === i.channel.parentId && PROTECTED_NAMES.has(e.name.toLowerCase())) throw Error('Nama channel pengelola/inbox dilindungi');
        await c.setName(e.name, `Diubah oleh ${i.user.id} melalui panel`); ok++;
      } catch (err) { errors.push(`${e.id}: ${err.message}`); }
    }
    await i.editReply({ content: `Selesai: ${ok} channel diubah, ${errors.length} gagal.${errors.length ? `\n${errors.join('\n').slice(0, 1400)}` : ''}`, allowedMentions: { parse: [] } });
  } else if (i.isButton() && id.startsWith('community:channel-cancel:')) {
    take(i, id.split(':')[2], 'delete');
    await i.update({ content: 'Penghapusan channel dibatalkan.', embeds: [], components: [] });
  } else if (i.isButton() && id.startsWith('community:channel-confirm:')) {
    const data = take(i, id.split(':')[2], 'delete');
    if (!data) { await error(i, 'Pilihan kedaluwarsa atau sudah digunakan. Pilih channel lagi.'); return; }
    await i.deferUpdate();
    let ok = 0; const errors = [];
    for (const item of data.items) {
      try {
        const c = await i.guild.channels.fetch(item.id);
        if (!validChannel(c, i) || c.name !== item.name || c.parentId !== item.parentId || c.type !== item.type) throw Error('Channel berubah, tidak tersedia, atau dilindungi');
        await c.delete(`Dihapus oleh ${i.user.id} melalui panel`); ok++;
      } catch (err) { errors.push(`${item.name}: ${err.message}`); }
    }
    await i.editReply({ content: `Selesai: ${ok} channel dihapus, ${errors.length} gagal.${errors.length ? `\n${errors.join('\n').slice(0, 1400)}` : ''}`,
      embeds: [], components: [], allowedMentions: { parse: [] } });
  } else {
    await error(i, 'Interaksi channel tidak dikenal.');
  }
}
module.exports = { channelManagePanel, handleChannelManagement };
