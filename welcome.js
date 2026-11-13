const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, SystemChannelFlagsBitField,
} = require('discord.js');

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
const row = (...items) => new ActionRowBuilder().addComponents(...items);

function welcomePanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x1e293b).setTitle('Kelola isi pesan onboarding')
      .setDescription('Edit isi pesan welcome onboarding lama untuk tiap channel secara terpisah. Susunan, judul, avatar, dan info anggota dibuat otomatis; tidak ada banner.\n\n' +
        '`#announcements`: saat member bergabung.\n`#diskusi`: setelah member baru memilih role pertama kali.\n\n' +
        'Variabel: `{member}`, `{username}`, `{server}`, `{member_count}`, `{role}`, `{rules}`, `{diskusi}`, `{template}`. Perubahan berlaku untuk sambutan berikutnya.')],
    components: [row(
      new ButtonBuilder().setCustomId('community:welcome-edit:announcements').setLabel('Edit announcements').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('community:welcome-edit:diskusi').setLabel('Edit diskusi').setStyle(ButtonStyle.Primary)
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
async function readConfig(guild, client, target, force = false) {
  const key = `${guild.id}:${target}`;
  if (!force && configCache.has(key)) return configCache.get(key);
  const channel = await settingsChannel(guild);
  if (!channel) return DEFAULTS[target];
  const message = await findConfigMessage(channel, client, target);
  const body = message?.embeds?.[0]?.description || DEFAULTS[target];
  if (message) configCache.set(key, body);
  return body;
}
async function saveConfig(guild, client, target, body, channel) {
  const existing = await findConfigMessage(channel, client, target);
  const configEmbed = new EmbedBuilder().setColor(0x334155).setTitle(`Isi onboarding #${target}`)
    .setDescription(body).setFooter({ text: CONFIG_MARKER + target });
  const payload = { embeds: [configEmbed], allowedMentions: { parse: [] } };
  if (existing) await existing.edit(payload);
  else await channel.send(payload);
  configCache.set(`${guild.id}:${target}`, body);
}
async function handleWelcomeInteraction(i, client) {
  const parts = i.customId.split(':');
  const target = parts[2];
  if (!['announcements', 'diskusi'].includes(target)) throw new Error('Pilihan welcome tidak valid.');
  if (i.isButton() && parts[1] === 'welcome-edit') {
    const body = await readConfig(i.guild, client, target, true);
    const field = new TextInputBuilder().setCustomId('body').setLabel('Isi pesan onboarding')
      .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(3000).setValue(body);
    const form = new ModalBuilder().setCustomId(`community:welcome-save:${target}`)
      .setTitle(`Onboarding #${target}`).addComponents(row(field));
    await i.showModal(form);
    return;
  }
  if (i.isModalSubmit() && parts[1] === 'welcome-save') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const key = `${i.guildId}:${target}`;
    if (savesInFlight.has(key)) { await i.editReply('Pengaturan sedang disimpan. Coba lagi sebentar.'); return; }
    savesInFlight.add(key);
    try {
      const body = i.fields.getTextInputValue('body').trim();
      if (!body || body.length > 3000) { await i.editReply('Isi wajib diisi dan maksimal 3.000 karakter.'); return; }
      await saveConfig(i.guild, client, target, body, i.channel);
      await i.editReply(`✅ Isi onboarding #${target} disimpan untuk member berikutnya.`);
    } finally { savesInFlight.delete(key); }
    return;
  }
  throw new Error('Interaksi welcome tidak dikenal.');
}
function channelMention(guild, name) {
  const channel = guild.channels.cache.find(c => c && c.type === ChannelType.GuildText && c.name === name);
  return channel ? `<#${channel.id}>` : `#${name}`;
}
function fill(text, member, role) {
  const vars = { member: `<@${member.id}>`, username: member.user.username, server: member.guild.name,
    member_count: String(member.guild.memberCount ?? ''), role: role || 'belum dipilih',
    rules: channelMention(member.guild, 'rules-and-role'), diskusi: channelMention(member.guild, 'diskusi'),
    template: channelMention(member.guild, 'template-gratis') };
  return text.replace(/\{(member|username|server|member_count|role|rules|diskusi|template)\}/g, (_, key) => vars[key]);
}
function marker(member, state) { return `${JOIN_MARKER}${member.id}:${member.joinedTimestamp || 0}:${state}`; }
function footer(member, state) {
  const base = `Ainun Ijlal Studio Community • User ID: ${member.id}`;
  return state ? `${base} • ${marker(member, state)}` : base;
}
function renderOnboarding(body, member, role, state) {
  const iconURL = member.guild.iconURL?.({ dynamic: true }) || undefined;
  const avatar = member.user.displayAvatarURL?.({ dynamic: true, size: 256 }) || undefined;
  const userTag = member.user.tag || member.user.username;
  const created = member.user.createdTimestamp;
  const embed = new EmbedBuilder().setColor(0x0f172a)
    .setAuthor({ name: 'AINUN IJLAL STUDIO • MEMBER ONBOARDING', iconURL })
    .setTitle(`Selamat Datang, ${member.user.username}`.slice(0, 256))
    .setDescription(fill(body, member, role).slice(0, 4096))
    .addFields(
      { name: 'Nama Pengguna', value: `\`${userTag}\``, inline: true },
      { name: 'Anggota Ke', value: `**#${member.guild.memberCount ?? '?'}**`, inline: true },
      { name: 'Akun Dibuat', value: typeof created === 'number' && Number.isFinite(created) ? `<t:${Math.floor(created / 1000)}:D>` : 'Tidak diketahui', inline: true }
    )
    .setFooter({ text: footer(member, state), iconURL }).setTimestamp();
  if (avatar) embed.setThumbnail(avatar);
  return embed;
}
async function announceJoin(member, client) {
  const key = `${member.guild.id}:${member.id}`;
  const work = (async () => {
    const [channel, body] = await Promise.all([fetchNamedText(member.guild, 'announcements'), readConfig(member.guild, client, 'announcements')]);
    await channel.send({ embeds: [renderOnboarding(body, member, '', 'pending')], allowedMentions: { parse: [] } });
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
    const announcement = await fetchNamedText(member.guild, 'announcements');
    const pending = await findPendingAnnouncement(announcement, client, member);
    if (!pending) return;
    const [diskusi, body] = await Promise.all([fetchNamedText(member.guild, 'diskusi'), readConfig(member.guild, client, 'diskusi')]);
    await diskusi.send({ embeds: [renderOnboarding(body, member, role)], allowedMentions: { parse: [] } });
    const iconURL = member.guild.iconURL?.({ dynamic: true }) || undefined;
    const updated = EmbedBuilder.from(pending.embeds[0]).setFooter({ text: footer(member, 'done'), iconURL });
    await pending.edit({ embeds: [updated], allowedMentions: { parse: [] } });
  } finally { completing.delete(key); }
}
module.exports = { SETTINGS_CHANNEL, welcomePanel, handleWelcomeInteraction, announceJoin, welcomeAfterRole, suppressSystemWelcome };
