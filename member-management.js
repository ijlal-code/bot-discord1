const {
  ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, EmbedBuilder, MessageFlags,
  ModalBuilder, TextInputBuilder, TextInputStyle, UserSelectMenuBuilder, PermissionsBitField,
} = require('discord.js');

const MEMBER_CHANNEL = 'kelola-member';
const CATEGORY = '🔐 KELOLA KOMUNITAS';
const PROFILE_MARKER = 'member-onboarding:v1:';
const STATE_MARKER = 'member-join:v2:';
const LAST_MARKER = 'member-last-message:v1:';
const cache = new Map();
const saving = new Set();
const row = (...items) => new ActionRowBuilder().addComponents(...items);
function memberPanel() {
  return { embeds: [new EmbedBuilder().setColor(0x1e293b).setTitle('Kelola onboarding member')
    .setDescription('Pilih member untuk mengatur isi onboarding khususnya di #diskusi. Bot memperbarui pesan onboarding terakhirnya yang dapat ditemukan. Isi ini juga ditampilkan secara publik melalui `/onboarding-member`; jangan masukkan data rahasia. Jika belum diatur, bot memakai isi onboarding diskusi umum.')],
    components: [row(new ButtonBuilder().setCustomId('community:member-edit').setLabel('Edit onboarding member').setStyle(ButtonStyle.Primary))],
    allowedMentions: { parse: [] } };
}
function ownerRoleId(guild) {
  if (process.env.OWNER_ROLE_ID) return process.env.OWNER_ROLE_ID;
  const matches = guild.roles.cache.filter(r => r.id !== guild.id && r.name === 'Owner');
  if (matches.size !== 1) throw new Error('Role Owner tidak tersedia atau duplikat.');
  return matches.first().id;
}
async function memberChannel(guild, client) {
  const channels = await guild.channels.fetch();
  const cats = channels.filter(c => c && c.type === ChannelType.GuildCategory && c.name === CATEGORY);
  if (cats.size !== 1) return null;
  const found = channels.filter(c => c && c.type === ChannelType.GuildText && c.name === MEMBER_CHANNEL && c.parentId === cats.first().id);
  if (found.size > 1) throw new Error('Channel #kelola-member duplikat.');
  const ch = found.first();
  if (!ch) return null;
  const perms = ch.permissionOverwrites.cache;
  const allowed = [guild.id, ownerRoleId(guild), client.user.id];
  if (!perms.get(guild.id)?.deny.has(PermissionsBitField.Flags.ViewChannel) ||
      perms.some(p => !allowed.includes(p.id) && p.allow.has(PermissionsBitField.Flags.ViewChannel))) {
    throw new Error('#kelola-member tidak aman. Jalankan /setup-komunitas dan periksa izin.');
  }
  return ch;
}
async function findMessage(channel, client, footerText) {
  let before;
  do {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? {before} : {}) });
    const result = page.find(m => m.author.id === client.user.id && m.embeds[0]?.footer?.text === footerText);
    if (result) return result;
    if (page.size < 100) return null;
    before = page.last()?.id;
  } while (before);
  return null;
}
async function memberBody(guild, client, memberId) {
  const key = `${guild.id}:${memberId}`;
  if (cache.has(key)) return cache.get(key);
  const channel = await memberChannel(guild, client);
  if (!channel) return null;
  const record = await findMessage(channel, client, PROFILE_MARKER + memberId);
  if (!record) { cache.set(key, null); return null; }
  const body = record.embeds[0]?.description || null;
  if (body) cache.set(key, body);
  return body;
}
async function handleMemberInteraction(i, client, readGeneralBody, updateLastMessage) {
  if (i.isButton() && i.customId === 'community:member-edit') {
    await i.reply({ content: 'Pilih member yang onboarding-nya ingin diedit. Isi akan dapat dilihat di #diskusi melalui slash command.',
      components: [row(new UserSelectMenuBuilder().setCustomId('community:member-select').setPlaceholder('Pilih satu member').setMinValues(1).setMaxValues(1))],
      flags: MessageFlags.Ephemeral });
  } else if (i.isUserSelectMenu() && i.customId === 'community:member-select') {
    if (i.values.length !== 1) throw new Error('Pilih tepat satu member.');
    const userId = i.values[0];
    const member = await i.guild.members.fetch(userId).catch(() => null);
    if (!member || member.user.bot) throw new Error('Member tidak ditemukan atau akun adalah bot.');
    const body = await memberBody(i.guild, client, userId) || await readGeneralBody(i.guild, client);
    const text = new TextInputBuilder().setCustomId('body').setLabel('Isi onboarding publik member ini')
      .setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(3000).setValue(body);
    await i.showModal(new ModalBuilder().setCustomId(`community:member-save:${userId}`).setTitle('Edit onboarding member').addComponents(row(text)));
  } else if (i.isModalSubmit() && i.customId.startsWith('community:member-save:')) {
    const memberId = i.customId.split(':')[2];
    if (!/^\d{15,22}$/.test(memberId)) throw new Error('ID member tidak valid.');
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    const key = `${i.guildId}:${memberId}`;
    if (saving.has(key)) { await i.editReply('Sedang menyimpan member ini. Coba lagi.'); return; }
    saving.add(key);
    try {
      const member = await i.guild.members.fetch(memberId).catch(() => null);
      if (!member || member.user.bot) { await i.editReply('Member tidak ditemukan atau akun adalah bot.'); return; }
      const body = i.fields.getTextInputValue('body').trim();
      if (!body || body.length > 3000) { await i.editReply('Isi wajib diisi dan maksimal 3.000 karakter.'); return; }
      // Tolak penyimpanan jika channel tidak lagi privat.
      const privateChannel = await memberChannel(i.guild, client);
      if (!privateChannel || privateChannel.id !== i.channel.id) throw new Error('Channel #kelola-member tidak aman.');
      const existing = await findMessage(privateChannel, client, PROFILE_MARKER + memberId);
      const embed = new EmbedBuilder().setColor(0x334155).setTitle(`Onboarding member ${memberId}`)
        .setDescription(body).setFooter({ text: PROFILE_MARKER + memberId });
      const payload = { embeds: [embed], allowedMentions: { parse: [] } };
      if (existing) await existing.edit(payload); else await privateChannel.send(payload);
      cache.set(key, body);
      let result;
      try { result = await updateLastMessage(i.guild, client, member); }
      catch (error) { result = false; console.error('[ONBOARDING EDIT]', error); }
      await i.editReply(result
        ? '✅ Isi disimpan dan pesan onboarding terakhir member di #diskusi diperbarui. Isi juga tampil melalui /onboarding-member.'
        : '✅ Isi disimpan untuk /onboarding-member. Pesan lama tidak ditemukan atau tidak dapat diperbarui; jalankan perintah itu untuk membuat pesan yang dapat diedit.');
    } finally { saving.delete(key); }
  } else {
    throw new Error('Interaksi kelola member tidak dikenal.');
  }
}
async function handleMemberCommand(i, client, guildId, { isOwner, statusRoles, buildMemberOnboarding }) {
  if (!i.guild || i.guildId !== guildId || i.channel?.type !== ChannelType.GuildText || i.channel?.name !== 'diskusi') {
    await i.reply({ content: '⛔ Gunakan perintah ini di #diskusi pada server yang dikonfigurasi.', flags: MessageFlags.Ephemeral });
    return;
  }
  const hasStatus = i.member?.roles?.cache?.some(r => statusRoles.includes(r.name));
  if (!hasStatus && !isOwner(i)) {
    await i.reply({ content: 'Silakan pilih role terlebih dahulu di #rules-and-role.', flags: MessageFlags.Ephemeral });
    return;
  }
  await i.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const target = i.options.getUser('member', true);
    const member = await i.guild.members.fetch(target.id).catch(() => null);
    if (!member || member.user.bot) { await i.editReply('Member tidak ditemukan atau akun adalah bot.'); return; }
    const status = member.roles.cache.find(r => statusRoles.includes(r.name));
    const payload = await buildMemberOnboarding(i.guild, client, member, status?.name || '');
    const message = await i.channel.send(payload);
    try { await trackMemberMessage(i.guild, client, member.id, message); }
    catch (error) { console.error('[ONBOARDING TRACK]', error); }
    await i.editReply('✅ Onboarding member telah ditampilkan di #diskusi.');
  } catch (error) {
    console.error('[ONBOARDING MEMBER ERROR]', error);
    await i.editReply(`❌ Tidak dapat menampilkan onboarding: ${error.message}`);
  }
}
async function trackMemberMessage(guild, client, memberId, message) {
  const channel = await memberChannel(guild, client);
  if (!channel) throw new Error('#kelola-member belum tersedia.');
  const existing = await findMessage(channel, client, LAST_MARKER + memberId);
  const embed = new EmbedBuilder().setColor(0x334155).setTitle('Referensi onboarding terakhir')
    .setDescription(`Member ID: ${memberId}`).addFields(
      { name: 'channel-id', value: message.channelId }, { name: 'message-id', value: message.id })
    .setFooter({ text: LAST_MARKER + memberId });
  const payload = { embeds: [embed], allowedMentions: { parse: [] } };
  if (existing) await existing.edit(payload); else await channel.send(payload);
}
async function lastMemberMessage(guild, client, memberId) {
  const channel = await memberChannel(guild, client);
  if (!channel) return null;
  const record = await findMessage(channel, client, LAST_MARKER + memberId);
  if (!record) return null;
  const fields = record.embeds[0]?.fields || [];
  return { channelId: fields.find(f => f.name === 'channel-id')?.value, messageId: fields.find(f => f.name === 'message-id')?.value };
}
function stateKey(member, state) { return `${STATE_MARKER}${member.id}:${member.joinedTimestamp || 0}:${state}`; }
async function recordJoined(member, client) {
  const channel = await memberChannel(member.guild, client);
  if (!channel) throw new Error('Channel #kelola-member belum tersedia; jalankan /setup-komunitas.');
  const embed = new EmbedBuilder().setColor(0x334155).setTitle('Status onboarding member')
    .setDescription(`Member ID: ${member.id}\nMenunggu pemilihan role pertama.`)
    .setFooter({ text: stateKey(member, 'pending') }).setTimestamp();
  return channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
}
async function pendingRecord(member, client) {
  const channel = await memberChannel(member.guild, client);
  if (!channel) return null;
  const pending = stateKey(member, 'pending'); const done = stateKey(member, 'done');
  let before;
  do {
    const page = await channel.messages.fetch({ limit: 100, ...(before ? { before } : {}) });
    const message = page.find(m => m.author.id === client.user.id && [pending, done].includes(m.embeds[0]?.footer?.text));
    if (message) return { message, done: message.embeds[0].footer.text === done };
    if (page.size < 100) return null;
    const oldest = page.last();
    if (member.joinedTimestamp && oldest?.createdTimestamp && oldest.createdTimestamp < member.joinedTimestamp - 60000) return null;
    before = oldest?.id;
  } while (before);
  return null;
}
async function markDone(member, record) {
  const embed = EmbedBuilder.from(record.embeds[0]).setDescription(`Member ID: ${member.id}\nSambutan diskusi telah dikirim.`)
    .setFooter({ text: stateKey(member, 'done') });
  await record.edit({ embeds: [embed], allowedMentions: { parse: [] } });
}
module.exports = { MEMBER_CHANNEL, memberPanel, handleMemberInteraction, handleMemberCommand, memberBody, recordJoined, pendingRecord, markDone, trackMemberMessage, lastMemberMessage };
