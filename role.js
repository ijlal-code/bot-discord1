const { ChannelType, PermissionsBitField } = require('discord.js');
const { STATUS_ROLES } = require('./role');
​
// Thread mengikuti izin channel induk; kategori tidak diubah agar akses lihat tetap aman.
const MESSAGE_CHANNEL_TYPES = new Set([
  ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildVoice,
  ChannelType.GuildStageVoice, ChannelType.GuildForum, ChannelType.GuildMedia,
]);
const CHAT_CHANNELS = new Set(['diskusi', 'feedback-and-request']);
const BOT_CHANNELS = new Set(['rules-and-role', 'announcements', ...CHAT_CHANNELS]);
const LOCKED = {
  SendMessages: false,
  SendMessagesInThreads: false,
  CreatePublicThreads: false,
  CreatePrivateThreads: false,
};
const CHAT_ACCESS = { SendMessages: true, SendMessagesInThreads: true };
const BOT_ACCESS = { SendMessages: true, SendMessagesInThreads: true };
​
function alreadySet(channel, id, updates) {
  const overwrite = channel.permissionOverwrites.cache.get(id);
  return overwrite && Object.entries(updates).every(([name, allow]) => {
    const flag = PermissionsBitField.Flags[name];
    return allow ? overwrite.allow.has(flag) : overwrite.deny.has(flag);
  });
}
​
async function setOverwrite(channel, id, values) {
  if (!alreadySet(channel, id, values)) {
    // edit mempertahankan izin lain pada overwrite yang sama.
    await channel.permissionOverwrites.edit(id, values, { reason: 'Wajib pilih role sebelum mengirim pesan' });
  }
}
​
async function getLockContext(guild) {
  const [channels, roles] = await Promise.all([guild.channels.fetch(), guild.roles.fetch()]);
  const rules = channels.find(c => c && c.name === 'rules-and-role' && c.type === ChannelType.GuildText);
  if (!rules) throw new Error('Kanal #rules-and-role tidak ditemukan; penguncian dibatalkan.');
  const statusRoles = STATUS_ROLES.map(name => {
    const matches = roles.filter(role => role.name === name);
    if (matches.size !== 1) throw new Error(`Role ${name} harus tersedia tepat satu; penguncian dibatalkan.`);
    return matches.first();
  });
  return { channels, statusRoles };
}
​
async function lockChannel(channel, guild, client, statusRoles) {
  if (!channel || !MESSAGE_CHANNEL_TYPES.has(channel.type)) return false;
  // Hindari memberikan akses tambahan ke kanal privat atau read-only selain dua kanal diskusi.
  // Dua kanal diskusi harus memiliki kebijakan akses sebagaimana setup.js.
  if (CHAT_CHANNELS.has(channel.name) && channel.type === ChannelType.GuildText) {
    for (const role of statusRoles) await setOverwrite(channel, role.id, CHAT_ACCESS);
  }
  if (BOT_CHANNELS.has(channel.name) && channel.type === ChannelType.GuildText) {
    await setOverwrite(channel, client.user.id, BOT_ACCESS);
  }
  // Ini hanya memblokir @everyone. Overwrite role/member lain dan Administrator tetap berlaku.
  await setOverwrite(channel, guild.roles.everyone.id, LOCKED);
  return true;
}
​
async function applyRoleLock(guild, client) {
  const { channels, statusRoles } = await getLockContext(guild);
  const errors = [];
  let checked = 0;
  for (const [, channel] of channels) {
    try {
      if (await lockChannel(channel, guild, client, statusRoles)) checked++;
    } catch (error) {
      errors.push(`${channel?.name || channel?.id}: ${error.message}`);
      console.error(`[ROLE LOCK] ${errors[errors.length - 1]}`);
    }
  }
  return { checked, errors };
}
​
async function lockNewChannel(channel, client) {
  if (!MESSAGE_CHANNEL_TYPES.has(channel.type)) return;
  const { statusRoles } = await getLockContext(channel.guild);
  await lockChannel(channel, channel.guild, client, statusRoles);
}
​
module.exports = { applyRoleLock, lockNewChannel };
​