const argv = require('yargs').argv;
const jfs = require('jsonfile');
if (!argv.queue || (!argv.msg && !argv.exmsg && !argv.all && !argv.file)) {
    console.error('--queue and --msg is required');
    process.exit(1);
}

const BeeQueue = require('bee-queue');
const queue = new BeeQueue(argv.queue);

let failedWithMessage = 0;
let promises = [];
const type = argv.type ? argv.type : 'failed';

queue.getJobs(type, {size: 200000}).then(jobs => {
    if (argv.msg) {
        for (const job of jobs) {
            if (job.options.stacktraces[0].includes(argv.msg)) {
                failedWithMessage++;
                promises.push(job.retry());
            }
        }
    } else if (argv.exmsg) {
        for (const job of jobs) {
            if (!job.options.stacktraces[0].includes(argv.exmsg)) {
                failedWithMessage++;
                promises.push(job.retry());
            }
        }
    } else if (argv.all) {
        for (const job of jobs) {
            failedWithMessage++;
            promises.push(job.retry());
        }
    } else if (argv.file) {
        let collection = jfs.readFileSync(argv.file);
        for (const job of jobs) {
            if (collection.includes(job.id)) {
                failedWithMessage++;
                promises.push(job.retry());
            }
        }
    }
}).catch( err => { 
    console.log(err); 
}).finally(async function(){
    console.log('With certain msg', failedWithMessage);
    await Promise.all(promises); 
    queue.close() 
});
