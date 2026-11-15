'use strict';
// A restart only registers missing records as inactive. No activation or permission recovery.
async function reconcileAtStartup(guilds,{state,log=console}){
 for(const guild of guilds){try{await state.ensurePending(guild.id);}catch(e){log.warn(`[SERVER ${guild.id}] Gagal mencatat server: ${e.message}`);}}
}
module.exports={reconcileAtStartup};
