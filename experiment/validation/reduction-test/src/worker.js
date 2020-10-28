const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const pathgenerator = require('./pathes').generator;
let modul = null;
switch (process.env.STAGE) {
  case 'prod':
    modul = './prod-stage';
    break;
  case 'reduction':
    modul = './reduction-stage';
    break;
  case 'test':
    modul = './test-stage';
    break;
  case 'builtin':
    modul = './builtin-stage';
    break;
  default:
    throw new Error('INCORRECT-STAGE');
}

const processor = require(modul);
const Queue = require('bee-queue');
let task = new Queue(process.env.QUEUE, {redis: {host: process.env.REDIS }});


// initial phase
task.process(processor);

task.on('succeeded', async (job, result)=>{
  console.log('> SUCCESS', job.id);
  await cleanArtifacts(job.id);
})

task.on('failed', async (job, err)=>{
  console.log('> FAILED', job.id);
  await cleanArtifacts(job.id);
})

async function cleanArtifacts(name) {
  if (name.includes('/')) {
    name = name.replace(/\//g, '#');
  }
  let p = pathgenerator(name);
  await exec(`rm -rf ${p.reduced} ${p.original} ${p.prodonly} ${p.archived} ${p.archivedProd}`);
}