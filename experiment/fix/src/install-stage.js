const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const jfs = require('jsonfile');
const pathes = require('./helpers/pathes').main;
const generator = require('./helpers/pathes').generator;
const MongoUtil = require('./helpers/mongoutils');
const dbname = process.env.MONGO_DB;
const softcollection = process.env.SOFT_COLLECTION;

module.exports = async function initialProcess (job) {
  let name = job.id;
  if (!name) throw new Error('NAME UNDEFINED');
  console.log('> INITIAL PHASE:', name);
  if (name.includes('/')) {
    name = name.replace(/\//g, '#');
  }

  let p = generator(name);

  // 1. download the doc
  let query = {path: p.package};
  let dependencies = {}, uniqueDependencies = 0, totalDependencies = 0;

  let mininode = await MongoUtil.retrieveDoc(dbname, softcollection, query);
  console.log('RETRIEVED:', name);

  // 2. check the declared count
  if (mininode.declaredDependencyCount > 0) {
    // 3. if needed download the package
    await MongoUtil.downloadFile(p.archive, name, dbname);
    await exec(`tar -xzf ${p.archive} -C ${pathes.PACKAGES}`, {maxBuffer: Infinity});
    console.log('FILE:', name);

    // 4. calculate the dependencies
    let lockFile = jfs.readFileSync(`${p.package}/package-lock.json`);  
    installedPackages(lockFile, dependencies);
    uniqueDependencies = Object.keys(dependencies).length;
    for (const key in dependencies) {
      if (Object.prototype.hasOwnProperty.call(dependencies, key)) {
        totalDependencies += dependencies[key].length;
      }
    }
    console.log('CALCULATED:', name);
  }
  
  // 4. update the doc
  if (mininode.path === p.package) {
    mininode.dependencies = dependencies;
    mininode.installedUniqueDependencyCount = uniqueDependencies;
    mininode.installedTotalDependencyCount = totalDependencies;
    await MongoUtil.upsertJson(dbname, softcollection, mininode, query);
    console.log('UPDATED:', name);
  } else {
    throw new Error('name is not equal', mininode.path);
  }
  
  return true;
}


function installedPackages(package, obj, includeDev = false) {
  if (!package) return null;

  for(let p in package.dependencies) {
    if (!package.dependencies[p].dev || includeDev) {
      if(!Object.prototype.hasOwnProperty.call(obj, p)) {
        obj[p] = [package.dependencies[p].version];
      } else if (!obj[p].includes(package.dependencies[p].version)){
        obj[p].push(package.dependencies[p].version);
      }
      installedPackages(package.dependencies[p], obj);
    }  
  }
}