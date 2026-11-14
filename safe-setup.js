'use strict';
const {ChannelType,PermissionsBitField}=require('discord.js');
const {rolesToCreate,serverStructure}=require('./setup');
const {STATUS_ROLES,buildRulesAndRolePanel}=require('./role');
const F=PermissionsBitField.Flags;
async function setup(guild,client,setupCommunity){
 const roles=await guild.roles.fetch(), channels=await guild.channels.fetch();
 for(const spec of rolesToCreate){if(roles.filter(r=>r.name===spec.name&&r.id!==guild.id).size>1)throw Error(`Role ${spec.name} duplikat; rapikan sebelum setup.`);}
 for(const group of serverStructure){if(channels.filter(c=>c?.type===ChannelType.GuildCategory&&c.name===group.category).size>1)throw Error(`Kategori ${group.category} duplikat; rapikan sebelum setup.`);}
 for(const group of serverStructure)for(const ch of group.channels){if(channels.filter(c=>c?.name===ch.name&&c.type===ch.type).size>1)throw Error(`Channel ${ch.name} duplikat; rapikan sebelum setup.`);}
 const warnings=[], createdRoles=[], createdChannels=[], existingRoles={};
 for(const spec of rolesToCreate){
  let role=roles.find(r=>r.name===spec.name&&r.id!==guild.id);
  if(!role){
   // No privileged role permissions are granted by default on other people's servers.
   role=await guild.roles.create({name:spec.name,color:spec.color,hoist:spec.hoist,permissions:[],reason:'Setup komunitas tanpa menghapus role lama'});
   createdRoles.push(spec.name);
  }
  existingRoles[spec.name]=role;
 }
 const owner=await guild.fetchOwner();
 if(!owner.roles.cache.has(existingRoles.Owner.id)){
  try{await owner.roles.add(existingRoles.Owner,'Berikan role Owner kepada pemilik server');}
  catch(e){warnings.push('Role Owner tidak dapat diberikan otomatis. Periksa izin Manage Roles dan posisi role bot. Pemilik server tetap dapat mengelola bot.');}
 }
 const everyone=guild.roles.everyone.id,bot=client.user.id;
 const privatePerms=[{id:everyone,deny:[F.ViewChannel]},{id:existingRoles.Owner.id,allow:[F.ViewChannel,F.ReadMessageHistory,F.SendMessages]},{id:bot,allow:[F.ViewChannel,F.ReadMessageHistory,F.SendMessages,F.EmbedLinks]}];
 for(const group of serverStructure){
  let category=channels.find(c=>c?.type===ChannelType.GuildCategory&&c.name===group.category);
  if(!category){category=await guild.channels.create({name:group.category,type:ChannelType.GuildCategory,...(group.isPrivateOwnerOnly?{permissionOverwrites:privatePerms}:{}),reason:'Setup komunitas tanpa menghapus kategori lama'});}
  for(const ch of group.channels){
   if(channels.some(c=>c?.name===ch.name&&c.type===ch.type))continue;
   const overwrites=[];
   if(group.isPrivateOwnerOnly)overwrites.push(...privatePerms);
   else if(ch.type===ChannelType.GuildText){
    overwrites.push({id:everyone,allow:[F.ViewChannel,F.ReadMessageHistory,F.AddReactions],deny:[F.SendMessages,F.SendMessagesInThreads,F.CreatePublicThreads,F.CreatePrivateThreads]});
    overwrites.push({id:bot,allow:[F.ViewChannel,F.ReadMessageHistory,F.SendMessages,F.EmbedLinks,F.AttachFiles]});
    if(ch.name==='diskusi')for(const name of STATUS_ROLES)overwrites.push({id:existingRoles[name].id,allow:[F.ViewChannel,F.ReadMessageHistory,F.SendMessages,F.SendMessagesInThreads,F.EmbedLinks,F.AttachFiles,F.AddReactions]});
   }
   const created=await guild.channels.create({name:ch.name,type:ch.type,parent:category.id,topic:ch.topic||undefined,...(overwrites.length?{permissionOverwrites:overwrites}:{}),reason:'Setup komunitas tanpa menghapus channel lama'});
   createdChannels.push(ch.name);
   if(ch.type===ChannelType.GuildText&&ch.useInteractiveRolePanel)await created.send(buildRulesAndRolePanel(guild));
   else if(ch.type===ChannelType.GuildText&&ch.embed)await created.send({embeds:[ch.embed],allowedMentions:{parse:[]}});
  }
 }
 // Pastikan channel role lama juga memiliki panel, tanpa menghapus pesan lain.
 if(!createdChannels.includes('rules-and-role')){
  const all=await guild.channels.fetch();const rules=all.find(c=>c?.name==='rules-and-role'&&c.type===ChannelType.GuildText);
  if(rules){const messages=await rules.messages.fetch({limit:100});const found=messages.some(m=>m.author.id===client.user.id&&m.components.some(r=>r.components.some(c=>c.customId?.startsWith('select_role:'))));if(!found)await rules.send(buildRulesAndRolePanel(guild));}
 }
 const result=await setupCommunity(guild,client);
 if(result.feedbackWarning)warnings.push(result.feedbackWarning);
 if(result.welcomeWarning)warnings.push(result.welcomeWarning);
 return {createdRoles,createdChannels,warnings};
}
module.exports={setup};
