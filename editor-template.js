const {ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle} = require('discord.js');
const row = c => new ActionRowBuilder().addComponents(c);
const DEFAULT_AUTHOR = 'AINUN IJLAL STUDIO • MEMBER ONBOARDING';
const DEFAULT_TITLE = 'Selamat Datang, {username}';
function input(id,label,value,max,required=false) {
 const x=new TextInputBuilder().setCustomId(id).setLabel(label).setStyle(TextInputStyle.Paragraph).setRequired(required).setMaxLength(max);
 if (value) x.setValue(value); return row(x);
}
function modal(id,title,config,content) {
 const p=config.parts;
 const header=`${p.author || '-'}\n${p.title || '-'}`;
 const fields=['user','count','created'].map(k=>p[k] || '-').join('\n');
 const footer=`${p.timestamp || 'TIDAK'}\n${p.footer || ''}`;
 const controls=[input('header','Baris 1 author, baris 2 judul (- hapus)',header,520,true),
  input('body','Isi pesan',config.body,3000,true),
  input('details','3 baris: Judul | Isi (- untuk hapus)',fields,2000,true),
  input('footer','Baris 1 YA/TIDAK, sisanya teks footer',footer,1024,true)];
 if(content !== undefined) controls.push(input('content','Teks di luar embed (kosong untuk hapus)',content,2000));
 return new ModalBuilder().setCustomId(id).setTitle(title).addComponents(...controls);
}
function read(fields) {
 const lines=fields.getTextInputValue('header').split(/\r?\n/); if(lines.length!==2) throw Error('Header harus tepat 2 baris: author dan judul. Gunakan - untuk menghapus.');
 const [author,title]=lines.map(v=>v.trim()==='-'?'':v.trim());
 if(author.length>256 || title.length>256) throw Error('Author dan judul maksimal 256 karakter.');
 const body=fields.getTextInputValue('body').trim(); if(!body || body.length>3000) throw Error('Isi wajib diisi dan maksimal 3000 karakter.');
 const details=fields.getTextInputValue('details').split(/\r?\n/); if(details.length!==3) throw Error('Informasi tambahan harus tepat 3 baris; gunakan - untuk menyembunyikan.');
 const parts={author,title};
 for(const [j,k] of ['user','count','created'].entries()) {
  const line=details[j].trim(); if(!line || line==='-'){parts[k]='';continue;}
  const pos=line.indexOf('|'), name=line.slice(0,pos).trim(),value=line.slice(pos+1).trim();
  if(pos<1 || !name || !value || name.length>128 || value.length>600 || line.length>900) throw Error('Setiap baris informasi: Judul | Isi (maksimal 600 karakter isi), atau -.');
  parts[k]=`${name} | ${value}`;
 }
 const f=fields.getTextInputValue('footer').split(/\r?\n/);parts.timestamp=(f.shift()||'').trim().toUpperCase();parts.footer=f.join('\n').trim();
 if(!['YA','TIDAK'].includes(parts.timestamp) || parts.footer.length>500) throw Error('Baris pertama footer harus YA atau TIDAK; teks footer maksimal 500 karakter.');
 if (body.length + Object.values(parts).reduce((sum,x)=>sum+x.length,0) > 5300) throw Error('Total isi terlalu panjang; kurangi teks hingga dapat disimpan.');
 return {body,parts};
}
module.exports={modal,read,DEFAULT_AUTHOR,DEFAULT_TITLE};
