'use strict';
const assert=require('node:assert/strict');const {Collection,ChannelType,PermissionsBitField}=require('discord.js');const {validateLayout,createExtras,emptyLayout}=require('./custom-layout');
const input={mode:'extra',categories:[{name:'🎮 HOBI',visibility:'status',channels:[{name:'cerita-hobi',type:'text',visibility:'status'},{name:'suara-hobi',type:'voice',visibility:'owner'}]}]};
assert.deepEqual(validateLayout(emptyLayout()),emptyLayout());assert.deepEqual(validateLayout(input),input);
const invalid=(f,rx)=>{const v=structuredClone(input);f(v);assert.throws(()=>validateLayout(v),rx)};
invalid(x=>x.categories[0].channels[0].name='diskusi',/bawaan/);invalid(x=>x.categories[0].channels[0].name='a b',/huruf kecil/);invalid(x=>x.categories[0].channels[1].visibility='public',/lebih terbuka/);invalid(x=>x.categories[0].visibility='toString',/valid/);invalid(x=>x.categories[0].name='📢 WELCOME & INFO',/bawaan/);
(async()=>{
 const roles=new Collection(),channels=new Collection();for(const [i,name] of ['Owner','Pekerja','Pelajar','Umum'].entries())roles.set('role'+i,{id:'role'+i,name});let seq=0,active=true;const records=[];
 const guild={id:'guild',roles:{everyone:{id:'guild'},fetch:async()=>roles},channels:{fetch:async()=>channels,create:async data=>{const c={id:'channel'+(++seq),...data};channels.set(c.id,c);return c;}}};const state={get:()=>active,readConfig:async()=>({customCategories:records.map(r=>({...r}))}),recordCustomCategory:async(id,r)=>records.push(r)};const client={user:{id:'bot'}};
 let result=await createExtras(guild,client,state,input);assert.equal(result.categories,1);assert.equal(result.channels,2);assert.equal(records.length,1);
 const category=channels.find(c=>c.type===ChannelType.GuildCategory),chat=channels.find(c=>c.name==='cerita-hobi'),voice=channels.find(c=>c.name==='suara-hobi');
 assert(category.permissionOverwrites.find(o=>o.id==='guild').deny.includes(PermissionsBitField.Flags.ViewChannel));assert(chat.permissionOverwrites.find(o=>o.id==='guild').deny.includes(PermissionsBitField.Flags.SendMessages));assert(voice.permissionOverwrites.find(o=>o.id==='guild').deny.includes(PermissionsBitField.Flags.ViewChannel));assert(!voice.permissionOverwrites.some(o=>o.id==='role1'));
 result=await createExtras(guild,client,state,input);assert.equal(result.channels,0);assert.equal(result.categories,0);assert.equal(result.skipped.length,2);
 const changed=structuredClone(input);changed.categories[0].channels.push({name:'channel-baru',type:'text',visibility:'status'});result=await createExtras(guild,client,state,changed);assert.equal(result.channels,1);
 changed.categories[0].visibility='public';result=await createExtras(guild,client,state,changed);assert.equal(result.categories,0);assert.equal(result.channels,0);assert(result.skipped[0].includes('visibilitas'));
 active=false;result=await createExtras(guild,client,state,input);assert(result.errors[0].includes('dinonaktifkan'));
 const other={mode:'extra',categories:[{name:'Lama',visibility:'public',channels:[{name:'lain',type:'text',visibility:'public'}]}]};channels.set('external',{id:'external',name:'Lama',type:ChannelType.GuildCategory});active=true;result=await createExtras(guild,client,state,other);assert.equal(result.channels,0);assert(result.skipped.length===1);
 console.log('LULUS: validasi, izin, isolasi konfigurasi, idempotensi, konflik dan status nonaktif.');
})().catch(e=>{console.error(e);process.exitCode=1});
