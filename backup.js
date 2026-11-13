const crypto=require('node:crypto');
const {zipSync,strToU8}=require('fflate');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,ChannelSelectMenuBuilder,StringSelectMenuBuilder,MessageFlags,PermissionsBitField,EmbedBuilder}=require('discord.js');
const selection=require('./selection-continue');
const CATEGORY='🗄️ BACKUP', DELETED='pesan-dihapus', HISTORY='riwayat-chat';
const F=PermissionsBitField.Flags, sessions=new Map(), running=new Set(), lastJob=new Map();
const MAX_SELECT=10, MAX_ATTACHMENT=3*1024*1024, MAX_BATCH=6*1024*1024, PAGE=500, TTL=15*60*1000;
const row=(...x)=>new ActionRowBuilder().addComponents(...x);
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
function store(i,data){for(const [k,v]of sessions)if(v.expires<Date.now())sessions.delete(k);const k=crypto.randomBytes(12).toString('hex');sessions.set(k,{...data,user:i.user.id,guild:i.guildId,expires:Date.now()+TTL});return k;}
function read(i,k,consume=false){const x=sessions.get(k);if(!x||x.expires<Date.now()||x.user!==i.user.id||x.guild!==i.guildId)return null;if(consume)sessions.delete(k);return x;}
function historyPanel(){return {embeds:[new EmbedBuilder().setColor(0x334155).setTitle('Backup riwayat chat teks').setDescription('Pilih channel, lalu unduh ZIP berisi teks sampai 500 pesan per bagian. Tekan Lanjutkan riwayat untuk bagian berikutnya. File/media tidak disertakan. Hanya Owner yang dapat menggunakan panel; hasil unduhan privat.')],components:[row(btn('community:backup-history-open','Pilih channel',ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
function safe(ch,guild,client,owner){const p=ch.permissionOverwrites.cache;return !!p.get(guild.id)?.deny.has(F.ViewChannel)&&!p.some(o=>![guild.id,client.user.id,owner.id].includes(o.id)&&o.allow.has(F.ViewChannel));}
async function setupBackup(guild,client,owner,perms){
 const channels=await guild.channels.fetch();const cats=channels.filter(c=>c&&c.type===ChannelType.GuildCategory&&c.name===CATEGORY);
 if(cats.size>1)throw Error('Kategori BACKUP duplikat; periksa secara manual.');
 let cat=cats.first();if(!cat)cat=await guild.channels.create({name:CATEGORY,type:ChannelType.GuildCategory,permissionOverwrites:perms,reason:'Backup privat Owner'});else await cat.permissionOverwrites.set(perms,'Amankan kategori backup');
 const result={category:cat};
 for(const name of [DELETED,HISTORY]){const found=channels.filter(c=>c&&c.type===ChannelType.GuildText&&c.parentId===cat.id&&c.name===name);if(found.size>1)throw Error(`Channel #${name} duplikat.`);let c=found.first();if(!c)c=await guild.channels.create({name,type:ChannelType.GuildText,parent:cat.id,permissionOverwrites:perms,reason:'Backup privat Owner'});else await c.permissionOverwrites.set(perms,'Amankan channel backup');result[name]=c;}
 const history=result[HISTORY];const msgs=await history.messages.fetch({limit:100});const old=msgs.find(m=>m.author.id===client.user.id&&m.components.some(r=>r.components.some(c=>c.customId==='community:backup-history-open')));
 if(old)await old.edit(historyPanel());else await history.send(historyPanel());return result;
}
async function backupChannel(guild,client,owner){const channels=await guild.channels.fetch();const cats=channels.filter(c=>c&&c.type===ChannelType.GuildCategory&&c.name===CATEGORY);if(cats.size!==1||!safe(cats.first(),guild,client,owner))throw Error('Kategori backup belum tersedia atau tidak privat. Jalankan /setup-komunitas dan periksa izin.');const found=channels.filter(c=>c&&c.type===ChannelType.GuildText&&c.parentId===cats.first().id&&c.name===DELETED);if(found.size!==1||!safe(found.first(),guild,client,owner))throw Error('Channel #pesan-dihapus belum aman.');return found.first();}
function canRead(ch,i,client){if(!ch||!ch.isTextBased?.()||!ch.messages||ch.guildId!==i.guildId)return false;const u=ch.permissionsFor(i.member),b=ch.permissionsFor(client.user.id);return !!u?.has([F.ViewChannel,F.ReadMessageHistory])&&!!b?.has([F.ViewChannel,F.ReadMessageHistory]);}
function guardProtected(ch){if([CATEGORY,'🔐 KELOLA KOMUNITAS'].some(name=>ch.parent?.name===name||ch.parent?.parent?.name===name))throw Error('Channel backup dan pengelola dilindungi agar data konfigurasi tidak terhapus.');}
function allowedMsg(m){return m&&!m.system&&m.deletable;}
function fingerprint(m){return crypto.createHash('sha256').update(JSON.stringify({content:m.content,edited:m.editedTimestamp,embeds:m.embeds.map(e=>e.toJSON()),components:m.components.map(c=>c.toJSON()),attachments:[...m.attachments.values()].map(a=>({id:a.id,url:a.url,size:a.size}))})).digest('hex');}
function cooling(guildId){return running.has(guildId)||Date.now()-(lastJob.get(guildId)||0)<5000;}
function desc(m){const t=(m.content||'').replace(/\s+/g,' ').trim();return `${m.pinned?'📌 ':''}${t||`[${m.attachments?.size||0} lampiran / ${m.embeds?.length||0} embed]`}`.slice(0,80);}
function startJob(guildId){if(running.has(guildId))throw Error('Operasi backup lain sedang berlangsung. Tunggu sampai selesai.');const elapsed=Date.now()-(lastJob.get(guildId)||0);if(elapsed<5000)throw Error('Tunggu beberapa detik sebelum memulai backup berikutnya.');running.add(guildId);}
function endJob(guildId){running.delete(guildId);lastJob.set(guildId,Date.now());}
function z(files){return Buffer.from(zipSync(files,{level:1}));}
async function downloadAttachment(a,remaining){
 if(!Number.isFinite(a.size)||a.size>MAX_ATTACHMENT||a.size>remaining)throw Error('Lampiran terlalu besar untuk batas aman.');
 const url=new URL(a.url);if(url.protocol!=='https:'||!['cdn.discordapp.com','media.discordapp.net'].includes(url.hostname))throw Error('Sumber lampiran tidak diizinkan.');
 const response=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok||!response.body)throw Error(`Lampiran gagal diunduh (${response.status}).`);
 const reader=response.body.getReader();const chunks=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_ATTACHMENT||size>remaining)throw Error('Lampiran melampaui batas aman.');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 if(size!==a.size)throw Error('Ukuran lampiran tidak cocok; backup dibatalkan.');
 return Buffer.concat(chunks.map(x=>Buffer.from(x)),size);
}
async function archive(m,remaining){
 if(m.stickers?.size || m.poll || m.messageSnapshots?.size)throw Error('Stiker, polling, atau pesan terusan belum didukung; tidak dihapus.');
 if(!m.content && !m.attachments.size && !m.embeds.length && !m.components.length)throw Error('Isi tidak tersedia atau jenis pesan belum didukung; tidak dihapus. Periksa Message Content Intent.');
 if(m.attachments.size>4)throw Error('Terlalu banyak lampiran (maks. 4).');
 const meta={format:'backup-discord-v1',id:m.id,channelId:m.channelId,guildId:m.guildId,author:{id:m.author.id,tag:m.author.tag},createdAt:m.createdAt?.toISOString(),editedAt:m.editedAt?.toISOString()||null,content:m.content,embeds:m.embeds.map(e=>e.toJSON()),components:m.components.map(c=>c.toJSON()),attachments:[]};
 const files={};let size=0,n=0;
 for(const a of m.attachments.values()){
  const body=await downloadAttachment(a,remaining-size);size+=body.length;const path=`attachments/${++n}.bin`;files[path]=[new Uint8Array(body),{level:0}];
  meta.attachments.push({originalName:a.name,size:body.length,contentType:a.contentType,archivePath:path});
 }
 files['pesan.json']=strToU8(JSON.stringify(meta,null,2));const out=z(files);if(out.length>4*1024*1024)throw Error('ZIP backup terlalu besar.');return {data:out,bytes:size};
}
async function messageMenu(i,ch,client,before){
 const batch=await ch.messages.fetch({limit:25,...(before?{before}:{})});
 const all=[...batch.values()].sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1),eligible=all.filter(allowedMsg);
 const components=[];
 if(eligible.length){const key=store(i,{kind:'delete-list',channel:ch.id,ids:eligible.map(m=>m.id),summaries:Object.fromEntries(eligible.map(m=>[m.id,desc(m)]))});
  const options=eligible.map(m=>({label:`${(m.author.username||'Member').slice(0,30)} • ${m.id}`.slice(0,100),description:desc(m),value:m.id}));
  components.push(row(new StringSelectMenuBuilder().setCustomId('community:backup-delete-select').setPlaceholder('Pilih 1–10 pesan').setMinValues(1).setMaxValues(Math.min(MAX_SELECT,eligible.length)).addOptions(options)));components.push(selection.buttons());
  // Token yang terikat pada daftar ditempatkan pada customId dropdown.
  components[0].components[0].setCustomId(`community:backup-delete-select:${key}`);
 }else components.push(row(btn('community:cancel-selection','Batal')));
 if(all.length===25){const next=store(i,{kind:'delete-page',channel:ch.id,before:all.at(-1).id});components.push(row(btn(`community:backup-older:${next}`,'Pesan lebih lama')));}
 return {content:`Pilih maksimal ${MAX_SELECT} pesan di #${ch.name}. Daftar hanya menampilkan pesan yang dapat dihapus bot. Gunakan Pesan lebih lama bila perlu.`,components,allowedMentions:{parse:[]}};
}
async function deleteCommand(i,client,guildId,isOwner,getOwnerRole){
 if(!i.guild||i.guildId!==guildId||!isOwner(i)){await i.reply({content:'⛔ Hanya anggota role Owner pada server yang dikonfigurasi dapat memakai perintah ini.',flags:MessageFlags.Ephemeral});return;}
 await i.deferReply({flags:MessageFlags.Ephemeral});try{const ch=i.channel;if(!canRead(ch,i,client))throw Error('Bot dan Owner harus memiliki izin lihat serta riwayat di channel ini.');guardProtected(ch);if(!ch.permissionsFor(client.user.id)?.has(F.ManageMessages))throw Error('Bot memerlukan Manage Messages di channel ini.');await backupChannel(i.guild,client,getOwnerRole(i.guild));const menu=await messageMenu(i,ch,client);await i.editReply(menu);}catch(e){await i.editReply(`❌ ${e.message}`);}
}
async function runHistory(i,client,ch,before){
 if(!canRead(ch,i,client))throw Error('Owner dan bot harus dapat melihat dan membaca riwayat channel.');
 startJob(i.guildId);try{
  let cursor=before||undefined,count=0,blank=0,more=true;const lines=[JSON.stringify({format:'riwayat-chat-teks-v1',channelId:ch.id,channel:ch.name,exportedAt:new Date().toISOString(),keterangan:'Teks saja; file, gambar, embed dan pesan yang telah dihapus tidak disertakan.'})];
  while(count<PAGE){const batch=await ch.messages.fetch({limit:Math.min(100,PAGE-count),...(cursor?{before:cursor}:{})});const ordered=[...batch.values()].sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1);if(!ordered.length){more=false;break;}
   for(const m of ordered){if(!m.content)blank++;lines.push(JSON.stringify({id:m.id,waktu:m.createdAt?.toISOString(),penulis:m.author?.tag,penulisId:m.author?.id,teks:m.content||'',jumlahLampiran:m.attachments?.size||0}));count++;}
   cursor=ordered.at(-1).id;if(ordered.length<100){more=false;break;}await new Promise(r=>setTimeout(r,250));
  }
  if(!count)return {content:'Tidak ada pesan lagi untuk diekspor.',components:[]};
  const data=z({'riwayat.txt':strToU8(lines.join('\n')+'\n')});if(data.length>4*1024*1024)throw Error('Hasil terlalu besar untuk dikirim; ekspor dibatalkan.');
  const components=[];if(more){const key=store(i,{kind:'history-next',channel:ch.id,before:cursor});components.push(row(btn(`community:backup-history-next:${key}`,'Lanjutkan riwayat',ButtonStyle.Primary)));}
  return {attachments:[],content:`✅ ${count} pesan diekspor (terbaru ke terlama). ${more?'Mungkin masih ada pesan lama; tekan Lanjutkan riwayat setelah beberapa detik.':'Sudah sampai akhir riwayat.'} ZIP hanya berisi teks. ${blank?`${blank} pesan tanpa teks; jika tidak sesuai, periksa Message Content Intent.`:''}`,files:[{attachment:data,name:`riwayat-${ch.id}-${cursor}.zip`}],components,allowedMentions:{parse:[]}};
 }finally{endJob(i.guildId);}
}
async function handle(i,client,ownerRole){
 const id=i.customId;
 if(id==='community:backup-history-open'&&i.isButton()){
  if(i.channel.name!==HISTORY||i.channel.parent?.name!==CATEGORY)throw Error('Gunakan panel di #riwayat-chat.');
  return i.reply({content:'Pilih channel teks yang izinnya dapat diakses oleh Owner dan bot.',components:[row(new ChannelSelectMenuBuilder().setCustomId('community:backup-history-channel').setPlaceholder('Pilih channel').addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)),selection.buttons()],flags:MessageFlags.Ephemeral});
 }
 if(id==='community:backup-history-channel'&&i.isChannelSelectMenu()){
  if(i.channel.name!==HISTORY||i.channel.parent?.name!==CATEGORY)throw Error('Gunakan panel di #riwayat-chat.');
  await i.deferReply({flags:MessageFlags.Ephemeral});const ch=await i.guild.channels.fetch(i.values[0]);return i.editReply(await runHistory(i,client,ch));
 }
 if(id.startsWith('community:backup-history-next:')&&i.isButton()){
  if(i.channel.name!==HISTORY||i.channel.parent?.name!==CATEGORY)throw Error('Gunakan panel di #riwayat-chat.');
  const key=id.split(':')[2],data=read(i,key);if(!data||data.kind!=='history-next')throw Error('Pilihan riwayat kedaluwarsa.');
  if(cooling(i.guildId))return i.reply({content:'Tunggu beberapa detik, lalu tekan Lanjutkan riwayat lagi.',flags:MessageFlags.Ephemeral});
  await i.deferUpdate();const ch=await i.guild.channels.fetch(data.channel);const result=await runHistory(i,client,ch,data.before);sessions.delete(key);return i.editReply(result);
 }
 if(id.startsWith('community:backup-older:')&&i.isButton()){
  const data=read(i,id.split(':')[2]);if(!data||data.kind!=='delete-page'||data.channel!==i.channelId)throw Error('Pilihan kedaluwarsa. Jalankan slash lagi.');
  if(!canRead(i.channel,i,client))throw Error('Izin channel berubah.');guardProtected(i.channel);
  await i.deferUpdate();return i.editReply(await messageMenu(i,i.channel,client,data.before));
 }
 if(id.startsWith('community:backup-delete-select:')&&i.isStringSelectMenu()){
  const data=read(i,id.split(':')[2]);if(!data||data.kind!=='delete-list'||data.channel!==i.channelId||!i.values.length||i.values.length>MAX_SELECT||i.values.some(x=>!data.ids.includes(x)))throw Error('Pilihan tidak valid atau kedaluwarsa.');
  if(!canRead(i.channel,i,client))throw Error('Izin channel berubah.');guardProtected(i.channel);
  const key=store(i,{kind:'delete-confirm',channel:data.channel,ids:[...i.values]});
  return i.update({content:`⚠️ Hapus ${i.values.length} pesan berikut secara permanen? Setiap pesan dibackup terlebih dahulu. Lampiran terlalu besar/gagal atau tipe tidak didukung dilewati. Embed disimpan sebagai metadata; media dari URL eksternal tidak diunduh.\n${i.values.map(x=>`• ${x}: ${data.summaries[x]}`).join('\n')}`,components:[row(btn(`community:backup-confirm:${key}`,'Ya, backup dan hapus',ButtonStyle.Danger),btn('community:cancel-selection','Batal'))],allowedMentions:{parse:[]}});
 }
 if(id.startsWith('community:backup-confirm:')&&i.isButton()){
  const key=id.split(':')[2],data=read(i,key,true);if(!data||data.kind!=='delete-confirm'||data.channel!==i.channelId)throw Error('Konfirmasi kedaluwarsa atau sudah dipakai.');
  await i.deferUpdate();if(!canRead(i.channel,i,client)||!i.channel.permissionsFor(client.user.id)?.has(F.ManageMessages))throw Error('Izin akses atau Manage Messages berubah.');guardProtected(i.channel);
  const inbox=await backupChannel(i.guild,client,ownerRole(i.guild));startJob(i.guildId);let used=0,ok=0,fail=0;const errors=[];
  try{for(const id of data.ids){try{
    const m=await i.channel.messages.fetch({message:id,force:true});if(!allowedMsg(m))throw Error('Pesan tidak tersedia atau tidak dapat dihapus.');
    const snapshot=fingerprint(m);const saved=await archive(m,MAX_BATCH-used);used+=saved.bytes;
    const b=await inbox.send({content:`⏳ Backup pesan ${m.id} dari channel ${m.channelId}; menunggu penghapusan.`,files:[{attachment:saved.data,name:`pesan-${m.id}.zip`}],allowedMentions:{parse:[]}});
    try{const fresh=await i.channel.messages.fetch({message:id,force:true});if(!allowedMsg(fresh)||fingerprint(fresh)!==snapshot)throw Error('Pesan berubah setelah dicadangkan; dilewati.');await fresh.delete();ok++;await b.edit({content:`✅ Pesan ${m.id} dari channel ${m.channelId} telah dihapus; backup terlampir.`,allowedMentions:{parse:[]}}).catch(()=>{});}catch(e){await b.edit({content:`⚠️ Pesan ${m.id} gagal dihapus; backup tetap disimpan.`,allowedMentions:{parse:[]}}).catch(()=>{});throw e;}
   }catch(e){fail++;errors.push(`${id}: ${e.message}`);}await new Promise(r=>setTimeout(r,300));}
  }finally{endJob(i.guildId);}
  return i.editReply({content:`Selesai: ${ok} dihapus setelah backup, ${fail} dilewati/gagal.${errors.length?'\n'+errors.join('\n').slice(0,1300):''}`,components:[],allowedMentions:{parse:[]}});
 }
 throw Error('Interaksi backup tidak dikenal.');
}
module.exports={CATEGORY,DELETED,HISTORY,setupBackup,backupChannel,deleteCommand,handle,historyPanel,runHistory,archive,canRead,guardProtected};
