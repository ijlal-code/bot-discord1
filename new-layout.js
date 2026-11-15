'use strict';
const {ChannelType,PermissionsBitField,EmbedBuilder}=require('discord.js');
const crypto=require('node:crypto');
const F=PermissionsBitField.Flags;
const MAX_ROLES=10;
const emptyBuilder=()=>({templates:{welcome:false,manage:false},roles:[],welcome:{rulesTitle:'Peraturan dan role',rulesBody:'Selamat datang. Silakan baca peraturan server.',announcementTitle:'Selamat datang',announcementBody:'Selamat datang di komunitas ini.'},categories:[]});
function cleanName(x,label){if(typeof x!=='string'||x!==x.trim()||x.length<1||x.length>80||/[\u0000-\u001f\u007f]/.test(x))throw Error(`${label} harus 1–80 karakter dan tanpa karakter kontrol.`);return x;}
function validateNew(raw){
 const b=raw?.builder;if(!b||typeof b!=='object'||!b.templates||typeof b.templates.welcome!=='boolean'||typeof b.templates.manage!=='boolean'||!Array.isArray(b.roles)||b.roles.length>MAX_ROLES||!Array.isArray(b.categories)||b.categories.length>5)throw Error('Konfigurasi baru tidak valid. Maksimal 10 role dan 5 kategori.');
 const roleNames=new Set(),roles=b.roles.map(r=>{const name=cleanName(r.name,'Nama role');const key=name.toLowerCase();if(key==='@everyone'||roleNames.has(key))throw Error('Nama role duplikat atau tidak diizinkan.');roleNames.add(key);return {name};});
 if(b.templates.manage&&roles.some(r=>r.name.toLowerCase()==='owner'&&r.name!=='Owner'))throw Error('Jika memakai template kelola komunitas, nama role harus tepat Owner.');
 const lookup=new Map(roles.map(r=>[r.name.toLowerCase(),r.name]));const roleList=v=>{if(!Array.isArray(v)||v.length>MAX_ROLES)throw Error('Daftar role tidak valid.');const seen=new Set();return v.map(name=>{if(typeof name!=='string'||!lookup.has(name.toLowerCase())||seen.has(name.toLowerCase()))throw Error('Role akses tidak tersedia atau duplikat.');seen.add(name.toLowerCase());return lookup.get(name.toLowerCase());});};
 const w=b.welcome||{};const text=(v,max,required)=>{if(typeof v!=='string'||v.length>max||(required&&!v.trim()))throw Error('Judul/isi pesan tidak valid atau terlalu panjang.');return v;};
 const welcome={rulesTitle:text(w.rulesTitle,256,b.templates.welcome),rulesBody:text(w.rulesBody,1800,b.templates.welcome),announcementTitle:text(w.announcementTitle,256,b.templates.welcome),announcementBody:text(w.announcementBody,1800,b.templates.welcome)};
 const cats=new Set(),names=new Set();if(b.templates.manage)cats.add('🔐 kelola komunitas');if(b.templates.welcome){cats.add('📢 welcome & info');names.add('rules-and-role');names.add('announcements');}
 if(b.templates.manage)for(const n of ['kelola-kategori','kelola-channel','edit-pesan-channel-awal','kelola-slash-command'])names.add(n);
 let count=0;const categories=b.categories.map(c=>{
  const name=cleanName(c.name,'Nama kategori'),key=name.toLowerCase();if(cats.has(key))throw Error('Nama kategori duplikat dengan kategori atau template lain.');cats.add(key);
  if(!['public','private'].includes(c.visibility)||!Array.isArray(c.channels)||c.channels.length>5||!c.channels.length)throw Error('Kategori membutuhkan visibilitas dan 1–5 channel.');
  const access=roleList(c.access);const channels=c.channels.map(ch=>{
   if(typeof ch.name!=='string'||!/^[a-z0-9][a-z0-9_-]{0,79}$/.test(ch.name)||names.has(ch.name))throw Error('Nama channel tidak valid atau duplikat; gunakan huruf kecil, angka, - atau _.');names.add(ch.name);
   if(!['text','voice'].includes(ch.type)||!['public','private'].includes(ch.visibility)||(c.visibility==='private'&&ch.visibility==='public'))throw Error('Jenis/visibilitas tidak valid; channel tidak boleh lebih terbuka daripada kategori.');
   if(!Array.isArray(ch.permissions)||ch.permissions.length>MAX_ROLES)throw Error('Permission channel tidak valid.');const seen=new Set();
   const permissions=ch.permissions.map(p=>{const [name]=roleList([p.role]);if(seen.has(name.toLowerCase()))throw Error('Permission role duplikat.');seen.add(name.toLowerCase());if(c.visibility==='private'&&p.view&&!access.includes(name))throw Error('Role channel harus dipilih pada kategori privat.');
    if(typeof p.view!=='boolean'||typeof p.denyView!=='boolean'||typeof p.send!=='boolean'||typeof p.history!=='boolean'||typeof p.connect!=='boolean'||typeof p.speak!=='boolean')throw Error('Pilihan permission tidak valid.');
    if((p.view&&p.denyView)||(!p.view&&(p.send||p.history||p.connect||p.speak)))throw Error('Izin lainnya membutuhkan izin Lihat untuk role tersebut.');
    return {role:name,view:p.view,denyView:p.denyView,send:p.send,history:p.history,connect:p.connect,speak:p.speak};});
   const ev=ch.everyone||{history:true,send:false,connect:false,speak:false};if(!ev||['history','send','connect','speak'].some(k=>typeof ev[k]!=='boolean'))throw Error('Permission @everyone tidak valid.');if(ch.visibility==='private'&&(ev.send||ev.connect||ev.speak))throw Error('@everyone tidak dapat mengirim atau terhubung di channel privat.');const everyone={history:ev.history,send:ev.send,connect:ev.connect,speak:ev.speak};
   if(ch.type==='voice'&&(ch.title||ch.body))throw Error('Pesan awal hanya tersedia untuk channel teks.');
   const title=text(ch.title||'',256,false),body=text(ch.body||'',1800,false);if(title&&!body)throw Error('Isi pesan awal wajib diisi jika judul diisi.');count++;
   return {name:ch.name,type:ch.type,visibility:ch.visibility,permissions,everyone,title,body};
  });return {name,visibility:c.visibility,access,channels};
 });
 if(count>20)throw Error('Maksimal 20 channel kustom.');if(!b.templates.welcome&&!b.templates.manage&&!categories.length)throw Error('Pilih template atau tambahkan minimal satu kategori.');
 return {mode:'new',builder:{templates:{welcome:b.templates.welcome,manage:b.templates.manage},roles,welcome,categories}};
}
function rolePerms(guild,client,roles,visibility,entries,type,ev={}){
 const everyone={id:guild.id,allow:visibility==='public'?[F.ViewChannel]:[],deny:visibility==='private'?[F.ViewChannel]:[]};
 if(type==='text'){(ev.history?everyone.allow:everyone.deny).push(F.ReadMessageHistory);(ev.send?everyone.allow:everyone.deny).push(F.SendMessages,F.SendMessagesInThreads);everyone.deny.push(F.CreatePublicThreads,F.CreatePrivateThreads);}
 if(type==='voice'){(ev.connect?everyone.allow:everyone.deny).push(F.Connect);(ev.speak?everyone.allow:everyone.deny).push(F.Speak);}
 const list=[everyone];
 for(const p of entries){if(!p.view&&!p.denyView)continue;const role=roles.find(r=>r.name===p.role);if(!role)throw Error(`Role ${p.role} tidak ditemukan.`);const allow=[],deny=[];if(p.view)allow.push(F.ViewChannel);else deny.push(F.ViewChannel);if(type==='text'){(p.history?allow:deny).push(F.ReadMessageHistory);(p.send?allow:deny).push(F.SendMessages,F.SendMessagesInThreads);if(p.send)allow.push(F.AddReactions);}if(type==='voice'){(p.connect?allow:deny).push(F.Connect);(p.speak?allow:deny).push(F.Speak);}list.push({id:role.id,allow,deny});}
 list.push({id:client.user.id,allow:[F.ViewChannel,...(type==='text'?[F.SendMessages,F.ReadMessageHistory,F.EmbedLinks,F.AttachFiles]:[])]});return list;
}
async function createNew(guild,client,state,layout){
 const out={roles:0,categories:0,channels:0,skipped:[],errors:[]};const b=validateNew(layout).builder;
 const roles=await guild.roles.fetch(),channels=await guild.channels.fetch(),cfg=await state.readConfig(guild.id),records=cfg?.newCategories||[],channelRecords=cfg?.newChannels||[];
 const active=()=>{if(!state.get(guild.id))throw Error('Server dinonaktifkan; setup dihentikan.');};
 const needed=[...b.roles.map(r=>r.name)];if(b.templates.manage&&!needed.some(x=>x.toLowerCase()==='owner'))needed.push('Owner');
 for(const name of needed){active();const matches=roles.filter(r=>r.id!==guild.id&&r.name.toLowerCase()===name.toLowerCase());if(matches.size>1)throw Error(`Role ${name} duplikat; rapikan sebelum setup.`);if(matches.size===1){if(matches.first().name!==name)throw Error(`Ejaan role ${name} berbeda dari role yang ada. Samakan di dashboard.`);continue;}const r=await guild.roles.create({name,permissions:[],reason:'Setup baru sesuai dashboard, tanpa izin istimewa'});roles.set(r.id,r);out.roles++;}
 if(b.templates.manage){const ownerRole=roles.find(r=>r.name==='Owner'&&r.id!==guild.id);if(!ownerRole)throw Error('Role Owner harus bernama tepat Owner.');try{const owner=await guild.fetchOwner();if(!owner.roles.cache.has(ownerRole.id))await owner.roles.add(ownerRole,'Setup kelola komunitas');}catch(e){out.errors.push('Role Owner tidak dapat diberikan otomatis: '+e.message);}}
 async function category(name,visibility,access,kind){
  active();const found=channels.filter(c=>c?.type===ChannelType.GuildCategory&&c.name.toLowerCase()===name.toLowerCase());let cat;
  const entries=access.map(role=>({role,view:true})),expected=rolePerms(guild,client,roles,visibility,entries,'category');
  const signature=JSON.stringify(expected.map(x=>x.id).sort());
  if(found.size){const rec=records.find(r=>r.name===name&&r.kind===kind&&r.visibility===visibility&&r.signature===signature&&found.has(r.id));
   const cache=rec&&found.get(rec.id)?.permissionOverwrites?.cache;
   const matches=cache&&cache.size===expected.length&&expected.every(p=>{const actual=cache.get(p.id);return actual&&actual.allow.bitfield===PermissionsBitField.resolve(p.allow||[])&&actual.deny.bitfield===PermissionsBitField.resolve(p.deny||[]);});
   if(found.size!==1||!rec||!matches){out.skipped.push(`Kategori ${name} sudah ada atau izin berubah; tidak diubah.`);return null;}return found.get(rec.id);}
  cat=await guild.channels.create({name,type:ChannelType.GuildCategory,permissionOverwrites:expected,reason:'Setup baru dari dashboard'});channels.set(cat.id,cat);out.categories++;const record={name,visibility,kind,signature,id:cat.id};await state.recordNewCategory(guild.id,record);records.push(record);return cat;
 }
 async function channel(cat,spec,kind){
  active();const expected=rolePerms(guild,client,roles,spec.visibility,spec.permissions,spec.type,spec.everyone||{history:true,send:false,connect:false,speak:false});
  const signature=crypto.createHash('sha256').update(JSON.stringify({spec,kind,parent:cat.id,roleIds:expected.map(x=>x.id)})).digest('hex');
  const found=channels.filter(c=>c?.name?.toLowerCase()===spec.name.toLowerCase());
  if(found.size){const rec=channelRecords.find(r=>r.name===spec.name&&r.signature===signature&&found.has(r.id));const c=rec&&found.get(rec.id),cache=c?.permissionOverwrites?.cache;
   const safe=found.size===1&&c?.parentId===cat.id&&c?.type===(spec.type==='text'?ChannelType.GuildText:ChannelType.GuildVoice)&&cache&&cache.size===expected.length&&expected.every(p=>{const a=cache.get(p.id);return a&&a.allow.bitfield===PermissionsBitField.resolve(p.allow||[])&&a.deny.bitfield===PermissionsBitField.resolve(p.deny||[]);});
   if(!safe)out.skipped.push(`#${spec.name} sudah ada atau izin/pesan berubah; tidak diubah.`);return;
  }
  const created=await guild.channels.create({name:spec.name,type:spec.type==='text'?ChannelType.GuildText:ChannelType.GuildVoice,parent:cat.id,permissionOverwrites:expected,reason:'Setup baru dari dashboard'});channels.set(created.id,created);out.channels++;
  if(kind==='manage'){const community=require('./community');const {channelManagePanel}=require('./channel-management');const msg=require('./message-management');const panel=spec.name==='kelola-kategori'?community.managePanel():spec.name==='kelola-channel'?channelManagePanel():msg.panel();await created.send(panel);}
  else if(spec.type==='text'&&spec.body){const embed=new EmbedBuilder().setColor(0x1e293b).setDescription(spec.body);if(spec.title)embed.setTitle(spec.title);await created.send({embeds:[embed],allowedMentions:{parse:[]}});}
  const rec={name:spec.name,signature,id:created.id};await state.recordNewChannel(guild.id,rec);channelRecords.push(rec);
 }
 async function group(name,visibility,access,kind,items){try{const cat=await category(name,visibility,access,kind);if(!cat)return;for(const ch of items){try{await channel(cat,ch,kind);}catch(e){out.errors.push(`#${ch.name}: ${e.message}`);if(!state.get(guild.id))break;}}}catch(e){out.errors.push(`${name}: ${e.message}`);}}
 if(b.templates.welcome)await group('📢 WELCOME & INFO','public',[],'welcome',[
  {name:'rules-and-role',type:'text',visibility:'public',permissions:[],title:b.welcome.rulesTitle,body:b.welcome.rulesBody},
  {name:'announcements',type:'text',visibility:'public',permissions:[],title:b.welcome.announcementTitle,body:b.welcome.announcementBody}]);
 if(b.templates.manage)await group('🔐 KELOLA KOMUNITAS','private',['Owner'],'manage',['kelola-kategori','kelola-channel','edit-pesan-channel-awal'].map(name=>({name,type:'text',visibility:'private',permissions:[{role:'Owner',view:true,history:true,send:true}],title:'',body:''})));
 for(const c of b.categories)await group(c.name,c.visibility,c.access,'custom',c.channels);
 return out;
}
module.exports={emptyBuilder,validateNew,createNew,rolePerms};
