const crypto = require('node:crypto');
const selection = require('./selection-continue');
const {ActionRowBuilder,ButtonBuilder,ButtonStyle,ChannelSelectMenuBuilder,StringSelectMenuBuilder,ChannelType,EmbedBuilder,MessageFlags,ModalBuilder,TextInputBuilder,TextInputStyle,PermissionsBitField}=require('discord.js');
const CHANNEL='edit-pesan-channel-awal';
const pending=new Map();
const row=(...v)=>new ActionRowBuilder().addComponents(...v);
const cancel=()=>selection.buttons();
function panel(){return {embeds:[new EmbedBuilder().setColor(0x1e293b).setTitle('Edit pesan awal channel').setDescription('Pilih channel, lalu pilih pesan awal yang dikirim bot. Edit teks, author, judul, isi embed pertama, field, footer dan waktu sekaligus. Tombol role/form dan bagian embed lain dipertahankan. Pesan orang lain serta pesan pengelola/backup yang dilindungi tidak dapat diedit. Maksimal 25 pesan bot terawal ditampilkan.')],components:[row(new ButtonBuilder().setCustomId('community:initial-open').setLabel('Pilih channel & pesan').setStyle(ButtonStyle.Primary))],allowedMentions:{parse:[]}};}
function eligible(c,i,client){const f=PermissionsBitField.Flags;return [ChannelType.GuildText,ChannelType.GuildAnnouncement].includes(c?.type)&&!!c.messages&&!!c.permissionsFor?.(i.member)?.has([f.ViewChannel,f.ReadMessageHistory])&&!!c.permissionsFor?.(client.user.id)?.has([f.ViewChannel,f.ReadMessageHistory]);}
function protectedMessage(m,ch){const marker=m.embeds[0]?.footer?.text||m.embeds[0]?.toJSON?.().footer?.text||'';if(/^(welcome-config:|member-onboarding:|member-join:|member-last-message:|backup-record:)/.test(marker))return true;if(['🔐 KELOLA KOMUNITAS','🗄️ BACKUP'].includes(ch.parent?.name))return true;return false;}
function token(i,data){for(const [k,v] of pending) if(v.expires<Date.now()) pending.delete(k);const k=crypto.randomBytes(12).toString('hex');pending.set(k,{...data,user:i.user.id,guild:i.guildId,expires:Date.now()+900000});return k;}
function get(i,k,consume=false){const d=pending.get(k);if(!d||d.expires<Date.now()||d.user!==i.user.id||d.guild!==i.guildId) return null;if(consume)pending.delete(k);return d;}
function digest(m){return crypto.createHash('sha256').update(JSON.stringify({content:m.content,embeds:m.embeds.map(e=>e.toJSON()),components:m.components.map(c=>c.toJSON())})).digest('hex');}
function field(id,label,value,max,required=false){const b=new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Paragraph).setMaxLength(max).setRequired(required);if(value)b.setValue(value);return row(b);}
function form(id,m){
 const e=m.embeds[0]?.toJSON();if(!e) throw Error('Pesan ini tidak memiliki embed.');
 const header=`${e.author?.name || '-'}\n${e.title || '-'}`;
 const fields=(e.fields||[]).map(f=>`${f.name} | ${f.value.replace(/\r?\n/g,'\\n')} | ${f.inline?'YA':'TIDAK'}`).join('\n');
 if(header.length>520||fields.length>4000||(e.description||'').length>3000||(e.footer?.text||'').length>500||(m.content||'').length>2000)throw Error('Pesan terlalu panjang untuk editor ini; perubahan tidak dilakukan.');
 return new ModalBuilder().setCustomId(id).setTitle('Edit pesan awal bot').addComponents(
  field('header','Baris 1 author, baris 2 judul (- hapus)',header,520,true),
  field('body','Isi embed (kosong untuk hapus)',e.description||'',3000),
  field('details','Field: Judul | Isi | YA/TIDAK (inline)',fields,4000),
  field('footer',`Baris 1 YA/TIDAK waktu, sisanya footer`,`${e.timestamp?'YA':'TIDAK'}\n${e.footer?.text||''}`,1024,true),
  field('content','Teks di luar embed (kosong untuk hapus)',m.content||'',2000));
}
async function handle(i,client){
 const id=i.customId;
 if(i.isButton()&&id==='community:initial-open'){
  return i.reply({content:'Pilih channel teks atau pengumuman yang dapat dilihat Owner dan bot, dari kategori mana saja.',components:[row(new ChannelSelectMenuBuilder().setCustomId('community:initial-channel').setPlaceholder('Pilih satu channel').addChannelTypes(ChannelType.GuildText,ChannelType.GuildAnnouncement).setMinValues(1).setMaxValues(1)),cancel()],flags:MessageFlags.Ephemeral});
 }
 if(i.isChannelSelectMenu()&&id==='community:initial-channel'){
  const ch=await i.guild.channels.fetch(i.values[0]); if(i.values.length!==1||!eligible(ch,i,client)) throw Error('Channel di luar daftar yang diizinkan. Pilih ulang.');
  let after='0', found=[];
  for(let n=0;n<10&&found.length<25;n++){
   const batch=await ch.messages.fetch({limit:100,after}); if(!batch.size)break;
   const sorted=[...batch.values()].sort((a,b)=>BigInt(a.id)<BigInt(b.id)?-1:1);
   found.push(...sorted.filter(m=>m.author.id===client.user.id&&m.embeds.length&&!protectedMessage(m,ch)));
   after=sorted.at(-1).id;if(batch.size<100)break;
  }
  found=found.slice(0,25);
  if(!found.length) return i.update({content:'Tidak ada pesan embed bot yang ditemukan pada 1.000 pesan awal channel ini.',components:[cancel()]});
  const key=token(i,{channelId:ch.id,ids:found.map(m=>m.id)});
  const opts=found.map((m,n)=>({label:`${n+1}. ${(m.embeds[0].title||m.embeds[0].author?.name||'Pesan embed').slice(0,80)}`.slice(0,100),description:`ID ${m.id}`,value:m.id}));
  return i.update({content:`Pilih pesan bot yang ingin diubah di #${ch.name}. Hanya 25 pesan bot terawal (dari 1.000 pesan awal) ditampilkan.`,components:[row(new StringSelectMenuBuilder().setCustomId(`community:initial-message:${key}`).setPlaceholder('Pilih pesan bot').addOptions(opts)),cancel()],allowedMentions:{parse:[]}});
 }
 if(i.isStringSelectMenu()&&id.startsWith('community:initial-message:')){
  const d=get(i,id.split(':')[2]);if(!d||!d.ids.includes(i.values[0]))throw Error('Pilihan kedaluwarsa atau tidak valid. Pilih ulang.');
  const ch=await i.guild.channels.fetch(d.channelId);if(!eligible(ch,i,client))throw Error('Channel tidak lagi memenuhi syarat.');
  const m=await ch.messages.fetch({message:i.values[0],force:true});if(!m||m.author.id!==client.user.id||protectedMessage(m,ch))throw Error('Pesan bot tidak ditemukan atau dilindungi.');
  const key=token(i,{channelId:ch.id,messageId:m.id,hash:digest(m)});
  return i.showModal(form(`community:initial-save:${key}`,m));
 }
 if(i.isModalSubmit()&&id.startsWith('community:initial-save:')){
  await i.deferReply({flags:MessageFlags.Ephemeral});const d=get(i,id.split(':')[2],true);if(!d)throw Error('Pilihan kedaluwarsa. Pilih ulang.');
  const ch=await i.guild.channels.fetch(d.channelId);if(!eligible(ch,i,client))throw Error('Channel tidak lagi memenuhi syarat.');
  const m=await ch.messages.fetch({message:d.messageId,force:true});if(!m||m.author.id!==client.user.id||!m.embeds.length||protectedMessage(m,ch))throw Error('Pesan bot tidak tersedia atau dilindungi.');
  if(digest(m)!==d.hash)throw Error('Pesan telah berubah sejak editor dibuka. Pilih ulang agar perubahan lain tidak tertimpa.');
  const h=i.fields.getTextInputValue('header').split(/\r?\n/);if(h.length!==2)throw Error('Header harus 2 baris; gunakan - untuk kosong.');const [author,title]=h.map(x=>x.trim()==='-'?'':x.trim());if(author.length>256||title.length>256)throw Error('Author dan judul maksimal 256 karakter.');
  const fl=i.fields.getTextInputValue('footer').split(/\r?\n/);const timestamp=(fl.shift()||'').trim().toUpperCase(),footer=fl.join('\n').trim();if(!['YA','TIDAK'].includes(timestamp)||footer.length>500)throw Error('Baris pertama footer YA/TIDAK dan footer maksimal 500 karakter.');
  const raw=i.fields.getTextInputValue('details').split(/\r?\n/).filter(x=>x.trim());if(raw.length>25)throw Error('Maksimal 25 field.');
  const fields=raw.map(line=>{const first=line.indexOf('|'),last=line.lastIndexOf('|');if(first<0||last<=first)throw Error('Format field: Judul | Isi | YA/TIDAK. Gunakan \\n untuk baris baru dalam isi.');const name=line.slice(0,first).trim(),v=line.slice(first+1,last).trim(),inline=line.slice(last+1).trim();const value=v.replace(/\\n/g,'\n');if(!name||name.length>256||!value||value.length>1024||!['YA','TIDAK'].includes(inline.toUpperCase()))throw Error('Field tidak valid; nama maks. 256, isi maks. 1024, inline YA/TIDAK.');return {name,value,inline:inline.toUpperCase()==='YA'};});
  const old=m.embeds[0].toJSON(), embed=EmbedBuilder.from(m.embeds[0]);
  embed.setAuthor(author?{name:author,...(old.author?.icon_url?{iconURL:old.author.icon_url}:{})}:null).setTitle(title||null).setDescription(i.fields.getTextInputValue('body').trim()||null).setFields(fields).setFooter(footer?{text:footer,...(old.footer?.icon_url?{iconURL:old.footer.icon_url}:{})}:null);
  if(timestamp==='YA'){if(!old.timestamp)embed.setTimestamp();}else embed.setTimestamp(null);
  const embeds=[embed,...m.embeds.slice(1).map(e=>EmbedBuilder.from(e))];
  if(!author&&!title&&!i.fields.getTextInputValue('body').trim()&&!fields.length&&!footer&&!old.image&&!old.thumbnail)throw Error('Embed tidak boleh sepenuhnya kosong.');
  await m.edit({content:i.fields.getTextInputValue('content'),embeds,allowedMentions:{parse:[]}});
  return i.editReply('✅ Pesan bot diperbarui. Tombol interaktif dan lampiran yang ada tetap dipertahankan.');
 }
 throw Error('Interaksi editor tidak dikenal.');
}
module.exports={CHANNEL,panel,handle};
