const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, SystemChannelFlagsBitField,
} = require('discord.js');

const CATEGORY_NAME = '🔐 KELOLA KOMUNITAS';
const SETTINGS_CHANNEL = 'kelola-embed-welcome-member';
const CONFIG_MARKER = 'welcome-config:v1:';
const JOIN_MARKER = 'welcome-member:v1:';
const configCache = new Map();
const joinsInFlight = new Map();
const completing = new Set();
const DEFAULTS = {
  announcements: { title: 'Selamat datang, {username}!', body: 'Halo {member}, selamat datang di **{server}**!\n\nSilakan pilih role di #rules-and-role terlebih dahulu agar dapat mengirim pesan di #diskusi.', banner: '' },
  diskusi: { title: 'Selamat datang di ruang diskusi, {username}!', body: 'Halo {member}, selamat bergabung di **{server}**! Kamu sudah memilih role **{role}**. Silakan berkenalan dan mulai berdiskusi.', banner: '' },
};
const row = (...items) => new ActionRowBuilder().addComponents(...items);

function welcomePanel() {
  return {
    embeds: [new EmbedBuilder().setColor(0x1e293b).setTitle('Kelola embed welcome member')
      .setDescription('Pilih channel yang ingin diatur. Setiap channel memiliki judul, isi, dan URL banner sendiri. Pengaturan berlaku untuk welcome berikutnya, bukan pesan lama.\n\n`#announcements`: saat member bergabung.\n`#diskusi`: setelah member baru memilih role pertama kali.\n\nVariabel: `{member}`, `{username}`, `{server}`, `{member_count}`, `{role}`. Banner opsional, gunakan URL gambar HTTPS publik.')],
    components: [row(
      new ButtonBuilder().setCustomId('community:welcome-edit:announcements').setLabel('Edit announcements').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('community:welcome-edit:diskusi').setLabel('Edit diskusi').setStyle(ButtonStyle.Primary)
    )], allowedMentions: { parse: [] },
  };
}
async function suppressSystemWelcome(guild) {
  // Pertahankan flags sistem yang lain, hanya nonaktifkan join notification bawaan.
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
  // Data tersimpan di pesan bot Discord, bukan filesystem sementara Render.
  do {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    const match = page.find(m => m.author.id === client.user.id && m.embeds[0]?.footer?.text === CONFIG_MARKER + target);
    if (match) return match;
    if (page.size < 100) return null;
    before = page.last()?.id;
  } while (before);
  return null;
}
function parseConfig(message, target) {
  const e = message?.embeds?.[0];
  if (!e || e.footer?.text !== CONFIG_MARKER + target) return { ...DEFAULTS[target] };
  const title = e.fields?.find(f => f.name === 'Judul')?.value;
  const banner = e.fields?.find(f => f.name === 'Banner URL')?.value;
  return { title: title || DEFAULTS[target].title, body: e.description || DEFAULTS[target].body, banner: banner && banner !== '-' ? banner : '' };
}
function configEmbed(target, config) {
  return new EmbedBuilder().setColor(0x334155).setTitle(`Pengaturan welcome #${target}`)
    .setDescription(config.body).addFields({ name: 'Judul', value: config.title }, { name: 'Banner URL', value: config.banner || '-' })
    .setFooter({ text: CONFIG_MARKER + target });
}
async function readConfig(guild, client, target, force = false) {
  const key = `${guild.id}:${target}`;
  if (!force && configCache.has(key)) return configCache.get(key);
  const channel = await settingsChannel(guild);
  if (!channel) return { ...DEFAULTS[target] };
  const message = await findConfigMessage(channel, client, target);
  const value = parseConfig(message, target);
  if (message) configCache.set(key, value);
  return value;
}
async function saveConfig(guild, client, target, value, channel) {
  const existing = await findConfigMessage(channel, client, target);
  const payload = { embeds: [configEmbed(target, value)], allowedMentions: { parse: [] } };
  if (existing) await existing.edit(payload); else await channel.send(payload);
  configCache.set(`${guild.id}:${target}`, value);
}
function input(id, label, style, required, max, value) {
  const component = new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(style).setRequired(required).setMaxLength(max);
  if (value) component.setValue(value);
  return row(component);
}
async function handleWelcomeInteraction(i, client) {
  const parts = i.customId.split(':');
  const target = parts[2];
  if (!['announcements', 'diskusi'].includes(target)) throw new Error('Pilihan welcome tidak valid.');
  if (i.isButton() && parts[1] === 'welcome-edit') {
    const config = await readConfig(i.guild, client, target, true);
    const form = new ModalBuilder().setCustomId(`community:welcome-save:${target}`).setTitle(`Welcome #${target}`)
      .addComponents(input('title', 'Judul', TextInputStyle.Short, true, 120, config.title),
        input('body', 'Isi pesan', TextInputStyle.Paragraph, true, 1500, config.body),
        input('banner', 'URL banner HTTPS (kosongkan untuk hapus)', TextInputStyle.Short, false, 800, config.banner));
    await i.showModal(form);
    return;
  }
  if (i.isModalSubmit() && parts[1] === 'welcome-save') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const title = i.fields.getTextInputValue('title').trim();
    const body = i.fields.getTextInputValue('body').trim();
    const banner = i.fields.getTextInputValue('banner').trim();
    if (!title || !body) { await i.editReply('Judul dan isi tidak boleh kosong.'); return; }
    if (banner) {
      try { const url = new URL(banner); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); }
      catch { await i.editReply('URL banner harus berupa URL HTTPS publik yang valid.'); return; }
    }
    await saveConfig(i.guild, client, target, { title, body, banner }, i.channel);
    await i.editReply(`✅ Pengaturan welcome #${target} disimpan untuk member berikutnya.`);
    return;
  }
  throw new Error('Interaksi welcome tidak dikenal.');
}
function fill(text, member, role) {
  const vars = { member: `<@${member.id}>`, username: member.user.username, server: member.guild.name,
    member_count: String(member.guild.memberCount ?? ''), role: role || 'belum dipilih' };
  return text.replace(/\{(member|username|server|member_count|role)\}/g, (_, key) => vars[key]);
}
function renderWelcome(config, member, role, footer) {
  const embed = new EmbedBuilder().setColor(0x0f172a)
    .setTitle(fill(config.title, member, role).slice(0, 256))
    .setDescription(fill(config.body, member, role).slice(0, 4096)).setTimestamp();
  if (config.banner) embed.setImage(config.banner);
  if (footer) embed.setFooter({ text: footer });
  return embed;
}
function marker(member, state) {
  return `${JOIN_MARKER}${member.id}:${member.joinedTimestamp || 0}:${state}`;
}
async function announceJoin(member, client) {
  const key = `${member.guild.id}:${member.id}`;
  const work = (async () => {
    const [channel, config] = await Promise.all([fetchNamedText(member.guild, 'announcements'), readConfig(member.guild, client, 'announcements')]);
    await channel.send({ embeds: [renderWelcome(config, member, '', marker(member, 'pending'))], allowedMentions: { parse: [] } });
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
    const match = page.find(m => m.author.id === client.user.id && [pending, done].includes(m.embeds[0]?.footer?.text));
    if (match) return match.embeds[0].footer.text === pending ? match : null;
    if (page.size < 100) return null;
    // Pesan sebelum waktu join tidak mungkin cocok; hindari memindai seluruh riwayat.
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
    if (!pending) return; // Bukan member baru yang tercatat atau sudah disambut.
    const [diskusi, config] = await Promise.all([fetchNamedText(member.guild, 'diskusi'), readConfig(member.guild, client, 'diskusi')]);
    await diskusi.send({ embeds: [renderWelcome(config, member, role)], allowedMentions: { parse: [] } });
    const updated = EmbedBuilder.from(pending.embeds[0]).setFooter({ text: marker(member, 'done') });
    await pending.edit({ embeds: [updated], allowedMentions: { parse: [] } });
  } finally { completing.delete(key); }
}
module.exports = { SETTINGS_CHANNEL, welcomePanel, handleWelcomeInteraction, announceJoin, welcomeAfterRole, suppressSystemWelcome };
