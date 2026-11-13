const assert = require('node:assert/strict');
const { Routes } = require('discord.js');
const { definitions, registerCommands } = require('./register-commands');
const app='100000000000000001', guild='100000000000000002';
const guildRoute=Routes.applicationGuildCommands(app,guild), globalRoute=Routes.applicationCommands(app);
function fake(failName) {
 const actions=[];
 const g=[{id:'100000000000000003',name:'setup-komunitas',type:1},{id:'100000000000000004',name:'custom-guild',type:1}];
 const globals=[{id:'100000000000000005',name:'setup-komunitas',type:1},{id:'100000000000000006',name:'onboarding-member',type:1},{id:'100000000000000007',name:'setup-server',type:1},{id:'100000000000000008',name:'custom-global',type:1},{id:'100000000000000009',name:'hapus-pesan',type:1}];
 return {actions,async get(route){actions.push(['get',route]);if(route===guildRoute)return g;if(route===globalRoute)return globals;throw Error('unexpected')},
 async patch(route,{body}){actions.push(['patch',route,body.name]);if(body.name===failName)throw Error('Missing Access')},
 async post(route,{body}){actions.push(['post',route,body.name]);if(body.name===failName)throw Error('Missing Access')},
 async delete(route){actions.push(['delete',route])}};
}
(async()=>{
 let x=definitions();assert.deepEqual(x.guild.map(c=>c.name),['setup-komunitas','hapus-pesan','onboarding-member']);assert.equal(x.guild[2].options[0].name,'member');assert.equal(x.guild[2].options[0].required,true);
 const oldLog=console.log,oldErr=console.error;console.log=()=>{};console.error=()=>{};
 let rest=fake();let result=await registerCommands(rest,app,guild);assert.deepEqual(result.guildSucceeded,['setup-komunitas','hapus-pesan','onboarding-member']);assert.equal(result.errors.length,0);
 assert(rest.actions.some(a=>a[0]==='patch'&&a[1]===Routes.applicationGuildCommand(app,guild,'100000000000000003')));
 assert(rest.actions.some(a=>a[0]==='post'&&a[1]===guildRoute&&a[2]==='onboarding-member'));
 assert(rest.actions.some(a=>a[0]==='delete'&&a[1]===Routes.applicationCommand(app,'100000000000000005')));
 assert(rest.actions.some(a=>a[0]==='delete'&&a[1]===Routes.applicationCommand(app,'100000000000000006')));
 assert(!rest.actions.some(a=>a[0]==='delete'&&a[1]===Routes.applicationCommand(app,'100000000000000008')));
 assert(!rest.actions.some(a=>a[0]==='delete'&&a[1]===Routes.applicationCommand(app,'100000000000000009')));
 assert(!rest.actions.some(a=>a[0]==='put'));
 rest=fake('onboarding-member');result=await registerCommands(rest,app,guild);assert.deepEqual(result.guildSucceeded,['setup-komunitas','hapus-pesan']);assert.equal(result.errors.length,1);
 assert(!rest.actions.some(a=>a[0]==='delete'&&a[1]===Routes.applicationCommand(app,'100000000000000006')));
 console.log=oldLog;console.error=oldErr;
 console.log('LULUS: registrasi guild cepat, dukungan member, command lain aman, dan fallback saat gagal.');
})().catch(e=>{console.error(e);process.exitCode=1});
