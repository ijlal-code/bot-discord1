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
 const records = await collection.find({ enabled: true }, { projection: { guildId: 1, enabledMemberCommands: 1, discussionId: 1 } }).limit(1000).toArray();
 for (const r of records) active.set(r.guildId, r);
}
function get(id) { return active.get(id); }
async function exists(id){return !!await collection.findOne({guildId:id},{projection:{_id:1}});}
async function activate(id) {
 if(!active.has(id)&&active.size>=1000)throw Error('Batas 1000 server aktif tercapai.');
 await collection.updateOne({guildId:id}, {$set:{enabled:true,updatedAt:new Date()},$setOnInsert:{enabledMemberCommands:[],discussionId:null}}, {upsert:true});
 const r=await collection.findOne({guildId:id}); active.set(id,r); return r;
}
async function select(id, enabled, channel) {
 if(!active.has(id))throw Error('Server belum aktif.');
 await collection.updateOne({guildId:id,enabled:true},{$set:{enabledMemberCommands:enabled?['onboarding-member']:[],discussionId:enabled?channel:null,updatedAt:new Date()}});
 active.set(id,{...active.get(id),enabledMemberCommands:enabled?['onboarding-member']:[],discussionId:enabled?channel:null});
}
async function deactivate(id){active.delete(id);await collection.updateOne({guildId:id},{$set:{enabled:false,enabledMemberCommands:[],discussionId:null,updatedAt:new Date()}});}
async function close(){await connection?.close();}
module.exports={init,get,exists,activate,deactivate,select,close,active};
