'use strict';
const { MongoClient } = require('mongodb');
const active = new Map();
let collection, connection;
async function init() {
 if (!process.env.MONGODB_URI) throw Error('MONGODB_URI belum diatur.');
 connection = new MongoClient(process.env.MONGODB_URI, { maxPoolSize: 5, serverSelectionTimeoutMS: 10000 });
 await connection.connect();
 collection = connection.db(process.env.MONGODB_DB || 'komunitas').collection('guilds');
 await collection.createIndex({ guildId: 1 }, { unique: true });
 if(await collection.countDocuments({enabled:true},{limit:1001})>1000)throw Error('Lebih dari 1000 server aktif; kurangi sebelum memulai.');
 const records = await collection.find({ enabled: true }, { projection: { guildId: 1, enabledMemberCommands: 1, discussionId: 1, disabledCommands: 1 } }).limit(1000).toArray();
 for (const r of records) active.set(r.guildId, r);
}
function get(id) { return active.get(id); }
async function exists(id){return !!await collection.findOne({guildId:id},{projection:{_id:1}});}
async function activate(id) {
 if(!active.has(id)&&active.size>=1000)throw Error('Batas 1000 server aktif tercapai.');
 await collection.updateOne({guildId:id}, {$set:{enabled:true,leftGuild:false,updatedAt:new Date()},$setOnInsert:{enabledMemberCommands:[],discussionId:null}}, {upsert:true});
 const r=await collection.findOne({guildId:id}); active.set(id,r); return r;
}
async function select(id, enabled, channel) {
 if(!active.has(id))throw Error('Server belum aktif.');
 await collection.updateOne({guildId:id,enabled:true},{$set:{enabledMemberCommands:enabled?['onboarding-member']:[],discussionId:enabled?channel:null,updatedAt:new Date()}});
 active.set(id,{...active.get(id),enabledMemberCommands:enabled?['onboarding-member']:[],discussionId:enabled?channel:null});
}
async function deactivate(id){active.delete(id);await collection.updateOne({guildId:id},{$set:{enabled:false,leftGuild:false,enabledMemberCommands:[],discussionId:null,updatedAt:new Date()}});}
async function readConfig(id){return await collection.findOne({guildId:id},{projection:{disabledCommands:1,enabled:1,leftGuild:1,layout:1,customCategories:1}});}
async function setDisabled(id,disabled){
 const {validDisabled}=require('./features');if(!validDisabled(disabled))throw Error('Pilihan perintah tidak valid.');
 const r=await collection.updateOne({guildId:id},{$set:{disabledCommands:disabled,updatedAt:new Date()}});
 if(!r.matchedCount)throw Error('Server belum pernah terdaftar.');
 if(active.has(id))active.set(id,{...active.get(id),disabledCommands:[...disabled]});
}
async function markLeft(id){active.delete(id);await collection.updateOne({guildId:id},{$set:{enabled:false,leftGuild:true,updatedAt:new Date()}});}
async function ensurePending(id){await collection.updateOne({guildId:id},{$setOnInsert:{enabled:false,leftGuild:false,enabledMemberCommands:[],discussionId:null,createdAt:new Date()}},{upsert:true});}
async function markJoined(id){active.delete(id);await collection.updateOne({guildId:id},{$set:{enabled:false,leftGuild:false,updatedAt:new Date()},$setOnInsert:{enabledMemberCommands:[],discussionId:null}},{upsert:true});}
async function setLayout(id,layout){const {validateLayout}=require('./custom-layout');const safe=validateLayout(layout);const r=await collection.updateOne({guildId:id},{$set:{layout:safe,updatedAt:new Date()}});if(!r.matchedCount)throw Error('Server belum terdaftar.');}
async function recordCustomCategory(id,record){await collection.updateOne({guildId:id},{$push:{customCategories:record}});}
async function close(){await connection?.close();}
module.exports={init,get,exists,activate,deactivate,select,readConfig,setDisabled,markLeft,ensurePending,markJoined,setLayout,recordCustomCategory,close,active};
