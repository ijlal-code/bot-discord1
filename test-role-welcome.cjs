const assert = require('node:assert/strict');
const {Collection} = require('discord.js');
const {handleRoleButtonInteraction}=require('./role');
const roles=new Collection(['Pekerja','Pelajar','Umum'].map((n,i)=>[String(i+1),{id:String(i+1),name:n,position:1}]));
const guild={roles:{cache:roles},members:{me:{roles:{highest:{position:10}}}}};
let have=new Collection();let called=[];
const member={roles:{cache:have,async add(role){have.set(role.id,role)},async remove(value){if(value instanceof Collection)for(const r of value.values())have.delete(r.id);else have.delete(value.id)}}};
function click(name) {return {customId:`select_role:status:${name}`,member,guild,async deferReply(){},async editReply(p){this.output=p}};}
(async()=>{
 let i=click('Pekerja');await handleRoleButtonInteraction(i,async(m,r)=>called.push(r));assert.deepEqual(called,['Pekerja']);assert(have.has('1'));
 i=click('Pelajar');await handleRoleButtonInteraction(i,async(m,r)=>called.push(r));assert.deepEqual(called,['Pekerja']);assert(have.has('2'));assert(!have.has('1'));
 i=click('Pelajar');await handleRoleButtonInteraction(i,async(m,r)=>called.push(r));assert.deepEqual(called,['Pekerja']);assert(!have.has('2'));
 i=click('Umum');await handleRoleButtonInteraction(i,async(m,r)=>called.push(r));assert.deepEqual(called,['Pekerja','Umum']);
 let errors=0; const old=console.error;console.error=()=>errors++;
 i=click('Umum');await handleRoleButtonInteraction(i,async()=>{});i=click('Pekerja');await handleRoleButtonInteraction(i,async()=>{throw Error('simulated')});console.error=old;
 assert(have.has('1'));assert.match(i.output.content,/berhasil/);assert.equal(errors,1);
 console.log('LULUS: callback hanya saat memilih role dari kosong; gagal welcome tidak membatalkan role.');
})().catch(e=>{console.error(e);process.exitCode=1});
