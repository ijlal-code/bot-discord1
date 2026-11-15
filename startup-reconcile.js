'use strict';
// Startup reconciles registrations only. It must never scan or alter channel permissions.
async function reconcileAtStartup(guilds,{state,activateGuild,register,log=console}){
 for(const guild of guilds){
  try{
   const record=await state.readConfig(guild.id);
   if(!record||record.leftGuild)await activateGuild(guild,register,{onlyNew:!record});
  }catch(e){log.warn(`[AKTIVASI ${guild.id}] ${e.message}`);}
 }
}
module.exports={reconcileAtStartup};
