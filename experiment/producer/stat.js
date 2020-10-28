const Bull = require('bull');

let initial = new Bull('test-cases-initial', 'redis://127.0.0.1:6379');
let reduction = new Bull('test-cases-reduction', 'redis://127.0.0.1:6379');
let soft = new Bull('soft-reduction', 'redis://127.0.0.1:6379');
let hard = new Bull('hard-reduction', 'redis://127.0.0.1:6379');

let success = 0;
let promises = [];
let second = 1000;
let minute = 60*second;

try {

  getReductionFailedWith(hard, ['mininode.json: ENOENT: no such file or directory']);
  // getReductionFailedWith(['TypeError: modul.memusages']);
  // getReductionFailedWith(['Permission denied']);
  // getReductionFailedWith(['/app/mn/lib/utils/loader.js']);
  // getReductionFailedWith(soft, ['npm ERR! code ELIFECYCLE']);
  // getReductionFailedWith(['is not defined']);
  // getReductionFailedWith(['is not a function']);  
  // getReductionFailedWith(['Cannot find module']);
  // getReductionFailedWith(soft, ['ONLY PROD TEST FAILED']);
  // getReductionFailedWith(soft, ['NO ENTRY POINT']);
  // getReductionFailedWith(['lazy-cache/index.js']);
  // getReductionFailedWith(['AssertionError']);
  // getReductionFailedWith(soft, ['npm install --only=prod']);
  // getReductionFailedWith(soft, ['Command failed: node --max-old-space-size=8192 /app/mn']);
  // getReductionFailedWith(['key /app/tests/mn_']);
  // getReductionFailedWith(soft, ['&& npm test\nnpm ERR! Test failed.  See above for more details.']);
  // getReductionFailedWith(['&& npm test\nYou must run with']);

  Promise.all(promises).then(()=>{
    reduction.close();
    initial.close();
    soft.close();
    hard.close();
  }).catch((reason) =>{
    console.error(reason);
    initial.close();
    reduction.close();
    soft.close();
    hard.close();
  })
} catch (error) {
  console.error(error);
}


function getReductionFailedWith(queue, reasons, remove = false) {
  promises.push(queue.getFailed());
  promises[0].then(jobs => {
    let count  = 0;
    for(let job of jobs) {
      for (let reason of reasons) {
        if (job.failedReason && job.failedReason.includes(reason)) {
          count++;
          console.log(count, job.id);
          if (remove) {
            console.log('removing...', job.Id);
            promises.push(job.remove());
          }
          break;
        }
      }
    }

    console.log('Failed with', reasons, count, jobs.length);
  });
}