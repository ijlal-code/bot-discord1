const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./index.js'),'utf8');
const start=source.indexOf('const TOKEN = process.env.DISCORD_TOKEN;');
const end=source.indexOf('\nconst client = new Client',start);
assert(start>=0&&end>start);const segment=source.slice(start,end);
function run(env){const logs=[];const c={process:{env,exit(){throw Error('exit')}},console:{error:x=>logs.push(x)}};try{vm.runInNewContext(segment+'\nglobalThis.loaded = {token:TOKEN, guild:GUILD_ID};',c);return {logs,loaded:c.loaded}}catch(e){if(e.message!=='exit')throw e;return {logs,exit:true}}}
let r=run({});assert(r.exit);assert.match(r.logs[0],/DISCORD_TOKEN/);
r=run({DISCORD_TOKEN:'test-token',GUILD_ID:'100000000000000001'});assert(r.exit);assert.match(r.logs[0],/WELCOME_CHANNEL_ID/);
r=run({DISCORD_TOKEN:'test-token',WELCOME_CHANNEL_ID:'not-id'});assert(r.exit);assert.match(r.logs[0],/ID server/);
r=run({DISCORD_TOKEN:'test-token',WELCOME_CHANNEL_ID:' 100000000000000002 ',GUILD_ID:'100000000000000001'});assert.equal(r.loaded.guild,'100000000000000002');assert.equal(r.loaded.token,'test-token');assert(!r.logs.some(x=>x.includes('test-token')));
console.log('LULUS: token dan ID server dibaca dari environment yang diminta.');
