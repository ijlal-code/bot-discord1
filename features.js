'use strict';
// A closed allowlist: a switch controls a slash command, not its panel/buttons.
const COMMANDS=[
 {name:'setup-server',description:'Membuat role dan struktur komunitas'},
 {name:'setup-komunitas',description:'Memasang panel pengelolaan komunitas'},
 {name:'kunci-chat',description:'Mengatur akses chat berdasarkan role'},
 {name:'panel-role',description:'Mengirim panel pilihan role'},
 {name:'hapus-pesan',description:'Mencadangkan dan menghapus pesan'},
 {name:'onboarding-member',description:'Menampilkan onboarding seorang member'},
];
const names=new Set(COMMANDS.map(x=>x.name));
function validDisabled(list){return Array.isArray(list)&&list.length<=names.size&&new Set(list).size===list.length&&list.every(v=>typeof v==='string'&&names.has(v));}
function isDisabled(record,name){return names.has(name)&&Array.isArray(record?.disabledCommands)&&record.disabledCommands.includes(name);}
module.exports={COMMANDS,validDisabled,isDisabled};
