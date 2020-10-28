const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const path = require('path');
const jfs = require('jsonfile');
const pathes = require('./helpers/pathes').main;
const generator = require('./helpers/pathes').generator;
const MongoUtil = require('./helpers/mongoutils');
const entryPoint = require('./helpers/entryPoint');
const { minute } = require('./helpers/time');

const mainRegistry = 'https://registry.npmjs.org';
const dbname = process.env.MONGO_DB;
const softcollection = process.env.SOFT_COLLECTION;
const hardCollection = process.env.HARD_COLLECTION;

let registry = process.env.LOCALNPM || mainRegistry;
let exists = false;

module.exports = async function initialProcess (job) {
  let name = job.id;
  if (!name) throw new Error('NAME UNDEFINED');
  console.log('> INITIAL PHASE:', name);
  console.log(dbname, softcollection, hardCollection)
  if (name.includes('/')) {
    registry = mainRegistry;
    name = name.replace(/\//g, '#');
  } else {
    registry = process.env.LOCALNPM;
  }

  let p = generator(name);

  // 1. check if the application in the database already
  exists = await MongoUtil.findFile(dbname, name) ? true : false;
  
  // 2. download and unpack
  if (exists) {
    await MongoUtil.downloadFile(p.archive, name, dbname);
    await exec(`tar -xzf ${p.archive} -C ${pathes.PACKAGES}`, {maxBuffer: Infinity});
  } else {
    await exec(`npm pack ${job.id} > ${name}.out \
    && mkdir ${p.package} \
    && tar -xzf \`cat ${name}.out\` -C ${p.package}`, {maxBuffer: Infinity, timeout: minute(3)});
    await exec(`mv ${p.package}/*/* ${p.package}/`);    
  }
  
  // 3. check entry point
  let entry = entryPoint(p.package);
  if (!entry) throw new Error('NO-ENTRY-POINT');
  let ext = path.extname(entry).toLowerCase();
  if (ext !== '.js' && ext !== '') throw new Error('INCORRECT-EXT-ENTRY');
  
  // 4. installation
  await exec(`cd ${p.package} && rm -f package-lock.json`);
  try {
    await exec(`npm set registry ${registry} && cd ${p.package} \
              && npm install --only=production`, {maxBuffer: Infinity, timeout: minute(5)});  
  } catch (error) {
    if (registry !== mainRegistry) {
      await exec(`npm set registry ${mainRegistry} && cd ${p.package} \
              && npm install --only=production`, {maxBuffer: Infinity, timeout: minute(5)});
    }
  }
  
  // 5. running both reduction version
  await exec(`cd ${pathes.MININODE} \
    && node --max-old-space-size=8192 index.js ${p.package} --silent --dry-run --log-output=${p.soft} --compress-log`, { timeout: minute(10) });
  
  // await exec(`cd ${pathes.MININODE} \
  //   && node --max-old-space-size=8192 index.js ${p.package} --silent --dry-run --log-output=${p.hard} --mode=hard --compress-log`, { timeout: minute(10) });

  // 6. saving reports
  try {   
    let soft = jfs.readFileSync(`${p.package}/${p.soft}`);
    // let hard = jfs.readFileSync(`${p.package}/${p.hard}`);
    await MongoUtil.insertJson(dbname, softcollection, soft);
    // await MongoUtil.insertJson(dbname, hardCollection, hard);
  } catch (error) {
    throw new Error('SAVING-REPORT-FAILED: ' + error.message);
  }

  // 7. store the archived version if not already exists
  if (!exists) {
    // remove node_modules folder to save space inside mongo
    await exec(`rm -rf ${p.package}/node_modules`);
    await exec(`cd ${pathes.PACKAGES} && tar -czf ${p.archive} ${name}`, {maxBuffer: Infinity});
    // store into mongo
    try {
      await MongoUtil.insertFile(p.archive, name, dbname);  
    } catch (error) {
      throw new Error('FAILED-MONGO-INSERT:' + error.message);
    }
  }
  
  
  return true;
}
