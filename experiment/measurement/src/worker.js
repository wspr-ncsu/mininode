const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const pathes = require('./helpers/pathes').main;
const generator = require('./helpers/pathes').generator;
const Queue = require('bee-queue');
const redishost = process.env.REDIS || '127.0.0.1';


let npminstall = new Queue(process.env.QUEUE, {redis: {host:redishost}});

let processor = null;
console.log(process.env);
switch(process.env.STAGE) {
  case 'install':
    processor = require('./install-stage.js');
    break;
  case 'analysis':
    processor = require('./analysis-stage.js');
    break;
  default:
    throw new Error('INCORRECT-STAGE:', process.env.STAGE);
}

npminstall.process(processor);

npminstall.on('succeeded', async (job, result)=>{
  console.log('> SUCCESS', job.id);
  await cleanArtifacts(job.id);
})

npminstall.on('failed', async (job, err)=>{
  console.log('> FAILED', job.id);
  await cleanArtifacts(job.id);
})

/**
 * 
 * @param {String} name 
 */
async function cleanArtifacts(name) {
  if (name.includes('/')) name = name.replace(/\//g, '#');
  let p = generator(name);
  await exec(`rm -rf ${p.package} ${p.archive} \`cat ${name}.out\` ${name}.out`);
}