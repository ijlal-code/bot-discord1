'use strict';
const assert=require('node:assert/strict');const {reconcileAtStartup}=require('./startup-reconcile');
(async()=>{const records=new Map([['active',{enabled:true}],['off',{enabled:false}],['left',{enabled:false,leftGuild:true}]]),warnings=[];
 const state={ensurePending:async id=>{if(id==='failure')throw Error('db gagal');if(!records.has(id))records.set(id,{enabled:false});}};
 await reconcileAtStartup(['active','off','left','new','failure'].map(id=>({id})),{state,log:{warn:x=>warnings.push(x)}});
 assert.equal(records.get('active').enabled,true);assert.equal(records.get('off').enabled,false);assert.equal(records.get('left').enabled,false);assert.equal(records.get('new').enabled,false);assert.equal(warnings.length,1);
 const source=require('node:fs').readFileSync('index.js','utf8');const startup=source.slice(source.indexOf("client.once('clientReady'"),source.indexOf("client.on('guildMemberAdd'"));assert(!startup.includes('restoreAccess('));assert(!startup.includes('activateGuild('));assert(startup.includes('state.markJoined'));
 console.log('LULUS: server baru menunggu aktivasi; startup tidak mengubah izin.');})().catch(e=>{console.error(e);process.exitCode=1});
