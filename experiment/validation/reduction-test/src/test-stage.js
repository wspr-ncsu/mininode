const promisify = require('util').promisify;
const exec = require('child_process').execSync;
const jfs = require('jsonfile');
const fs = require('fs');
const pathes = require('./pathes').main;
const pgen = require('./pathes').generator;
const MongoUtil = require('./mongoutils');
const entryPoint = require('./entryPoint');
const dbname = process.env.MONGO_DB;
const collection = process.env.MONGO_COLLECTION;
const proddb = process.env.MONGO_DB_PROD;
let second = 1000;
let minute = 60*second;

module.exports = async function processor (job) {
  try {
    let name = job.id;
    if (!name) throw new Error('NAME-UNDEFINED');
    console.log('> STARTING:', name);
    if (name.includes('/')) {
      name = name.replace(/\//g, '#');
    }
    let p = pgen(name);
    // 1. download from mongo db
    try {
      await MongoUtil.downloadFile(p.archived, name, dbname);
      await MongoUtil.downloadFile(p.archivedProd, name, proddb);
    } catch (error) {
      throw new Error('MONGO-DOWNLOAD-FAILED');  
    }
    
    // 2. unpack the tar file into a directory
    exec(`tar -xzf ${p.archivedProd} -C ${pathes.PRODONLY}`);
    exec(`tar -xzf ${p.archived} -C ${pathes.ORIGINAL}`);
    
    // 3. detect the entry point
    let entry = entryPoint(p.prodonly);
    if (entry === null) throw new Error('NO-ENTRY-POINT');

    // 4. reduce the prodonly version
    console.log('> REDUCTION', name);
    console.time('reduction-in-worker');
    exec(`node --max-old-space-size=8192 ${pathes.MININODE} ${p.prodonly} \
    --destination=${p.reduced} --silent --mode=${process.env.MODE} --compress-log`, {maxBuffer: Infinity, timeout: 15*minute});
    console.timeEnd('reduction-in-worker');
    
    // 5. create the link from original to reduced
    try {
      exec(`ln -sf ${p.reduced}/${entry} ${p.original}/${entry}`);  
    } catch (error) {
      throw new Error('FAILED-SYMBOLIC-LINK', error.message);  
    }

    exec(`cd ${p.original}/ && npm test`, {maxBuffer: Infinity, timeout: 3*minute});

    let mininode = jfs.readFileSync(`${p.reduced}/mininode.json`);

    try {  
      mininode.originalComplexity = await complexity(p.prodonly);
      mininode.reducedComplexity = await complexity(p.reduced);
      mininode.coverageSummary = jfs.readFileSync(p.coverageSummary);
      if(fs.existsSync(p.coverage)) {
        mininode.coverage = jfs.readFileSync(p.coverage);
      }      
    } catch (error) {
      throw new Error('FAILED-REPORT-GENERATION', error.message);
    }
    
    try {
      await MongoUtil.insertJson(proddb, collection, mininode);      
    } catch (error) {
      throw new Error('MONGO-INSERT-FAILED: ' + error.message);
    }

    return true;
  } catch (error){
    throw error;
  }
}

async function complexity(path) {
  
  try {
    exec(`cr ${path} --ignoreerrors --output ${path}/mininode-complexity-report.json --format json`, {maxBuffer: Infinity, timeout: 3*minute});
    let json = jfs.readFileSync(`${path}/mininode-complexity-report.json`);  
    json.reports = [];
    json.visibilityMatrix = [];
    json.adjacencyMatrix = [];
    return json;
  } catch {
    return {error: "failed to compute complexity"};
  }
  
}