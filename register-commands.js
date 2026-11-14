'use strict';
const { Routes, SlashCommandBuilder } = require('discord.js');
function definitions(){
 const locked=b=>b.setDefaultMemberPermissions(0).toJSON();
 return {
  guild:[
   locked(new SlashCommandBuilder().setName('setup-komunitas').setDescription('Siapkan panel privat komunitas tanpa reset server')),
   locked(new SlashCommandBuilder().setName('hapus-pesan').setDescription('Owner: backup dan hapus pesan di channel ini')),
   locked(new SlashCommandBuilder().setName('onboarding-member').setDescription('Tampilkan onboarding satu member di #diskusi').addUserOption(o=>o.setName('member').setDescription('Member yang ingin ditampilkan').setRequired(true)))
  ],
  global:[
   locked(new SlashCommandBuilder().setName('setup-server').setDescription('Reset dan bangun ulang server (menghapus data)')),
   locked(new SlashCommandBuilder().setName('kunci-chat').setDescription('Terapkan izin wajib memilih role')),
   locked(new SlashCommandBuilder().setName('panel-role').setDescription('Kirim panel pilihan role'))
  ]
 };
}
function findSlash(list,name){return list.find(c=>c.name===name&&(c.type==null||c.type===1));}
// Individual upserts only. Does not delete other commands or overwrite Integrations.
async function registerCommands(rest,applicationId,guildId){
 const {guild,global}=definitions(),result={guildSucceeded:[],errors:[]};
 const route=Routes.applicationGuildCommands(applicationId,guildId);
 try{const existing=await rest.get(route);for(const def of guild){try{const old=findSlash(existing,def.name);if(old)await rest.patch(Routes.applicationGuildCommand(applicationId,guildId,old.id),{body:def});else await rest.post(route,{body:def});result.guildSucceeded.push(def.name);}catch(e){result.errors.push(`/${def.name}: ${e.message}`);}}}catch(e){result.errors.push(`Guild: ${e.message}`);}

 return result;
}
async function registerGlobal(rest,applicationId){
 const {guild,global}=definitions(),result={errors:[]};
 // Global commands affect every guild using this application. Only update known
 // command definitions, and keep every other command and all explicit overwrites.
 try{const path=Routes.applicationCommands(applicationId),existing=await rest.get(path);for(const def of global){try{const old=findSlash(existing,def.name);if(old)await rest.patch(Routes.applicationCommand(applicationId,old.id),{body:def});else await rest.post(path,{body:def});}catch(e){result.errors.push(`Global /${def.name}: ${e.message}`);}}
  for(const def of guild){const old=findSlash(existing,def.name);if(old)try{await rest.patch(Routes.applicationCommand(applicationId,old.id),{body:def});}catch(e){result.errors.push(`Global /${def.name}: ${e.message}`);}}
 }catch(e){result.errors.push(`Global: ${e.message}`);}
 return result;
}
module.exports={definitions,registerCommands,registerGlobal};
