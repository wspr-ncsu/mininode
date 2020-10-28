const argv = require('yargs').argv;
const jfs = require('jsonfile');

if (!argv.queue || (!argv.msg && !argv.exmsg && !argv.all) ) {
    console.error('--queue and --msg is required');
    process.exit(1);
}

const BeeQueue = require('bee-queue');
const queue = new BeeQueue(argv.queue);

const type = argv.type ? argv.type : 'failed';
let ids = [];

queue.getJobs(type, {size: 400000}).then(jobs => {
    if (argv.msg) {
        for (const job of jobs) {
            let stacktrace = job.options.stacktraces[0];
            if (stacktrace.startsWith(argv.msg) || stacktrace.includes(argv.msg)) {
                ids.push(job.id);
            }
        }
    } else if (argv.exmsg) {
        for (const job of jobs) {
            let stacktrace = job.options.stacktraces[0];
            if (!stacktrace.includes(argv.exmsg)) {
                ids.push(job.id);
            }
        }
    } else if (argv.all) {
        for (const job of jobs) {
            ids.push(job.id);
        }
    }
}).catch( err => { 
    console.log(err); 
}).finally(()=> {
    console.log(ids.join('\n'))
    console.log('Total: ', ids.length);
    if (argv.save) {
        jfs.writeFileSync(`${argv.queue}-${type}.json`, ids, {spaces: 2});
    } 
    queue.close() 
});
