const argv = require('yargs').argv;

if(!argv.from || !argv.to) {
    console.error('--from and --to are required');
    process.exit(1);
}

const jfs = require('jsonfile');
const Queue = require('bee-queue');
const fromQueue = new Queue(argv.from, {isWorker: false});
const toQueue = new Queue(argv.to, {isWorker: false}); 

let promises = [];
let second = 1000;
let minute = 60 * second;

copySuccessJobs();


Promise.all(promises).then(i=>{
  console.log('all jobs added');
  fromQueue.close();
  toQueue.close();
})


function copySuccessJobs(size = 1000000) {
    promises.push(
        fromQueue.getJobs('succeeded', {size: size})
        .then(jobs => {
            for (const job of jobs) {
                console.log(job.id);
                promises.push(
                    toQueue.createJob(job.data)
                        .timeout(20*minute)
                        .setId(job.id)
                        .save()    
                    );              
            }
        })
    )
}