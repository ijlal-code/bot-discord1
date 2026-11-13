const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder,
  MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, SystemChannelFlagsBitField,
  FileUploadBuilder, LabelBuilder,
} = require('discord.js');

const CATEGORY_NAME = '🔐 KELOLA KOMUNITAS';
const SETTINGS_CHANNEL = 'kelola-embed-welcome-member';
const CONFIG_MARKER = 'welcome-config:v1:';
const JOIN_MARKER = 'welcome-member:v1:';
const UPLOAD_MARKER = '[gambar diunggah]';
const MAX_BANNER_SIZE = 8 * 1024 * 1024;
const savesInFlight = new Set();
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
      .setDescription('Pilih channel yang ingin diatur. Setiap channel memiliki judul, isi, dan URL banner sendiri. Pengaturan berlaku untuk welcome berikutnya, bukan pesan lama.\n\n`#announcements`: saat member bergabung.\n`#diskusi`: setelah member baru memilih role pertama kali.\n\nVariabel: `{member}`, `{username}`, `{server}`, `{member_count}`, `{role}`. Banner opsional: unggah gambar atau gunakan URL HTTPS publik. Unggahan baru diutamakan; ketik HAPUS untuk menghapus banner.')],
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
  if (!e || e.footer?.text !== CONFIG_MARKER + target) return { ...DEFAULTS[target], uploaded: false };
  const title = e.fields?.find(f => f.name === 'Judul')?.value;
  const banner = e.fields?.find(f => f.name === 'Banner URL')?.value;
  const uploaded = banner === UPLOAD_MARKER;
  return { title: title || DEFAULTS[target].title, body: e.description || DEFAULTS[target].body,
    banner: banner && banner !== '-' && !uploaded ? banner : '', uploaded, messageId: message.id };
}
function configEmbed(target, config, filename) {
  const embed = new EmbedBuilder().setColor(0x334155).setTitle(`Pengaturan welcome #${target}`)
    .setDescription(config.body).addFields({ name: 'Judul', value: config.title },
      { name: 'Banner URL', value: config.uploaded ? UPLOAD_MARKER : (config.banner || '-') })
    .setFooter({ text: CONFIG_MARKER + target });
  if (config.uploaded && filename) embed.setImage(`attachment://${filename}`);
  return embed;
}
async function readConfig(guild, client, target, force = false) {
  const key = `${guild.id}:${target}`;
  if (!force && configCache.has(key)) return configCache.get(key);
  const channel = await settingsChannel(guild);
  if (!channel) return { ...DEFAULTS[target], uploaded: false };
  const message = await findConfigMessage(channel, client, target);
  const value = parseConfig(message, target);
  if (message) configCache.set(key, value);
  return value;
}
// Hanya unduh attachment Discord yang disediakan oleh Discord; jangan fetch URL bebas.
async function downloadDiscordImage(attachment) {
  if (!attachment || (attachment.size != null && attachment.size > MAX_BANNER_SIZE)) throw new Error('Gambar tidak tersedia atau ukurannya melebihi 8 MB.');
  let url;
  try { url = new URL(attachment.url); } catch { throw new Error('URL lampiran Discord tidak valid.'); }
  if (url.protocol !== 'https:' || !['cdn.discordapp.com', 'media.discordapp.net'].includes(url.hostname) || url.username || url.password || url.port) throw new Error('Sumber lampiran bukan CDN Discord yang diizinkan.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, { redirect: 'error', signal: controller.signal });
    if (!response.ok || !response.body) throw new Error(`Gagal mengunduh gambar (HTTP ${response.status}).`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > MAX_BANNER_SIZE) throw new Error('Gambar melebihi 8 MB.');
    const chunks = []; let total = 0;
    for await (const chunk of response.body) {
      total += chunk.length;
      if (total > MAX_BANNER_SIZE) { controller.abort(); throw new Error('Gambar melebihi 8 MB.'); }
      chunks.push(Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);
    let ext = '';
    if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) ext = 'png';
    else if (buffer.length >= 3 && buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) ext = 'jpg';
    else if (buffer.length >= 6 && ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))) ext = 'gif';
    else if (buffer.length >= 12 && buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') ext = 'webp';
    if (!ext) throw new Error('Gunakan gambar PNG, JPG, GIF, atau WebP yang valid.');
    return { buffer, filename: `welcome-banner.${ext}` };
  } finally { clearTimeout(timer); }
}
async function saveConfig(guild, client, target, value, channel, image) {
  const existing = await findConfigMessage(channel, client, target);
  const payload = { embeds: [configEmbed(target, value, image?.filename)], allowedMentions: { parse: [] } };
  if (image) payload.files = [{ attachment: image.buffer, name: image.filename }];
  // Buat pesan baru sebelum menghapus pesan lama supaya gambar/config lama tetap aman jika gagal.
  const saved = await channel.send(payload);
  configCache.set(`${guild.id}:${target}`, { ...value, messageId: saved.id });
  if (existing && existing.id !== saved.id) await existing.delete().catch(error => console.warn('[WELCOME CONFIG] Gagal menghapus konfigurasi lama:', error.message));
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
        input('banner', 'URL banner HTTPS (opsional)', TextInputStyle.Short, false, 800, config.banner),
        new LabelBuilder().setLabel('Unggah gambar banner (opsional)').setDescription('PNG, JPG, GIF, atau WebP, maksimal 8 MB; unggahan mengalahkan URL.')
          .setFileUploadComponent(new FileUploadBuilder().setCustomId('banner_upload').setRequired(false).setMinValues(0).setMaxValues(1).setFileTypes('image')),
        input('remove', 'Ketik HAPUS untuk menghapus banner', TextInputStyle.Short, false, 5, ''));
    await i.showModal(form);
    return;
  }
  if (i.isModalSubmit() && parts[1] === 'welcome-save') {
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const key = `${i.guildId}:${target}`;
    if (savesInFlight.has(key)) { await i.editReply('Pengaturan sedang disimpan. Coba lagi sebentar.'); return; }
    savesInFlight.add(key);
    try {
      const title = i.fields.getTextInputValue('title').trim();
      const body = i.fields.getTextInputValue('body').trim();
      const banner = i.fields.getTextInputValue('banner').trim();
      let remove = '';
      try { remove = (i.fields.getTextInputValue('remove') || '').trim().toUpperCase(); } catch { /* modal versi lama */ }
      let uploaded = null;
      const uploadField = i.fields.fields?.get('banner_upload');
      if (i.fields.getUploadedFiles && (uploadField || !i.fields.fields)) {
        uploaded = i.fields.getUploadedFiles('banner_upload')?.first() || null;
        if (uploadField?.values?.length && !uploaded) throw new Error('Discord belum menyediakan lampiran; coba unggah kembali.');
      }
      if (!title || !body) { await i.editReply('Judul dan isi tidak boleh kosong.'); return; }
      if (remove && remove !== 'HAPUS') { await i.editReply('Isi kolom hapus dengan HAPUS atau biarkan kosong.'); return; }
      if (remove && uploaded) { await i.editReply('Pilih satu: unggah gambar baru atau hapus banner.'); return; }
      const oldMessage = await findConfigMessage(i.channel, client, target);
      const old = parseConfig(oldMessage, target);
      let image = null;
      let value = { title, body, banner: '', uploaded: false };
      if (remove === 'HAPUS') {
        // Banner dihapus; URL lama yang terisi otomatis diabaikan.
      } else if (uploaded) {
        image = await downloadDiscordImage(uploaded);
        value.uploaded = true;
      } else if (banner) {
        try { const url = new URL(banner); if (url.protocol !== 'https:' || url.username || url.password) throw Error(); }
        catch { await i.editReply('URL banner harus berupa URL HTTPS publik yang valid.'); return; }
        value.banner = banner;
      } else if (old.uploaded) {
        // Pertahankan gambar lama saat hanya judul/isi yang diubah.
        image = await downloadDiscordImage(oldMessage?.attachments?.first());
        value.uploaded = true;
      } else {
        value.banner = old.banner || '';
      }
      await saveConfig(i.guild, client, target, value, i.channel, image);
      await i.editReply(`✅ Pengaturan welcome #${target} disimpan untuk member berikutnya.`);
    } finally { savesInFlight.delete(key); }
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
async function welcomePayload(config, member, client, role, footer) {
  const embed = renderWelcome(config, member, role, footer);
  const payload = { embeds: [embed], allowedMentions: { parse: [] } };
  if (config.uploaded && config.messageId) {
    try {
      const channel = await settingsChannel(member.guild);
      if (!channel) throw new Error('Channel pengaturan welcome tidak ditemukan.');
      // force: true memperbarui URL lampiran Discord yang dapat kedaluwarsa.
      const stored = await channel.messages.fetch({ message: config.messageId, force: true });
      if (!stored || stored.author.id !== client.user.id) throw new Error('Pesan konfigurasi tidak ditemukan.');
      const image = await downloadDiscordImage(stored.attachments.first());
      embed.setImage(`attachment://${image.filename}`);
      payload.files = [{ attachment: image.buffer, name: image.filename }];
    } catch (error) {
      // Welcome tetap dikirim jika CDN bermasalah; admin dapat melihat penyebabnya di log.
      console.error('[WELCOME BANNER ERROR]', error.message);
    }
  }
  return payload;
}
function marker(member, state) {
  return `${JOIN_MARKER}${member.id}:${member.joinedTimestamp || 0}:${state}`;
}
async function announceJoin(member, client) {
  const key = `${member.guild.id}:${member.id}`;
  const work = (async () => {
    const [channel, config] = await Promise.all([fetchNamedText(member.guild, 'announcements'), readConfig(member.guild, client, 'announcements')]);
    await channel.send(await welcomePayload(config, member, client, '', marker(member, 'pending')));
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
    await diskusi.send(await welcomePayload(config, member, client, role));
    const updated = EmbedBuilder.from(pending.embeds[0]).setFooter({ text: marker(member, 'done') });
    await pending.edit({ embeds: [updated], allowedMentions: { parse: [] } });
  } finally { completing.delete(key); }
}
module.exports = { SETTINGS_CHANNEL, welcomePanel, handleWelcomeInteraction, announceJoin, welcomeAfterRole, suppressSystemWelcome };
