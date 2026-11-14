'use strict';
const state=require('./state');
const running=new Set();
async function activateGuild(guild,register,{onlyNew=false}={}){
 if(running.has(guild.id))return {status:'pending'};
 running.add(guild.id);
 try{
  if(onlyNew&&await state.exists(guild.id))return {status:'existing'};
  const result=await register(guild.id);
  if(result.errors.length)throw Error('Pendaftaran slash gagal: '+result.errors.join('; '));
  await state.activate(guild.id);
  return {status:'active'};
 }finally{running.delete(guild.id);}
}
module.exports={activateGuild};
