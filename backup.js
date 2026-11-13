const crypto=require('node:crypto');
const {zipSync,unzipSync,strToU8}=require('fflate');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelType,ChannelSelectMenuBuilder,StringSelectMenuBuilder,MessageFlags,PermissionsBitField,EmbedBuilder,ModalBuilder,TextInputBuilder,TextInputStyle}=require('discord.js');
const selection=require('./selection-continue');
const CATEGORY='🗄️ BACKUP', DELETED='pesan-dihapus', HISTORY='riwayat-chat';
const F=PermissionsBitField.Flags, sessions=new Map(), running=new Set(), lastJob=new Map();
const MAX_SELECT=10, MAX_ATTACHMENT=3*1024*1024, MAX_BATCH=6*1024*1024, PAGE=500, TTL=15*60*1000;
const row=(...x)=>new ActionRowBuilder().addComponents(...x);
const btn=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(id).setLabel(label).setStyle(style);
function store(i,data){for(const [k,v]of sessions)if(v.expires<Date.now())sessions.delete(k);const k=crypto.randomBytes(12).toString('hex');sessions.set(k,{...data,user:i.user.id,guild:i.guildId,expires:Date.now()+TTL});return k;}
function read(i,k,consume=false){const x=sessions.get(k);if(!x||x.expires<Date.now()||x.user!==i.user.id||x.guild!==i.guildId)return null;if(consume)sessions.delete(k);return x;}
function historyPanel(){return {embeds:[new EmbedBuilder().setColor(0x334155).setTitle('Backup riwayat chat teks').setDescription('Pilih channel, lalu unduh ZIP berisi teks sampai 500 pesan per bagian. Tekan Lanjutkan riwayat untuk bagian berikutnya. File/media tidak disertakan. Hanya Owner yang dapat menggunakan panel; hasil unduhan privat.')],components:[row(btn('community:backup-history-open','Pilih channel',ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
function deletedPanel(){return {embeds:[new EmbedBuilder().setColor(0x334155).setTitle('Kelola pesan yang dihapus').setDescription('Pesan yang dihapus disalin di bawah sebagai pesan bot. Pilih Bersihkan untuk menghapus salinan tanpa backup, atau Backup & bersihkan untuk menyimpan ZIP ke #riwayat-chat dahulu. Setiap tindakan meminta konfirmasi dan memproses maksimal 25 pesan per tahap.')],components:[row(btn('community:backup-clear-open','Bersihkan channel',ButtonStyle.Danger),btn('community:backup-archive-open','Backup & bersihkan',ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
function safe(ch,guild,client,owner){const p=ch.permissionOverwrites.cache;return !!p.get(guild.id)?.deny.has(F.ViewChannel)&&!p.some(o=>![guild.id,client.user.id,owner.id].includes(o.id)&&o.allow.has(F.ViewChannel));}
async function setupBackup(guild,client,owner,perms){
 const channels=await guild.channels.fetch();const cats=channels.filter(c=>c&&c.type===ChannelType.GuildCategory&&c.name===CATEGORY);
 if(cats.size>1)throw Error('Kategori BACKUP duplikat; periksa secara manual.');
 let cat=cats.first();if(!cat)cat=await guild.channels.create({name:CATEGORY,type:ChannelType.GuildCategory,permissionOverwrites:perms,reason:'Backup privat Owner'});else await cat.permissionOverwrites.set(perms,'Amankan kategori backup');
 const result={category:cat};
 for(const name of [DELETED,HISTORY]){const found=channels.filter(c=>c&&c.type===ChannelType.GuildText&&c.parentId===cat.id&&c.name===name);if(found.size>1)throw Error(`Channel #${name} duplikat.`);let c=found.first();if(!c)c=await guild.channels.create({name,type:ChannelType.GuildText,parent:cat.id,permissionOverwrites:perms,reason:'Backup privat Owner'});else await c.permissionOverwrites.set(perms,'Amankan channel backup');result[name]=c;}
 const history=result[HISTORY];const msgs=await history.messages.fetch({limit:100});const old=msgs.find(m=>m.author.id===client.user.id&&m.components.some(r=>r.components.some(c=>c.customId==='community:backup-history-open')));
 if(old)await old.edit(historyPanel());else await history.send(historyPanel());
 const deleted=result[DELETED];const dm=await deleted.messages.fetch({limit:100});const oldPanel=dm.find(m=>m.author.id===client.user.id&&m.components.some(r=>r.components.some(c=>(c.customId||c.data?.custom_id)==='community:backup-clear-open')));if(oldPanel)await oldPanel.edit(deletedPanel());else await deleted.send(deletedPanel());return result;
}
async function privateBackupChannel(guild,client,owner,name){const channels=await guild.channels.fetch();const cats=channels.filter(c=>c&&c.type===ChannelType.GuildCategory&&c.name===CATEGORY);if(cats.size!==1||!safe(cats.first(),guild,client,owner))throw Error('Kategori backup belum tersedia atau tidak privat. Jalankan /setup-komunitas dan periksa izin.');const found=channels.filter(c=>c&&c.type===ChannelType.GuildText&&c.parentId===cats.first().id&&c.name===name);if(found.size!==1||!safe(found.first(),guild,client,owner))throw Error(`Channel #${name} belum aman.`);return found.first();}
async function backupChannel(guild,client,owner){return privateBackupChannel(guild,client,owner,DELETED);}
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
function validateBackupMessage(m) {
 if(m.stickers?.size || m.poll || m.messageSnapshots?.size)throw Error('Stiker, polling, atau pesan terusan belum didukung; tidak dihapus.');
 if(!m.content && !m.attachments.size && !m.embeds.length && !m.components.length)throw Error('Isi tidak tersedia atau jenis pesan belum didukung; tidak dihapus. Periksa Message Content Intent.');
 if(m.attachments.size>4)throw Error('Terlalu banyak lampiran (maks. 4).');
}
function copyEmbed(e){
 const data=e.toJSON();
 if(data.type && data.type!=='rich')throw Error('Embed otomatis/eksternal belum dapat disalin dengan aman.');
 // Salin hanya properti embed yang dapat dikirim; proxy dan ukuran dari Discord bersifat read-only.
 const result={};for(const key of ['title','description','url','timestamp','color'])if(data[key]!=null)result[key]=data[key];
 if(data.author)result.author={name:data.author.name,...(data.author.url?{url:data.author.url}:{}),...(data.author.icon_url?{icon_url:data.author.icon_url}:{})};
 if(data.footer)result.footer={text:data.footer.text,...(data.footer.icon_url?{icon_url:data.footer.icon_url}:{})};
 if(data.image?.url)result.image={url:data.image.url};if(data.thumbnail?.url)result.thumbnail={url:data.thumbnail.url};
 if(data.fields)result.fields=data.fields.map(f=>({name:f.name,value:f.value,inline:!!f.inline}));
 for(const url of [result.url,result.image?.url,result.thumbnail?.url,result.author?.url,result.author?.icon_url,result.footer?.icon_url].filter(Boolean))if(!/^https:\/\//i.test(url)&&!/^attachment:\/\//i.test(url))throw Error('URL embed tidak didukung.');
 if(!result.title&&!result.description&&!result.fields?.length&&!result.image&&!result.thumbnail&&!result.author)throw Error('Embed kosong tidak dapat disalin.');
 return result;
}
async function copyOriginal(m,remaining){
 validateBackupMessage(m);
 if(m.components?.length)throw Error('Pesan berkomponen interaktif tidak dapat disalin sebagai tombol; dilewati.');
 const embeds=m.embeds.map(copyEmbed);const files=[],fileMap=new Map(),urlMap=new Map();let size=0,n=0;
 for(const a of m.attachments.values()){const body=await downloadAttachment(a,remaining-size);size+=body.length;
  const base=(a.name||'file').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,80)||'file';const name=`${++n}-${base}`;files.push({attachment:body,name});if(a.name)fileMap.set(a.name,name);urlMap.set(new URL(a.url).pathname,name);}
 const remap=value=>{if(!value)return value;if(value.startsWith('attachment://')){const name=fileMap.get(value.slice(13));if(!name)throw Error('Referensi lampiran embed tidak ditemukan.');return `attachment://${name}`;}try{const name=urlMap.get(new URL(value).pathname);return name?`attachment://${name}`:value;}catch{return value;}};
 for(const e of embeds){if(e.image?.url)e.image.url=remap(e.image.url);if(e.thumbnail?.url)e.thumbnail.url=remap(e.thumbnail.url);if(e.author?.icon_url)e.author.icon_url=remap(e.author.icon_url);if(e.footer?.icon_url)e.footer.icon_url=remap(e.footer.icon_url);}
 return {payload:{content:m.content||'',embeds,files,allowedMentions:{parse:[]}},bytes:size};
}
async function archive(m,remaining){
 validateBackupMessage(m);
 const meta={format:'backup-discord-v1',id:m.id,channelId:m.channelId,guildId:m.guildId,author:{id:m.author.id,tag:m.author.tag},createdAt:m.createdAt?.toISOString(),editedAt:m.editedAt?.toISOString()||null,content:m.content,embeds:m.embeds.map(e=>e.toJSON()),components:m.components.map(c=>c.toJSON()),attachments:[]};
 const files={};let size=0,n=0;
 for(const a of m.attachments.values()){
  const body=await downloadAttachment(a,remaining-size);size+=body.length;const path=`attachments/${++n}.bin`;files[path]=[new Uint8Array(body),{level:0}];
  meta.attachments.push({originalName:a.name,size:body.length,contentType:a.contentType,archivePath:path});
 }
 files['pesan.json']=strToU8(JSON.stringify(meta,null,2));const out=z(files);if(out.length>4*1024*1024)throw Error('ZIP backup terlalu besar.');return {data:out,bytes:size};
}
function menu(i,ch,entries,nav,context) {
 const components=[];
 if(entries.length){const key=store(i,{kind:'delete-list',channel:ch.id,ids:entries.map(m=>m.id),summaries:Object.fromEntries(entries.map(m=>[m.id,m.summary]))});
  const options=entries.map(m=>({label:`${m.author.slice(0,30)} • ${m.id}`.slice(0,100),description:m.summary,value:m.id}));
  components.push(row(new StringSelectMenuBuilder().setCustomId(`community:backup-delete-select:${key}`).setPlaceholder('Pilih 1–10 pesan').setMinValues(1).setMaxValues(Math.min(MAX_SELECT,entries.length)).addOptions(options)),selection.buttons());
 } else components.push(row(btn('community:cancel-selection','Batal')));
 const actions=[];
 if(nav)actions.push(btn(`community:backup-older:${nav}`,'Berikutnya'));
 const n=store(i,{kind:'delete-nav',channel:ch.id});
 actions.push(btn(`community:backup-first:${n}`,'Kembali ke awal'),btn(`community:backup-search:${n}`,'Cari pesan',ButtonStyle.Primary));components.push(row(...actions));
 return {content:`${context} Pilih maksimal ${MAX_SELECT} pesan. Cari berdasarkan teks, nama atau ID; pencarian teks dibatasi 500 pesan terbaru.`,components,allowedMentions:{parse:[]}};
}
function entry(m){return {id:m.id,author:(m.author.username||'Member').replace(/\s+/g,' ').slice(0,30),summary:desc(m)};}
async function messageMenu(i,ch,client,before){
 const batch=await ch.messages.fetch({limit:25,...(before?{before}:{})});
 const all=[...batch.values()].sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1),entries=all.filter(allowedMsg).map(entry);
 const next=all.length===25?store(i,{kind:'delete-page',channel:ch.id,before:all.at(-1).id}):null;
 return menu(i,ch,entries,next,`Pesan di #${ch.name} (25 pesan per halaman).`);
}
function searchPage(i,ch,data,offset){
 const entries=data.entries.slice(offset,offset+25);const next=offset+25<data.entries.length?store(i,{kind:'search-page',channel:ch.id,entries:data.entries,offset:offset+25}):null;
 return menu(i,ch,entries,next,`Hasil pencarian: ${data.entries.length} cocok dalam batas pencarian; menampilkan ${entries.length?offset+1:0}–${offset+entries.length}.`);
}
async function searchMessages(i,ch,query){
 const q=query.trim().toLocaleLowerCase();if(q.length<2||q.length>100)throw Error('Kata pencarian harus 2–100 karakter.');
 startJob(i.guildId);try {
  if(/^\d{15,22}$/.test(q)){const m=await ch.messages.fetch({message:q,force:true}).catch(()=>null);return m&&allowedMsg(m)?[entry(m)]:[];}
  let before,scanned=0;const results=[];
  while(scanned<500){const batch=await ch.messages.fetch({limit:100,...(before?{before}:{})});const list=[...batch.values()].sort((a,b)=>BigInt(a.id)>BigInt(b.id)?-1:1);if(!list.length)break;
   for(const m of list){scanned++;if(allowedMsg(m)&&`${m.id} ${m.author.username||''} ${m.author.tag||''} ${m.content||''}`.toLocaleLowerCase().includes(q))results.push(entry(m));}
   before=list.at(-1).id;if(list.length<100)break;await new Promise(r=>setTimeout(r,250));
  }return results;
 }finally{endJob(i.guildId);}
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
function isDeletedPanel(m,client){return m.author?.id===client.user.id&&m.components.some(r=>r.components.some(c=>(c.customId||c.data?.custom_id)==='community:backup-clear-open'));}
async function cleanupDeleted(i,client,ownerRole,mode){
 const source=await privateBackupChannel(i.guild,client,ownerRole(i.guild),DELETED);
 if(source.id!==i.channelId)throw Error('Gunakan panel yang benar di #pesan-dihapus.');
 if(!canRead(source,i,client))throw Error('Owner dan bot perlu akses baca pada channel backup.');
 startJob(i.guildId);try{
  const batch=await source.messages.fetch({limit:100});const candidates=[...batch.values()].filter(m=>!isDeletedPanel(m,client)&&allowedMsg(m)).slice(0,25);
  if(!candidates.length)return {content:'Tidak ada pesan yang dapat dibersihkan. Panel tetap disimpan.',components:[]};
  let targets=candidates.map(m=>({id:m.id,hash:fingerprint(m)}));const errors=[];let backupCount=0;
  if(mode==='archive'){
   const target=await privateBackupChannel(i.guild,client,ownerRole(i.guild),HISTORY);const files={};let size=0,totalZip=0;const archived=[];
   for(const m of candidates){try{
    const hash=fingerprint(m);const saved=await archive(m,MAX_BATCH-size);
    if(totalZip+saved.data.length>3.5*1024*1024)throw Error('Batas ukuran per bagian tercapai.');
    const parts=unzipSync(saved.data);for(const [name,body]of Object.entries(parts))files[`pesan-${m.id}/${name}`]=[body,{level:name.endsWith('.bin')?0:1}];
    size+=saved.bytes;totalZip+=saved.data.length;archived.push({id:m.id,hash});
   }catch(e){errors.push(`${m.id}: ${e.message}`);}await new Promise(r=>setTimeout(r,150));}
   if(!archived.length)return {content:`Tidak ada pesan yang dapat dibackup; tidak ada yang dibersihkan. ${errors.join('; ').slice(0,1000)}`,components:[]};
   files['README.txt']=strToU8('Backup pesan pada #pesan-dihapus. Setiap folder berisi pesan.json dan lampiran (jika ada). File ini tidak memulihkan pesan otomatis ke Discord.');
   const data=z(files);if(data.length>4*1024*1024)throw Error('ZIP terlalu besar; tidak ada pesan yang dihapus.');
   await target.send({content:`📦 Backup ${archived.length} pesan dari #pesan-dihapus; hasil pembersihan dapat berbeda bila pesan berubah.`,files:[{attachment:data,name:`backup-pesan-${Date.now()}.zip`}],allowedMentions:{parse:[]}});
   targets=archived;backupCount=archived.length;
  }
  let removed=0;
  for(const x of targets){try{const m=await source.messages.fetch({message:x.id,force:true});if(!m||isDeletedPanel(m,client)||!allowedMsg(m)||fingerprint(m)!==x.hash)throw Error('Pesan berubah atau tidak dapat dihapus.');await m.delete();removed++;}catch(e){errors.push(`${x.id}: ${e.message}`);}await new Promise(r=>setTimeout(r,250));}
  return {content:`✅ ${mode==='archive'?`${backupCount} pesan dibackup ke #riwayat-chat. `:'Tanpa backup. '}${removed} pesan dibersihkan; ${errors.length} dilewati/gagal. Panel tetap ada. ${candidates.length===25?'Mungkin masih ada pesan; ulangi untuk tahap berikutnya.':''}${errors.length?'\n'+errors.join('\n').slice(0,1000):''}`,components:[],allowedMentions:{parse:[]}};
 }finally{endJob(i.guildId);}
}
async function handle(i,client,ownerRole){
 const id=i.customId;
 if((id==='community:backup-clear-open'||id==='community:backup-archive-open')&&i.isButton()){
  const ch=await backupChannel(i.guild,client,ownerRole(i.guild));if(ch.id!==i.channelId)throw Error('Gunakan panel di #pesan-dihapus.');
  const mode=id==='community:backup-archive-open'?'archive':'clear';const key=store(i,{kind:'cleanup',mode,channel:ch.id});
  const text=mode==='archive'?'Backup ZIP ke #riwayat-chat, lalu bersihkan hingga 25 pesan yang berhasil dibackup?':'Bersihkan hingga 25 pesan TANPA backup? Salinan yang dihapus tidak dapat dipulihkan.';
  return i.reply({content:`⚠️ ${text} Panel pengelola dipertahankan.`,components:[row(btn(`community:backup-clean-confirm:${key}`,mode==='archive'?'Ya, backup & bersihkan':'Ya, hapus tanpa backup',ButtonStyle.Danger),btn('community:cancel-selection','Batal'))],flags:MessageFlags.Ephemeral});
 }
 if(id.startsWith('community:backup-clean-confirm:')&&i.isButton()){
  const key=id.split(':')[2],data=read(i,key);if(!data||data.kind!=='cleanup'||data.channel!==i.channelId)throw Error('Konfirmasi kedaluwarsa atau sudah dipakai.');
  if(cooling(i.guildId))return i.reply({content:'Tunggu beberapa detik lalu tekan tombol konfirmasi lagi.',flags:MessageFlags.Ephemeral});
  await i.deferUpdate();const result=await cleanupDeleted(i,client,ownerRole,data.mode);sessions.delete(key);return i.editReply(result);
 }
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
 if(id.startsWith('community:backup-first:')&&i.isButton()){
  const data=read(i,id.split(':')[2]);if(!data||data.kind!=='delete-nav'||data.channel!==i.channelId)throw Error('Pilihan kedaluwarsa. Jalankan slash lagi.');
  if(!canRead(i.channel,i,client))throw Error('Izin channel berubah.');guardProtected(i.channel);
  await i.deferUpdate();return i.editReply(await messageMenu(i,i.channel,client));
 }
 if(id.startsWith('community:backup-search:')&&i.isButton()){
  const key=id.split(':')[2],data=read(i,key);if(!data||data.kind!=='delete-nav'||data.channel!==i.channelId)throw Error('Pilihan kedaluwarsa. Jalankan slash lagi.');
  if(!canRead(i.channel,i,client))throw Error('Izin channel berubah.');guardProtected(i.channel);
  const field=new TextInputBuilder().setCustomId('query').setLabel('Teks, nama pengguna atau ID pesan').setStyle(TextInputStyle.Short).setMinLength(2).setMaxLength(100).setRequired(true);
  return i.showModal(new ModalBuilder().setCustomId(`community:backup-search-submit:${key}`).setTitle('Cari pesan di channel').addComponents(row(field)));
 }
 if(id.startsWith('community:backup-search-submit:')&&i.isModalSubmit()){
  const data=read(i,id.split(':')[2]);if(!data||data.kind!=='delete-nav'||data.channel!==i.channelId)throw Error('Pilihan kedaluwarsa. Jalankan slash lagi.');
  if(!canRead(i.channel,i,client))throw Error('Izin channel berubah.');guardProtected(i.channel);
  await i.deferReply({flags:MessageFlags.Ephemeral});const entries=await searchMessages(i,i.channel,i.fields.getTextInputValue('query'));return i.editReply(searchPage(i,i.channel,{entries},0));
 }
 if(id.startsWith('community:backup-older:')&&i.isButton()){
  const data=read(i,id.split(':')[2]);if(!data||!['delete-page','search-page'].includes(data.kind)||data.channel!==i.channelId)throw Error('Pilihan kedaluwarsa. Jalankan slash lagi.');
  if(!canRead(i.channel,i,client))throw Error('Izin channel berubah.');guardProtected(i.channel);
  await i.deferUpdate();return i.editReply(data.kind==='search-page'?searchPage(i,i.channel,data,data.offset):await messageMenu(i,i.channel,client,data.before));
 }
 if(id.startsWith('community:backup-delete-select:')&&i.isStringSelectMenu()){
  const data=read(i,id.split(':')[2]);if(!data||data.kind!=='delete-list'||data.channel!==i.channelId||!i.values.length||i.values.length>MAX_SELECT||i.values.some(x=>!data.ids.includes(x)))throw Error('Pilihan tidak valid atau kedaluwarsa.');
  if(!canRead(i.channel,i,client))throw Error('Izin channel berubah.');guardProtected(i.channel);
  const key=store(i,{kind:'delete-confirm',channel:data.channel,ids:[...i.values]});
  return i.update({content:`⚠️ Hapus ${i.values.length} pesan berikut secara permanen? Setiap pesan dibackup terlebih dahulu. Lampiran terlalu besar/gagal atau tipe tidak didukung dilewati. Salinan dikirim sebagai bot; media URL eksternal dan tombol interaktif tidak disalin. Jenis yang tidak didukung dilewati.\n${i.values.map(x=>`• ${x}: ${data.summaries[x]}`).join('\n')}`,components:[row(btn(`community:backup-confirm:${key}`,'Ya, backup dan hapus',ButtonStyle.Danger),btn('community:cancel-selection','Batal'))],allowedMentions:{parse:[]}});
 }
 if(id.startsWith('community:backup-confirm:')&&i.isButton()){
  const key=id.split(':')[2],data=read(i,key);if(!data||data.kind!=='delete-confirm'||data.channel!==i.channelId)throw Error('Konfirmasi kedaluwarsa atau sudah dipakai.');
  if(cooling(i.guildId))return i.reply({content:'Tunggu beberapa detik lalu tekan tombol konfirmasi lagi.',flags:MessageFlags.Ephemeral});
  await i.deferUpdate();if(!canRead(i.channel,i,client)||!i.channel.permissionsFor(client.user.id)?.has(F.ManageMessages))throw Error('Izin akses atau Manage Messages berubah.');guardProtected(i.channel);
  const inbox=await backupChannel(i.guild,client,ownerRole(i.guild));startJob(i.guildId);sessions.delete(key);let used=0,ok=0,fail=0;const errors=[];
  try{for(const id of data.ids){try{
    const m=await i.channel.messages.fetch({message:id,force:true});if(!allowedMsg(m))throw Error('Pesan tidak tersedia atau tidak dapat dihapus.');
    const snapshot=fingerprint(m);const saved=await copyOriginal(m,MAX_BATCH-used);used+=saved.bytes;
    const b=await inbox.send({content:`⏳ Salinan pesan ${m.id} dari channel ${m.channelId}; penulis ${m.author.id}; waktu asli ${m.createdAt?.toISOString() || 'tidak diketahui'}. Menunggu penghapusan.`,embeds:[new EmbedBuilder().setColor(0x334155).setDescription('Pesan berikutnya adalah salinan yang dikirim bot, bukan akun asli.').setFooter({text:`backup-record:v2:${m.id}`})],allowedMentions:{parse:[]}});
    try { await inbox.send(saved.payload); } catch(e) { await b.edit({content:`⚠️ Salinan pesan ${m.id} gagal dibuat; pesan asli tidak dihapus.`,allowedMentions:{parse:[]}}).catch(()=>{}); throw e; }
    try{const fresh=await i.channel.messages.fetch({message:id,force:true});if(!allowedMsg(fresh)||fingerprint(fresh)!==snapshot)throw Error('Pesan berubah setelah dicadangkan; dilewati.');await fresh.delete();ok++;await b.edit({content:`✅ Pesan ${m.id} dari channel ${m.channelId} telah dihapus; salinan tampil di bawah.`,allowedMentions:{parse:[]}}).catch(()=>{});}catch(e){await b.edit({content:`⚠️ Pesan ${m.id} gagal dihapus; backup tetap disimpan.`,allowedMentions:{parse:[]}}).catch(()=>{});throw e;}
   }catch(e){fail++;errors.push(`${id}: ${e.message}`);}await new Promise(r=>setTimeout(r,300));}
  }finally{endJob(i.guildId);}
  return i.editReply({content:`Selesai: ${ok} dihapus setelah backup, ${fail} dilewati/gagal.${errors.length?'\n'+errors.join('\n').slice(0,1300):''}`,components:[],allowedMentions:{parse:[]}});
 }
 throw Error('Interaksi backup tidak dikenal.');
}
module.exports={CATEGORY,DELETED,HISTORY,setupBackup,backupChannel,deleteCommand,handle,historyPanel,deletedPanel,runHistory,archive,copyOriginal,searchMessages,cleanupDeleted,canRead,guardProtected};
