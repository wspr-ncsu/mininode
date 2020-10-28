const promisify = require('util').promisify;
const exec = require('child_process').execSync;
const jfs = require('jsonfile');
const fs = require('fs');
const pathes = require('./pathes').main;
const pgen = require('./pathes').generator;
const MongoUtil = require('./mongoutils');
const entryPoint = require('./entryPoint');
const mainRegistry = 'https://registry.npmjs.org';
const dbname = process.env.MONGO_DB;
const collection = process.env.MONGO_COLLECTION;
const proddb = process.env.MONGO_DB_PROD;
let second = 1000;
let minute = 60*second;

module.exports = async function processor (job) {
  try {
    let registry = process.env.LOCALNPM;

    let name = job.id;
    if (!name) throw new Error('NAME-UNDEFINED');
    console.log('> STARTING:', name);
    if (name.includes('/')) {
      name = name.replace(/\//g, '#');
      registry = mainRegistry;
    }
    let p = pgen(name);
    // 1. download from mongo db
    try {
      await MongoUtil.downloadFile(p.archivedProd, name, proddb);
    } catch (error) {
      throw new Error('MONGO-DOWNLOAD-FAILED');  
    }
    
    // 2. unpack the tar file into a directory
    exec(`tar -xzf ${p.archivedProd} -C ${pathes.PRODONLY}`);
    
    // 3. detect the entry point
    let entry = entryPoint(p.prodonly);
    if (entry === null) throw new Error('NO-ENTRY-POINT');

    // 4. reduce the prodonly version
    console.log('> REDUCTION', name);
    console.time('reduction-in-worker');
    exec(`node --max-old-space-size=8192 ${pathes.MININODE} ${p.prodonly} \
    --destination=${p.reduced} --silent --mode=hard --compress-log`, {maxBuffer: Infinity, timeout: 15*minute});
    console.timeEnd('reduction-in-worker');
    
    return true;
  } catch (error){
    throw error;
  }
}
