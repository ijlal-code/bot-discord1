const crypto = require('node:crypto');
const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelSelectMenuBuilder,
  ChannelType, EmbedBuilder, MessageFlags, ModalBuilder, PermissionsBitField,
  TextInputBuilder, TextInputStyle,
} = require('discord.js');
const selection = require('./selection-continue');
const backup = require('./backup');
const { CHANNEL: MESSAGE_CHANNEL, panel: messagePanel, handle: handleMessageEditor } = require('./message-management');
const { STATUS_ROLES } = require('./role');
const { channelManagePanel, handleChannelManagement } = require('./channel-management');
const { SETTINGS_CHANNEL, welcomePanel, handleWelcomeInteraction, suppressSystemWelcome, readConfig, updateLastMemberWelcome } = require('./welcome');
const { MEMBER_CHANNEL, memberPanel, handleMemberInteraction } = require('./member-management');

const CATEGORY = '🔐 KELOLA KOMUNITAS';
const MANAGE = 'kelola-kategori';
const MANAGE_CHANNEL = 'kelola-channel';
const INBOX = 'terima-form';
const FEEDBACK = 'feedback-and-request';
const pending = new Map();
const FLAGS = PermissionsBitField.Flags;

function getOwnerRole(guild) {
  const id = process.env.OWNER_ROLE_ID;
  if (id) {
    const role = guild.roles.cache.get(id);
    if (!role || role.id === guild.id || role.name === '@everyone') throw new Error('OWNER_ROLE_ID tidak valid.');
    return role;
  }
  const roles = guild.roles.cache.filter(r => r.name === 'Owner' && r.id !== guild.id);
  if (roles.size !== 1) throw new Error('Role Owner harus ada tepat satu, atau atur OWNER_ROLE_ID.');
  return roles.first();
}
function isOwner(interaction) {
  try { return !!interaction.member?.roles?.cache?.has(getOwnerRole(interaction.guild).id); }
  catch { return false; }
}
function store(interaction, data) {
  const now = Date.now();
  for (const [key, value] of pending) if (value.expires < now) pending.delete(key);
  const key = crypto.randomBytes(12).toString('hex');
  pending.set(key, { ...data, guildId: interaction.guildId, userId: interaction.user.id, expires: now + 15 * 60 * 1000 });
  return key;
}
function take(key, interaction, kind) {
  const item = pending.get(key);
  if (!item || item.expires < Date.now() || item.guildId !== interaction.guildId || item.userId !== interaction.user.id || item.kind !== kind) return null;
  pending.delete(key);
  return item;
}
function button(id, label, style) { return new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style); }
function managePanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x1e293b).setTitle('Kelola kategori server')
      .setDescription('Tambah beberapa kategori sekaligus, atau pilih beberapa kategori untuk diubah namanya atau dihapus. Penghapusan meminta konfirmasi.\n\nMenghapus kategori tidak menghapus kanal di dalamnya; periksa kembali izin kanal setelahnya.')],
    components: [row(
      button('community:add', 'Tambah kategori', ButtonStyle.Success),
      button('community:edit', 'Edit kategori', ButtonStyle.Primary),
      button('community:delete', 'Hapus kategori', ButtonStyle.Danger)
    )], allowedMentions: { parse: [] },
  };
}
function row(...components) { return new ActionRowBuilder().addComponents(...components); }
function feedbackPanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x1e293b).setTitle('Feedback & request')
      .setDescription('Kanal ini khusus formulir dan tidak digunakan untuk chat. Klik tombol di bawah, lalu isi judul dan saran atau permintaan. Hasil dikirim secara privat ke pengelola server. Pilih role terlebih dahulu di #rules-and-role.')],
    components: [row(button('community:feedback', 'Isi formulir', ButtonStyle.Primary))],
    allowedMentions: { parse: [] },
  };
}
function modal(id, title, inputId, label, value, max = 4000) {
  const input = new TextInputBuilder().setCustomId(inputId).setLabel(label)
    .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(max);
  if (value) input.setValue(value);
  return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(row(input));
}
function channelSelect(action) {
  return row(new ChannelSelectMenuBuilder().setCustomId(`community:select-${action}`)
    .setPlaceholder('Pilih satu atau beberapa kategori')
    .addChannelTypes(ChannelType.GuildCategory).setMinValues(1).setMaxValues(25));
}
function hasPanel(message, id) {
  return message.components.some(r => r.components.some(c => c.customId === id));
}
async function ensurePanel(channel, client, id, panel, refresh = false) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const existing = messages.find(m => m.author.id === client.user.id && hasPanel(m, id));
  if (!existing) await channel.send(panel);
  else if (refresh) await existing.edit(panel);
}
function privateOverwrites(guild, client, owner) {
  return [
    { id: guild.id, deny: [FLAGS.ViewChannel] },
    { id: owner.id, allow: [FLAGS.ViewChannel, FLAGS.ReadMessageHistory, FLAGS.SendMessages] },
    { id: client.user.id, allow: [FLAGS.ViewChannel, FLAGS.ReadMessageHistory, FLAGS.SendMessages, FLAGS.AttachFiles, FLAGS.EmbedLinks] },
  ];
}
async function setupCommunity(guild, client) {
  const [channels] = await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
  const owner = getOwnerRole(guild);
  const matches = channels.filter(c => c && c.type === ChannelType.GuildText && c.name === FEEDBACK);
  const feedback = matches.size === 1 ? matches.first() : null;
  let feedbackWarning = feedback ? null : 'Form feedback dilewati: pastikan tepat satu channel teks #feedback-and-request, lalu jalankan /setup-komunitas lagi.';
  const cats = channels.filter(c => c && c.type === ChannelType.GuildCategory && c.name === CATEGORY);
  if (cats.size > 1) throw new Error('Kategori KELOLA KOMUNITAS duplikat. Hapus duplikat secara manual.');
  const privatePerms = privateOverwrites(guild, client, owner);
  let category = cats.first();
  if (!category) category = await guild.channels.create({ name: CATEGORY, type: ChannelType.GuildCategory, permissionOverwrites: privatePerms, reason: 'Kategori privat kelola komunitas' });
  else await category.permissionOverwrites.set(privatePerms, 'Amankan kategori kelola komunitas');

  const made = {};
  for (const name of [MANAGE, MANAGE_CHANNEL, INBOX, SETTINGS_CHANNEL, MEMBER_CHANNEL, MESSAGE_CHANNEL]) {
    const matches = channels.filter(c => c && c.type === ChannelType.GuildText && c.parentId === category.id && c.name === name);
    if (matches.size > 1) throw new Error(`Kanal #${name} duplikat di kategori privat.`);
    let channel = matches.first();
    if (!channel) channel = await guild.channels.create({ name, type: ChannelType.GuildText, parent: category.id, permissionOverwrites: privatePerms, reason: 'Kanal privat pengelola' });
    else await channel.permissionOverwrites.set(privatePerms, 'Amankan kanal pengelola');
    made[name] = channel;
  }
  // Panel kelola member dipasang bahkan ketika channel feedback belum tersedia.
  await ensurePanel(made[MESSAGE_CHANNEL], client, 'community:initial-open', messagePanel(), true);
  await ensurePanel(made[MEMBER_CHANNEL], client, 'community:member-edit', memberPanel(), true);
  await ensurePanel(made[MANAGE], client, 'community:add', managePanel());
  await ensurePanel(made[MANAGE_CHANNEL], client, 'community:channel-add', channelManagePanel());
  await ensurePanel(made[SETTINGS_CHANNEL], client, 'community:welcome-edit:announcements', welcomePanel(), true);
  if (feedback) {
    try {
      // Cabut overwrite chat lama pada feedback; tidak menyentuh riwayat pesan.
      await feedback.permissionOverwrites.set([
        { id: guild.id, allow: [FLAGS.ViewChannel, FLAGS.ReadMessageHistory], deny: [FLAGS.SendMessages, FLAGS.SendMessagesInThreads, FLAGS.CreatePublicThreads, FLAGS.CreatePrivateThreads] },
        { id: owner.id, allow: [FLAGS.ViewChannel, FLAGS.ReadMessageHistory, FLAGS.SendMessages] },
        { id: client.user.id, allow: [FLAGS.ViewChannel, FLAGS.ReadMessageHistory, FLAGS.SendMessages, FLAGS.AttachFiles, FLAGS.EmbedLinks] },
      ], 'Jadikan feedback-and-request kanal formulir tanpa chat');
      await ensurePanel(feedback, client, 'community:feedback', feedbackPanel());
    } catch (error) {
      feedbackWarning = `Form feedback belum siap: ${error.message}. Periksa izin bot dan jalankan /setup-komunitas lagi.`;
      console.error('[FEEDBACK SETUP]', error.message);
    }
  }
  const backups = await backup.setupBackup(guild, client, owner, privatePerms);
  let welcomeWarning = null;
  try { await suppressSystemWelcome(guild); }
  catch (error) { welcomeWarning = `Gagal menonaktifkan welcome sistem Discord: ${error.message}`; console.error('[WELCOME SYSTEM]', error.message); }
  return { category, manage: made[MANAGE], manageChannels: made[MANAGE_CHANNEL], inbox: made[INBOX], welcome: made[SETTINGS_CHANNEL], member: made[MEMBER_CHANNEL], messageEditor: made[MESSAGE_CHANNEL], backups, feedback, feedbackWarning, welcomeWarning };
}
function safePrivateChannel(channel, guild, client, owner) {
  const overwrites = channel.permissionOverwrites.cache;
  if (!overwrites.get(guild.id)?.deny.has(FLAGS.ViewChannel)) return false;
  return !overwrites.some(o => ![guild.id, client.user.id, owner.id].includes(o.id) && o.allow.has(FLAGS.ViewChannel));
}
async function findInbox(guild, client) {
  const [channels] = await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
  const owner = getOwnerRole(guild);
  const categories = channels.filter(c => c && c.type === ChannelType.GuildCategory && c.name === CATEGORY);
  if (categories.size !== 1) throw new Error('Kategori privat tidak ditemukan atau duplikat. Hubungi Owner.');
  const found = channels.filter(c => c && c.type === ChannelType.GuildText && c.name === INBOX && c.parentId === categories.first().id);
  if (found.size !== 1 || !safePrivateChannel(found.first(), guild, client, owner)) throw new Error('Kanal penerima belum aman atau tidak ditemukan. Hubungi Owner.');
  return found.first();
}
function isFeedbackChannel(interaction) {
  return interaction.channel?.type === ChannelType.GuildText && interaction.channel.name === FEEDBACK;
}
function hasStatus(interaction) {
  return interaction.member?.roles?.cache?.some(r => STATUS_ROLES.includes(r.name)) || isOwner(interaction);
}
async function sendError(i, text) {
  if (i.deferred || i.replied) await i.editReply({ content: text, components: [] });
  else await i.reply({ content: text, flags: MessageFlags.Ephemeral });
}

