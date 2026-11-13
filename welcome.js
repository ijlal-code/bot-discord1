const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, SystemChannelFlagsBitField,
} = require('discord.js');
const editor = require('./editor-template');
const { memberProfile, recordJoined, pendingRecord, markDone, trackMemberMessage, lastMemberMessage } = require('./member-management');

const SETTINGS_CHANNEL = 'kelola-embed-welcome-member';
const CATEGORY_NAME = '🔐 KELOLA KOMUNITAS';
// v2: template onboarding lama dengan hanya isi yang dapat diedit.
// Pesan konfigurasi v1 (termasuk lampiran) tidak dihapus atau dipakai otomatis.
const CONFIG_MARKER = 'welcome-config:v2:';
const JOIN_MARKER = 'welcome-member:v1:';
const configCache = new Map();
const savesInFlight = new Set();
const joinsInFlight = new Map();
const completing = new Set();

const LINKS = '**Portofolio & Kanal Resmi:**\n' +
  '• Website: https://ainunijlal.com/\n' +
  '• Studio: https://studio.ainunijlal.com/\n' +
  '• **YouTube:** https://www.youtube.com/@ainunijlal\n' +
  '• **TikTok:** https://www.tiktok.com/@ainunijlal\n' +
  '• **Instagram:** https://www.instagram.com/ainunijlal_ai/\n' +
  '• **LinkedIn:** https://www.linkedin.com/in/ainunijlal\n' +
  '• **Email:** ijlalainun@gmail.com';
const COMMON_GUIDE =
  `• **Diskusi Teknis:** Ajukan pertanyaan pemrograman dan desain pada {diskusi}.\n` +
  `• **Aset & Resource:** Akses starter template gratis pada {template}.\n\n`;
const DEFAULTS = {
  announcements: 'Halo {member}, terima kasih telah bergabung di komunitas resmi **Ainun Ijlal Studio**.\n\n' +
    '**Panduan Memulai:**\n' +
    '• **Verifikasi Role Status:** Pilih role status Anda pada {rules} untuk membuka akses kirim pesan.\n' + COMMON_GUIDE + LINKS,
  diskusi: 'Halo {member}, selamat datang di ruang diskusi komunitas resmi **Ainun Ijlal Studio**.\n\n' +
    '**Panduan Memulai:**\n' +
    '• **Verifikasi Role Status:** Anda telah memilih role **{role}** dan dapat mulai berdiskusi.\n' + COMMON_GUIDE + LINKS,
};
const DEFAULT_PARTS = {
  author: editor.DEFAULT_AUTHOR,
  title: editor.DEFAULT_TITLE,
  user: 'Nama Pengguna | `{tag}`',
  count: 'Anggota Ke | **#{member_count}**',
  created: 'Akun Dibuat | {account_created}',
  footer: 'Ainun Ijlal Studio Community • User ID: {id}',
  timestamp: 'YA',
};
const EMPTY = '\u200b';
const row = (...items) => new ActionRowBuilder().addComponents(...items);

function welcomePanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x1e293b).setTitle('Kelola pesan welcome & onboarding')
      .setDescription('Kedua pesan dikirim di #diskusi. Satu tombol membuka semua bagian untuk masing-masing pesan: author, judul, isi, informasi, footer, dan waktu.\n\n**Welcome member baru** dikirim saat bergabung, sebelum memilih role. **Onboarding setelah role** dikirim setelah memilih role pertama. Pengaturan sebelumnya tetap digunakan dan hanya berlaku untuk pesan berikutnya.\n\nHeader terdiri dari dua baris: author dan judul. Informasi tiga baris memakai `Judul | Isi`; gunakan `-` untuk menyembunyikan. Baris pertama footer YA/TIDAK untuk waktu, sisanya teks footer. Variabel: `{member}`, `{username}`, `{tag}`, `{id}`, `{server}`, `{member_count}`, `{role}`, `{account_created}`, `{rules}`, `{diskusi}`, `{template}`.')],
    components: [row(
      new ButtonBuilder().setCustomId('community:welcome-edit:announcements').setLabel('Edit welcome member baru').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('community:welcome-edit:diskusi').setLabel('Edit onboarding setelah role').setStyle(ButtonStyle.Primary)
    )], allowedMentions: { parse: [] },
  };
}
async function suppressSystemWelcome(guild) {
  if (!guild.systemChannelFlags.has(SystemChannelFlagsBitField.Flags.SuppressJoinNotifications)) {
    await guild.edit({ systemChannelFlags: guild.systemChannelFlags.add(SystemChannelFlagsBitField.Flags.SuppressJoinNotifications), reason: 'Hindari sambutan join Discord sebelum memilih role' });
  }
}
async function fetchNamedText(guild, name) {
  const channels = await guild.channels.fetch();
  const matches = channels.filter(c => c && c.type === ChannelType.GuildText && c.name === name);
  if (matches.size !== 1) throw new Error(`Harus ada tepat satu channel teks #${name}.`);
  return matches.first();
}
async function settingsChannel(guild) {
  const channels = await guild.channels.fetch();
  const cats = channels.filter(c => c && c.type === ChannelType.GuildCategory && c.name === CATEGORY_NAME);
  if (cats.size !== 1) return null;
  const found = channels.filter(c => c && c.type === ChannelType.GuildText && c.name === SETTINGS_CHANNEL && c.parentId === cats.first().id);
  if (found.size > 1) throw new Error('Channel pengaturan welcome duplikat.');
  return found.first() || null;
}
async function findConfigMessage(channel, client, target) {
  let before;
  do {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    const match = page.find(m => m.author.id === client.user.id && m.embeds[0]?.footer?.text === CONFIG_MARKER + target);
    if (match) return match;
    if (page.size < 100) return null;
    before = page.last()?.id;
  } while (before);
  return null;
}
function decodeConfig(message, target) {
  const embed = message?.embeds?.[0];
  const parts = { ...DEFAULT_PARTS };
  for (const key of Object.keys(parts)) {
    const f = embed?.fields?.find(field => field.name === `setting:${key}`);
    if (f) parts[key] = f.value === EMPTY ? '' : f.value;
  }
  return { body: embed?.description || DEFAULTS[target], parts };
}
async function readConfig(guild, client, target, force = false) {
  const key = `${guild.id}:${target}`;
  if (!force && configCache.has(key)) return configCache.get(key);
  const channel = await settingsChannel(guild);
  if (!channel) return decodeConfig(null, target);
  const message = await findConfigMessage(channel, client, target);
  const config = decodeConfig(message, target);
  if (message) configCache.set(key, config);
  return config;
}
async function readDiskusiBody(guild, client) { return (await readConfig(guild, client, 'diskusi')).body; }
async function saveConfig(guild, client, target, config, channel) {
  const existing = await findConfigMessage(channel, client, target);
  const embed = new EmbedBuilder().setColor(0x334155).setTitle(`Pengaturan onboarding #${target}`)
    .setDescription(config.body).addFields(Object.entries(config.parts).map(([name, value]) => ({ name: `setting:${name}`, value: value || EMPTY })))
    .setFooter({ text: CONFIG_MARKER + target });
  const payload = { embeds: [embed], allowedMentions: { parse: [] } };
  if (existing) await existing.edit(payload); else await channel.send(payload);
  configCache.set(`${guild.id}:${target}`, config);
}
async function handleWelcomeInteraction(i, client) {
  const [_, action, target] = i.customId.split(':');
  if (!['announcements', 'diskusi'].includes(target)) throw new Error('Pilihan welcome tidak valid.');
  if (i.isButton() && action === 'welcome-edit') {
    const config = await readConfig(i.guild, client, target, true);
    await i.showModal(editor.modal(`community:welcome-save-all:${target}`, target === 'announcements' ? 'Welcome member baru' : 'Onboarding setelah role', config));
    return;
  }
  if (i.isModalSubmit() && action === 'welcome-save-all') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const key = `${i.guildId}:${target}`;
    if (savesInFlight.has(key)) { await i.editReply('Pengaturan sedang disimpan. Coba lagi sebentar.'); return; }
    savesInFlight.add(key);
    try {
      let config;
      try { config = editor.read(i.fields); } catch (e) { await i.editReply(`❌ ${e.message}`); return; }
      await saveConfig(i.guild, client, target, config, i.channel);
      await i.editReply('✅ Semua pengaturan disimpan untuk pesan berikutnya di #diskusi.');
    } finally { savesInFlight.delete(key); }
    return;
  }
  throw new Error('Panel lama sudah tidak berlaku. Jalankan /setup-komunitas dan gunakan panel terbaru.');
}
function channelMention(guild, name) {
  const channel = guild.channels.cache.find(c => c && c.type === ChannelType.GuildText && c.name === name);
  return channel ? `<#${channel.id}>` : `#${name}`;
}
function fill(text, member, role) {
  const created = member.user.createdTimestamp;
  const vars = { member: `<@${member.id}>`, username: member.user.username, tag: member.user.tag || member.user.username, id: member.id,
    server: member.guild.name, member_count: String(member.guild.memberCount ?? '?'), role: role || 'belum dipilih',
    account_created: typeof created === 'number' && Number.isFinite(created) ? `<t:${Math.floor(created / 1000)}:D>` : 'Tidak diketahui',
    rules: channelMention(member.guild, 'rules-and-role'), diskusi: channelMention(member.guild, 'diskusi'),
    template: channelMention(member.guild, 'template-gratis') };
  return text.replace(/\{(member|username|tag|id|server|member_count|role|account_created|rules|diskusi|template)\}/g, (_, key) => vars[key]);
}
function marker(member, state) { return `${JOIN_MARKER}${member.id}:${member.joinedTimestamp || 0}:${state}`; }
function renderOnboarding(config, member, role, customBody) {
  const iconURL = member.guild.iconURL?.({ dynamic: true }) || undefined;
  const avatar = member.user.displayAvatarURL?.({ dynamic: true, size: 256 }) || undefined;
  const embed = new EmbedBuilder().setColor(0x0f172a)
    .setDescription(fill(customBody || config.body, member, role).slice(0, 3000));
  const author = fill(config.parts.author, member, role).slice(0, 256);
  const title = fill(config.parts.title, member, role).slice(0, 256);
  if (author) embed.setAuthor({ name: author, iconURL });
  if (title) embed.setTitle(title);
  for (const part of ['user', 'count', 'created']) {
    const value = config.parts[part];
    if (!value) continue;
    const pos = value.indexOf('|');
    if (pos < 0) continue;
    const name = fill(value.slice(0, pos).trim(), member, role).slice(0, 128);
    const content = fill(value.slice(pos + 1).trim(), member, role).slice(0, 600);
    if (name && content) embed.addFields({ name, value: content, inline: true });
  }
  const footer = fill(config.parts.footer, member, role).slice(0, 500);
  if (footer) embed.setFooter({ text: footer, iconURL });
  if (config.parts.timestamp === 'YA') embed.setTimestamp();
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}
async function buildMemberOnboarding(guild, client, member, role) {
  const [general, profile] = await Promise.all([readConfig(guild, client, 'diskusi'), memberProfile(guild, client, member.id)]);
  const config = profile ? { body: profile.body, parts: { ...general.parts, ...(profile.parts || {}) } } : general;
  const body = !profile && !role ? 'Halo {member}, member ini belum memilih role di {rules}.' : null;
  return { embeds: [renderOnboarding(config, member, role, body)], allowedMentions: { parse: [] } };
}
async function updateLastMemberWelcome(guild, client, member) {
  const reference = await lastMemberMessage(guild, client, member.id);
  const channel = await fetchNamedText(guild, 'diskusi');
  let message = null;
  if (reference && reference.channelId === channel.id && reference.messageId) {
    message = await channel.messages.fetch({ message: reference.messageId, force: true }).catch(() => null);
  }
  if (!message) {
    // Kompatibilitas pesan lama: hanya pesan bot sendiri dengan User ID persis di footer.
    let before;
    const markerText = `User ID: ${member.id}`;
    for (let pages = 0; pages < 10; pages++) {
      const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
      message = page.find(m => {
        const embed = m.embeds[0];
        const text = embed?.footer?.text || '';
        const at = text.indexOf(markerText);
        return m.author.id === client.user.id && embed?.author?.name === 'AINUN IJLAL STUDIO • MEMBER ONBOARDING' &&
          at >= 0 && !/\d/.test(text[at + markerText.length] || '');
      });
      if (message || page.size < 100) break;
      before = page.last()?.id;
      if (!before) break;
    }
  }
  if (!message || message.author.id !== client.user.id) return false;
  const selected = member.roles.cache.find(r => ['Pekerja', 'Pelajar', 'Umum'].includes(r.name));
  await message.edit(await buildMemberOnboarding(guild, client, member, selected?.name || ''));
  try { await trackMemberMessage(guild, client, member.id, message); } catch (error) { console.warn('[ONBOARDING TRACK]', error.message); }
  return true;
}
async function announceJoin(member, client) {
  const key = `${member.guild.id}:${member.id}`;
  const work = (async () => {
    const [channel, config] = await Promise.all([fetchNamedText(member.guild, 'diskusi'), readConfig(member.guild, client, 'announcements')]);
    await channel.send({ embeds: [renderOnboarding(config, member, '')], allowedMentions: { parse: [] } });
    await recordJoined(member, client);
  })();
  joinsInFlight.set(key, work);
  try { await work; } finally { if (joinsInFlight.get(key) === work) joinsInFlight.delete(key); }
}
async function findPendingAnnouncement(channel, client, member) {
  const pending = marker(member, 'pending');
  const done = marker(member, 'done');
  let before;
  do {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    // Menerima footer versi sebelumnya (marker saja) dan versi onboarding baru.
    const match = page.find(m => m.author.id === client.user.id &&
      [pending, done].some(mark => m.embeds[0]?.footer?.text?.endsWith(mark)));
    if (match) return match.embeds[0].footer.text.endsWith(pending) ? match : null;
    if (page.size < 100) return null;
    const oldest = page.last();
    if (member.joinedTimestamp && oldest?.createdTimestamp && oldest.createdTimestamp < member.joinedTimestamp - 60000) return null;
    before = oldest?.id;
  } while (before);
  return null;
}
async function welcomeAfterRole(member, client, role) {
  const key = `${member.guild.id}:${member.id}`;
  if (completing.has(key)) return;
  completing.add(key);
  try {
    if (joinsInFlight.has(key)) await joinsInFlight.get(key);
    const record = await pendingRecord(member, client);
    if (record?.done) return;
    // Kompatibilitas untuk member yang masuk menggunakan versi footer lama.
    const legacy = record ? null : await findPendingAnnouncement(await fetchNamedText(member.guild, 'announcements'), client, member);
    if (!record && !legacy) return;
    const diskusi = await fetchNamedText(member.guild, 'diskusi');
    const payload = await buildMemberOnboarding(member.guild, client, member, role);
    const sent = await diskusi.send(payload);
    try { await trackMemberMessage(member.guild, client, member.id, sent); } catch (error) { console.warn('[ONBOARDING TRACK]', error.message); }
    if (record) await markDone(member, record.message);
    else {
      const updated = EmbedBuilder.from(legacy.embeds[0]).setFooter({ text: marker(member, 'done') });
      await legacy.edit({ embeds: [updated], allowedMentions: { parse: [] } });
    }
  } finally { completing.delete(key); }
}
module.exports = { SETTINGS_CHANNEL, welcomePanel, handleWelcomeInteraction, announceJoin, welcomeAfterRole, suppressSystemWelcome, buildMemberOnboarding, readDiskusiBody, readConfig, updateLastMemberWelcome };
