const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const jsf = require('jsonfile');
const pathes = require('./pathes');
const MongoUtils = require('./mongoutils');
const entryPoint = require('./entryPoint');
const dbname = 'npm-installs';
const collection = 'results';

let second = 1000;
let minute = 60*second;

module.exports = async function(job) {
  try {
    let name = job.data.name;
    console.log('> REDUCTION PHASE:', name);
    let destination = pathes.ARCHIVES + '/' + name;

    console.log('-- downloading ...');
    await MongoUtils.downloadFile(destination, name, dbname);
    
    // unzipping tar file
    console.log('-- unzipping ...');
    await exec(`cd ${pathes.ARCHIVES} && tar -xzf ${name} -C ${pathes.TODOS}`, {maxBuffer: Infinity});
    
    // run mininode
    console.log('-- reducing ...');
    await exec(`node --max-old-space-size=8192 ${pathes.MININODE} ${pathes.TODOS}/${name} \
      --silent --dry-run`, {maxBuffer: Infinity, timeout: 8*minute});
    
    // store mininode.json as a result
    let json = jsf.readFileSync(`${pathes.TODOS}/${name}/mininode.json`);
    await MongoUtils.insertJson(dbname, collection, json);

    return json;
  } catch (error) {
    throw error;
  }
}