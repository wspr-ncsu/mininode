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
      await MongoUtil.downloadFile(p.archived, name, dbname);
    } catch (error) {
      throw new Error('MONGO-DOWNLOAD-FAILED');  
    }
    
    // 2. unpack the tar file into a directory
    exec(`tar -xzf ${p.archived} -C ${pathes.ORIGINAL}`);

    // 3. detect the entry point
    let entry = entryPoint(p.original);
    if (entry === null) throw new Error('NO-ENTRY-POINT');

    
    // 4. copied package without node_modules to a new folder 
    exec(`rsync -av --exclude="node_modules" ${p.original} ${pathes.PRODONLY}`);
    
    // 5. npm install only production
    console.log('> INSTALL', name);
    console.time('install');
    let error = true;
    try {
      exec(`npm set registry ${registry}`);
      exec(`cd ${p.prodonly} && npm install --only=prod`);
      error = false;
    } catch {
      if (registry !== mainRegistry) {
        registry = mainRegistry;
        exec(`npm set registry ${registry}`);
        exec(`cd ${p.prodonly} && npm install --only=prod`);    
        error = false;
      }
    } finally {
      if (error) throw new Error(`FAILED-PROD-ONLY-INSTALLATION: ${error.message}`);
      if (fs.existsSync(`${p.prodonly}/node_modules/.bin/`)) {
        exec(`cp -f ${pathes.LINTERS}/* ${p.prodonly}/node_modules/.bin/`);
      }
    }
    console.timeEnd('install');

    // 6. validate prod only installation
    console.log('> TESTING', name);
    console.time('testing');
    try {
      console.log('--- validating the prod only test');
      exec(`ln -sf ${p.prodonly}/${entry} ${p.original}/${entry}`);
      exec(`cd ${p.original}/ && npm test`, {maxBuffer: Infinity, timeout: 3*minute});
    } catch (error) {
      throw new Error(`FAILED-PROD-ONLY-TEST ${error.message}`);
    }
    console.timeEnd('testing');

    exec(`cd ${pathes.PRODONLY} && tar -czf ${p.archivedProd} ${name}`, {maxBuffer: Infinity});

    await MongoUtil.insertFile(`${p.archivedProd}`, name, proddb);

    return true;
  } catch (error){
    throw error;
  }
}
