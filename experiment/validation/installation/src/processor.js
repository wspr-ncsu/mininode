const exec = require('child_process').execSync;
const fs = require('fs');
const jfs = require('jsonfile');
const pathes = require('./pathes');
const MongoUtil = require('./mongoutils');
const entryPoint = require('./entryPoint');
const dbname = process.env.MONGO_DB;
const mainRegistry = 'https://registry.npmjs.org';

let second = 1000;
let minute = 60*second;

module.exports = async function processor (job) {
  try {
    let name = job.id;
    if (!name) throw new Error('NAME UNDEFINED');

    let repo = job.data.repo;
    let registry = process.env.LOCALNPM;
    let directory = `${pathes.PACKAGES}/${name}`;
    
    console.log('> INITIAL PHASE:', name);
    
    if (name.includes('/')) {
      name = name.replace(/\//g, '#');
      registry = mainRegistry;
    }

    // 1. git clone the package
    await clone(repo, name);

    // 2. check if package has entry point
    if(!entryPoint(directory)) {
      throw new Error('NO-ENTRY');
    }

    // 3. install the package
    console.log('-- installing ...')
    let error = true;
    try {
      exec(`npm set registry ${registry} && \
            cd ${directory} && npm install`, {maxBuffer: Infinity, timeout: 5*minute});
      error = false;
    } catch (error) {
      if (registry !== mainRegistry) {
        exec(`npm set registry ${mainRegistry} && \
            cd ${directory} && npm install`, {maxBuffer: Infinity, timeout: 5*minute});
        error = false;
      }
    } finally {
      if (error) throw new Error('FAILED-TO-INSTALL\n' + error.message);
    }
    
    // 4. copy the linters
    if (fs.existsSync(`${directory}/node_modules/.bin/`)) {
      exec(`cp -f ${pathes.LINTERS}/* ${directory}/node_modules/.bin/`);
    }
    
    // 5. run original test
    console.log('-- testing ...')
    try {
      exec(`cd ${directory} && npx nyc --reporter=json-summary npm run test`, {maxBuffer: Infinity, timeout: 5*minute});
    } catch (error) {
      throw new Error('FAILED-ORIGINAL-TEST');
    }

    // 6. check if codecoverage is generated
    error = true;
    try {
      let codecov = jfs.readFileSync(`${directory}/coverage/coverage-summary.json`);
      if (codecov && codecov !== {}) {
        error = false;
      }
    } catch (error) {
      if (error)
        throw new Error('FAILED-CODE-COVERAGE');
    }

    // 7. archive the packages
    console.log('-- archiving ...')
    exec(`cd ${pathes.PACKAGES} && tar -czf ${pathes.ARCHIVES}/${name} ${name}`, {maxBuffer: Infinity});

    // 8. save the archive inside the mongo
    try {     
      console.log('-- storing inside mongo ...')
      await MongoUtil.insertFile(`${pathes.ARCHIVES}/${name}`, name, dbname);
    } catch (error) {
      throw new Error('FAILED-MONGO-INSERT ' + error.message);
    }
    return true;
  } catch (error){
    throw error;
  }
}

async function clone(repo, name) {
  if (repo.startsWith('git+')) {
    repo = repo.replace('git+', '');
  }
  await exec(`git clone ${repo} ${pathes.PACKAGES}/${name}`);
}