async function handleCommunityInteraction(i, client, guildId) {
  if (!i.customId?.startsWith('community:')) return false;
  if (!i.guild || i.guildId !== guildId) { await sendError(i, '⛔ Interaksi tidak tersedia di server ini.'); return true; }
  const id = i.customId;
  const feedbackAction = id === 'community:feedback' || id === 'community:feedback-submit';
  if (feedbackAction) {
    if (!isFeedbackChannel(i)) { await sendError(i, '⛔ Gunakan panel di #feedback-and-request.'); return true; }
    if (!hasStatus(i)) { await sendError(i, 'Silakan pilih role terlebih dahulu di #rules-and-role.'); return true; }
    if (id === 'community:feedback' && i.isButton()) {
      const title = new TextInputBuilder().setCustomId('judul').setLabel('Judul feedback atau request').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true);
      const text = new TextInputBuilder().setCustomId('isi').setLabel('Jelaskan saran atau permintaan Anda').setStyle(TextInputStyle.Paragraph).setMaxLength(2000).setRequired(true);
      await i.showModal(new ModalBuilder().setCustomId('community:feedback-submit').setTitle('Form feedback & request').addComponents(row(title), row(text)));
      return true;
    }
    if (id === 'community:feedback-submit' && i.isModalSubmit()) {
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      const title = i.fields.getTextInputValue('judul').trim();
      const text = i.fields.getTextInputValue('isi').trim();
      if (!title || !text) { await i.editReply('Judul dan isi wajib diisi.'); return true; }
      const inbox = await findInbox(i.guild, client);
      const embed = new EmbedBuilder().setColor(0x1e293b).setTitle(title).setDescription(text)
        .addFields({ name: 'Pengirim', value: `${i.user.tag} (ID: ${i.user.id})` }).setTimestamp();
      await inbox.send({ embeds: [embed], allowedMentions: { parse: [] } });
      await i.editReply('✅ Formulir berhasil dikirim ke pengelola server.');
      return true;
    }
    return true;
  }
  if (!isOwner(i)) { await sendError(i, '⛔ Hanya anggota dengan role Owner yang dapat menggunakan fitur ini.'); return true; }
  if (await selection.intercept(i, p => handleCommunityInteraction(p, client, guildId))) return true;
  if (i.isButton() && id === 'community:cancel-selection') { await i.deferUpdate(); await i.deleteReply(); return true; }
  if (id.startsWith('community:backup-')) { await backup.handle(i, client, getOwnerRole); return true; }
  if (id.startsWith('community:initial-')) {
    if (!i.channel || i.channel.name !== MESSAGE_CHANNEL || i.channel.parent?.name !== CATEGORY) { await sendError(i, '⛔ Gunakan panel di #edit-pesan-channel-awal.'); return true; }
    await handleMessageEditor(i, client); return true;
  }
  if (id.startsWith('community:member-')) {
    if (!i.channel || i.channel.name !== MEMBER_CHANNEL || i.channel.parent?.name !== CATEGORY) {
      await sendError(i, '⛔ Gunakan panel di #kelola-member.'); return true;
    }
    await handleMemberInteraction(i, client, readConfig, updateLastMemberWelcome);
    return true;
  }
  if (id.startsWith('community:welcome-')) {
    if (!i.channel || i.channel.name !== SETTINGS_CHANNEL || i.channel.parent?.name !== CATEGORY) {
      await sendError(i, '⛔ Gunakan panel di #kelola-embed-welcome-member.'); return true;
    }
    await handleWelcomeInteraction(i, client);
    return true;
  }
  if (id.startsWith('community:channel-')) {
    if (!i.channel || i.channel.name !== MANAGE_CHANNEL || i.channel.parent?.name !== CATEGORY) {
      await sendError(i, '⛔ Gunakan panel di #kelola-channel.'); return true;
    }
    await handleChannelManagement(i);
    return true;
  }
  if (!i.channel || i.channel.name !== MANAGE || i.channel.parent?.name !== CATEGORY) {
    await sendError(i, '⛔ Gunakan panel di #kelola-kategori.'); return true;
  }
  if (i.isButton() && id === 'community:add') {
    await i.showModal(modal('community:add-submit', 'Tambah kategori', 'names', 'Satu nama kategori per baris (maks. 25)', undefined, 3000));
  } else if (i.isButton() && (id === 'community:edit' || id === 'community:delete')) {
    const action = id.endsWith('edit') ? 'edit' : 'delete';
    await i.reply({ content: `Pilih maksimal 25 kategori untuk ${action === 'edit' ? 'diubah namanya' : 'dihapus'}. Kategori kelola komunitas dilindungi.`, components: [channelSelect(action), selection.buttons()], flags: MessageFlags.Ephemeral });
  } else if (i.isChannelSelectMenu() && (id === 'community:select-edit' || id === 'community:select-delete')) {
    const categories = i.values.map(id => i.guild.channels.cache.get(id));
    if (!categories.length || categories.some(c => !c || c.type !== ChannelType.GuildCategory || (c.id === i.channel.parentId || c.name === backup.CATEGORY))) {
      await sendError(i, 'Pilihan tidak valid atau memuat kategori kelola komunitas yang dilindungi.'); return true;
    }
    if (id.endsWith('edit')) {
      const token = store(i, { kind: 'edit', ids: categories.map(c => c.id) });
      await i.showModal(modal(`community:edit-submit:${token}`, 'Edit nama kategori', 'names', 'Ubah nama setelah ID | (satu per baris)', categories.map(c => `${c.id} | ${c.name}`).join('\n')));
    } else {
      const token = store(i, { kind: 'delete', items: categories.map(c => ({ id: c.id, name: c.name })) });
      const list = categories.map(c => `• ${c.name} (${c.id})`).join('\n');
      await i.update({ content: '⚠️ Hapus kategori berikut? Kanal di dalamnya tidak dihapus, tetapi akan kehilangan kategori; periksa kembali izinnya.', embeds: [new EmbedBuilder().setTitle('Kategori yang akan dihapus').setDescription(list)], components: [row(button(`community:confirm-delete:${token}`, 'Ya, hapus kategori', ButtonStyle.Danger), button(`community:cancel:${token}`, 'Batal', ButtonStyle.Secondary))] });
    }
  } else if (i.isModalSubmit() && id === 'community:add-submit') {
    const names = i.fields.getTextInputValue('names').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    if (!names.length || names.length > 25 || names.some(n => n.length > 100)) { await sendError(i, 'Masukkan 1–25 nama; setiap nama maksimal 100 karakter.'); return true; }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    let ok = 0; const errors = [];
    for (const name of names) {
      try { await i.guild.channels.create({ name, type: ChannelType.GuildCategory, reason: `Dibuat oleh ${i.user.id} melalui panel` }); ok++; }
      catch (e) { errors.push(`${name}: ${e.message}`); }
    }
    await i.editReply({ content: `Selesai: ${ok} dibuat, ${errors.length} gagal.${errors.length ? `\n${errors.join('\n').slice(0, 1400)}` : ''}`, allowedMentions: { parse: [] } });
  } else if (i.isModalSubmit() && id.startsWith('community:edit-submit:')) {
    const data = take(id.split(':')[2], i, 'edit');
    if (!data) { await sendError(i, 'Pilihan kedaluwarsa atau sudah digunakan. Pilih kategori lagi.'); return true; }
    const lines = i.fields.getTextInputValue('names').split(/\r?\n/).filter(s => s.trim());
    const entries = lines.map(line => { const pos = line.indexOf('|'); return pos < 0 ? null : { id: line.slice(0, pos).trim(), name: line.slice(pos + 1).trim() }; });
    if (entries.length !== data.ids.length || entries.some(e => !e || !data.ids.includes(e.id) || !e.name || e.name.length > 100) || new Set(entries.map(e => e.id)).size !== data.ids.length) {
      await sendError(i, 'Format tidak valid. Setiap ID pilihan harus muncul satu kali, diikuti | dan nama baru (maks. 100 karakter). Pilih ulang.'); return true;
    }
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    let ok = 0; const errors = [];
    for (const e of entries) {
      try {
        const c = await i.guild.channels.fetch(e.id);
        if (!c || c.type !== ChannelType.GuildCategory || (c.id === i.channel.parentId || c.name === backup.CATEGORY)) throw Error('Kategori tidak tersedia atau dilindungi');
        await c.setName(e.name, `Diubah oleh ${i.user.id} melalui panel`); ok++;
      } catch (error) { errors.push(`${e.id}: ${error.message}`); }
    }
    await i.editReply({ content: `Selesai: ${ok} diubah, ${errors.length} gagal.${errors.length ? `\n${errors.join('\n').slice(0, 1400)}` : ''}`, allowedMentions: { parse: [] } });
  } else if (i.isButton() && id.startsWith('community:cancel:')) {
    take(id.split(':')[2], i, 'delete');
    await i.deferUpdate(); await i.deleteReply();
  } else if (i.isButton() && id.startsWith('community:confirm-delete:')) {
    const data = take(id.split(':')[2], i, 'delete');
    if (!data) { await sendError(i, 'Pilihan kedaluwarsa atau sudah digunakan. Pilih kategori lagi.'); return true; }
    await i.deferUpdate();
    let ok = 0; const errors = [];
    for (const item of data.items) {
      try {
        const c = await i.guild.channels.fetch(item.id);
        if (!c || c.type !== ChannelType.GuildCategory || c.name !== item.name || (c.id === i.channel.parentId || c.name === backup.CATEGORY)) throw Error('Kategori berubah, tidak tersedia, atau dilindungi');
        await c.delete(`Dihapus oleh ${i.user.id} melalui panel`); ok++;
      } catch (error) { errors.push(`${item.name}: ${error.message}`); }
    }
    await i.editReply({ content: `Selesai: ${ok} kategori dihapus, ${errors.length} gagal. Kanal anak tidak dihapus.${errors.length ? `\n${errors.join('\n').slice(0, 1400)}` : ''}`, embeds: [], components: [], allowedMentions: { parse: [] } });
  } else {
    await sendError(i, 'Interaksi tidak dikenal.');
  }
  return true;
}
module.exports = { setupCommunity, handleCommunityInteraction, isOwner, getOwnerRole, sendError };
