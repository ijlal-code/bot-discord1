const crypto=require('node:crypto');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle}=require('discord.js');
const sessions=new Map();
const replay=Symbol('selectionReplay');
const supported=id=>['community:select-edit','community:select-delete','community:channel-create-category','community:channel-select-edit','community:channel-select-delete','community:member-select','community:initial-channel','community:backup-history-channel','community:backup-delete-select'].includes(id)||id.startsWith('community:initial-message:')||id.startsWith('community:backup-delete-select:');
function buttons(id='community:continue-wait') {return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(id).setLabel('Lanjutkan').setStyle(ButtonStyle.Primary).setDisabled(id==='community:continue-wait'),new ButtonBuilder().setCustomId('community:cancel-selection').setLabel('Batal').setStyle(ButtonStyle.Secondary));}
async function intercept(i,handle){
 if(i[replay])return false;
 if(i.isButton?.()&&i.customId.startsWith('community:continue:')){
  const data=sessions.get(i.customId.split(':')[2]);
  if(!data||data.expires<Date.now()||data.user!==i.user.id||data.guild!==i.guildId||data.channel!==i.channelId||data.message!==i.message?.id){await i.reply({content:'Pilihan kedaluwarsa. Mulai ulang dari panel.',flags:64});return true;}
  const p=new Proxy(i,{get(target,key){if(key===replay)return true;if(key==='customId')return data.id;if(key==='values')return data.values;if(key==='isButton')return ()=>false;if(key==='isChannelSelectMenu')return ()=>data.kind==='channel';if(key==='isUserSelectMenu')return ()=>data.kind==='user';if(key==='isStringSelectMenu')return ()=>data.kind==='string';const v=Reflect.get(target,key,target);return typeof v==='function'?v.bind(target):v;}});
  await handle(p);return true;
 }
 const kind=i.isChannelSelectMenu?.()?'channel':i.isUserSelectMenu?.()?'user':i.isStringSelectMenu?.()?'string':null;
 if(!kind||!supported(i.customId)||!i.message?.components)return false;
 const selectRow=i.message.components.map(r=>r.toJSON()).find(r=>r.components?.some(c=>c.custom_id===i.customId));
 if(!selectRow)throw Error('Dropdown tidak ditemukan. Buka panel lagi.');
 const select=selectRow.components.find(c=>c.custom_id===i.customId);
 if(kind==='string')for(const opt of select.options)opt.default=i.values.includes(opt.value);
 else select.default_values=i.values.map(id=>({id,type:kind}));
 for(const [key,v] of sessions)if(v.expires<Date.now())sessions.delete(key);
 const key=crypto.randomBytes(12).toString('hex');sessions.set(key,{id:i.customId,kind,values:[...i.values],user:i.user.id,guild:i.guildId,channel:i.channelId,message:i.message.id,expires:Date.now()+15*60*1000});
 const extras=i.message.components.map(r=>r.toJSON()).filter(r=>!r.components?.some(c=>c.custom_id===i.customId||c.custom_id==='community:cancel-selection')).slice(0,3);
 await i.update({content:'Pilihan tersimpan. Tekan **Lanjutkan** untuk membuka langkah berikutnya, atau pilih ulang. Jika formulir ditutup tanpa menyimpan, tekan Lanjutkan lagi.',components:[selectRow,buttons(`community:continue:${key}`),...extras],allowedMentions:{parse:[]}});
 return true;
}
module.exports={buttons,intercept};
