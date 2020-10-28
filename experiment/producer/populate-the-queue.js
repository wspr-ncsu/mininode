const argv = require('yargs').argv;
if (!argv.queue || !argv.file) {
  console.error('--queue and --file are required');
  process.exit(1);
}
const Queue = require('bee-queue');
const queue = new Queue(argv.queue, {isWorker: false});
const jfs = require('jsonfile');

let promises = [];
let second = 1000;
let minute = 60 * second;

const arr = jfs.readFileSync(argv.file)

console.log(arr.length);

addToQueue(arr)

Promise.all(promises).then(i=>{
  console.log('all jobs added');
  queue.close();
})

function addToQueue(arr) {
  for (const item of arr) {
    console.log(item);
    promises.push(
      queue.createJob(item)
        .timeout(15*minute)
        .setId(item)
        .save()    
    )
  }
}
