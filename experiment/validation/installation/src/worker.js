const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);
const processor = require('./processor');
const pathes = require('./pathes');
const Queue = require('bee-queue');
let npminstall = new Queue(process.env.QUEUE, {redis: {host:'192.168.42.141'}});

// initial phase
npminstall.process(processor);

npminstall.on('succeeded', async (job, result)=>{
  console.log('> SUCCESS', job.data.name);
  await cleanArtifacts(job.data.name);
})

npminstall.on('failed', async (job, err)=>{
  console.log('> FAILED', job.data.name);
  await cleanArtifacts(job.data.name);
})

async function cleanArtifacts(name) {
  if (name.includes('/')) {
    name = name.replace(/\//g, '#');
  }
  await exec(`rm -rf ${pathes.ARCHIVES}/${name} ${pathes.PACKAGES}/${name} \`cat ${name}.out\` ${name}.out`);
}