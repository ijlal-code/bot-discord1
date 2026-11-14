'use strict';
const assert=require('node:assert/strict');const {Collection,PermissionsBitField}=require('discord.js');const {handleSetup}=require('./setup-command');
const guildId='100000000000000001',ownerId='100000000000000002',other='100000000000000003';const admin={has:x=>x===PermissionsBitField.Flags.Administrator};
function make({uid=ownerId,choice='recover-safe-setup',active=false,disabled=false,recognized=true,ownerRole=false,regFail=false}={}){
 let cfg={disabledCommands:disabled?['setup-server']:[]},enabled=active,activationCount=0,setupCount=0,repairCount=0;
 const guild={id:guildId,ownerId,roles:{fetch:async()=>new Collection(ownerRole?[['role',{id:'role',name:'Owner'}]]:[])}};
 const confirmation={customId:choice,user:{id:uid},guild,memberPermissions:admin,update:async data=>{confirmation.updated=data}};
 const i={guildId,guild,user:{id:uid},memberPermissions:admin,deferReply:async()=>{i.deferred=true},editReply:async data=>{i.edited=data},fetchReply:async()=>({awaitMessageComponent:async({filter})=>{assert(filter(confirmation));return confirmation}}),followUp:async data=>{i.follow=data}};
 const state={get:()=>enabled?cfg:null,readConfig:async()=>cfg};const deps={client:{},state,register:()=>{},activateGuild:async()=>{activationCount++;if(regFail)throw Error('registrasi gagal');enabled=true;return{status:'active'}},restoreAccess:async()=>{repairCount++;return {checked:1,verified:1,updated:0,recognized,skipped:recognized?[]:['tidak terlihat'],errors:[]}},setupServer:async()=>{setupCount++;return {createdRoles:[],createdChannels:[],warnings:[]}},setupCommunity:()=>{},isOwner:()=>true,running:new Set()};
 return {i,deps,get:()=>({enabled,activationCount,setupCount,repairCount}),setDisabled:()=>{cfg={disabledCommands:['setup-server']}}};
}
(async()=>{
 let t=make();await handleSetup(t.i,t.deps);assert(t.i.deferred);assert.equal(t.get().enabled,true);assert.equal(t.get().activationCount,1);assert.equal(t.get().repairCount,1);assert.equal(t.get().setupCount,0);assert(t.i.follow.content.includes('Server aktif'));
 t=make({uid:other});await handleSetup(t.i,t.deps);assert.equal(t.get().activationCount,0);assert(t.i.edited.content.includes('pemilik server'));
 t=make({disabled:true});await handleSetup(t.i,t.deps);assert.equal(t.get().activationCount,0);assert(t.i.edited.content.includes('dinonaktifkan'));
 t=make({choice:'cancel-safe-setup'});await handleSetup(t.i,t.deps);assert.equal(t.get().activationCount,0);
 t=make({active:true,uid:other});await handleSetup(t.i,t.deps);assert.equal(t.get().activationCount,0);assert.equal(t.get().repairCount,1);
 t=make({regFail:true});await handleSetup(t.i,t.deps);assert.equal(t.get().enabled,false);assert(t.i.follow.content.includes('registrasi gagal'));
 t=make({choice:'confirm-safe-setup',active:true,recognized:false,ownerRole:true});await handleSetup(t.i,t.deps);assert.equal(t.get().setupCount,0);assert(t.i.follow.content.includes('mencegah duplikat'));
 t=make({choice:'confirm-safe-setup',active:true,recognized:true});await handleSetup(t.i,t.deps);assert.equal(t.get().setupCount,1);assert.equal(t.get().repairCount,2);
 t=make();t.i.fetchReply=async()=>({awaitMessageComponent:async()=>{t.setDisabled();return {customId:'recover-safe-setup',user:t.i.user,guild:t.i.guild,memberPermissions:admin,update:async()=>{}}}});await handleSetup(t.i,t.deps);assert.equal(t.get().activationCount,0);assert(t.i.follow.content.includes('akses')||t.i.follow.content.includes('Akses'));
 const source=require('node:fs').readFileSync('index.js','utf8');assert(source.indexOf("['recover-safe-setup','confirm-safe-setup','cancel-safe-setup']")<source.indexOf('if(!i.guild || !state.get(i.guildId))'));
 console.log('LULUS: setup server nonaktif hanya owner, revalidasi fitur, batal, pulih, hindari duplikat dan gagal aman.');
})().catch(e=>{console.error(e);process.exitCode=1});
