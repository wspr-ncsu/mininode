const Bull = require('bull');

let initialQ = new Bull('test-cases-initial', 'redis://127.0.0.1:6379');
let soft = new Bull('soft-reduction', 'redis://127.0.0.1:6379');
let hard = new Bull('hard-reduction', 'redis://127.0.0.1:6379');
let npmi = new Bull('npm-install', 'redis://127.0.0.1:6379');
let npma = new Bull('npm-analysis', 'redis://127.0.0.1:6379');
let npmi2 = new Bull('npm-install-2', 'redis://127.0.0.1:6379');
let success = 0;
let promises = [];
let second = 1000;
let minute = 60*second;
try {
  // copyJobs(soft, hard,['active', 'failed', 'completed'])
  // removeAllJobs(npmi2);
  // restartFailedJobs(npmi2);
  // getJobs(soft, ['failed']);
  // pauseTheQueue(npmi);
  // getJobs(npmi, ['paused']);
  // retryJobs(npmi, ['failed']);
  removeJobs(npmi2, ['wait', 'active', 'failed']);
  // resumeTheQueue(npmi);
  // removeWaitJobs(npmi);
  // getJob(npmi, 'ngx-bootstrap-alert')
  closeConnections();
} catch (error) {
  console.error(error);
  closeConnections();
}

function copyJobs(from, to, types) {
  promises.push (
    from.getJobs(types).then((jobs)=>{
      for (let job of jobs) {
        promises.push(
          to.add(job.data, {timeout: 18*minute, jobId: job.data.name})
        );
        console.log('added: ', job.data.name);
      }
    })
  );
}


function getJobs(queue, types, cond = null) {
  promises.push(queue.getJobs(types).then(jobs => {
    let count = jobs.length, withcond = 0;
    for (let j of jobs) {
      if (!cond || j.failedReason && j.failedReason.includes(cond)) {
        withcond += 1;
        if (j) console.log(j.data.name);
      }
    }
    console.log('total:', count, types);
  }))
}
function retryJobs(queue, types, cond = null) {
  promises.push(
    queue.getJobs(types).then(jobs => {      
      for (let j of jobs) {
        if (!cond || j.failedReason && j.failedReason.includes(cond)) {
          console.log('retry:', j.data.name);
          promises.push(
            j.retry()
          );
        } 
      }
    })
  );
}

function getJob(queue, id) {
  promises.push(
    queue.getJob(id).then(j => {
      // promises.push(
      //   j.getState().then(s => {
      //     console.log(s)
      //   })  
      // )
      console.log(j)
      promises.push(
        j.remove()
      )
      
    })
  )
}

function removeJobs(queue, types, cond = null) {
  for (let type of types) {
    promises.push(
      queue.clean(1, type)
    );
  }
}

function restartFailedJobs(queue, cond = null) {
  promises.push(queue.getFailed().then(jobs => {
    console.log(jobs.length);
    for (let job of jobs) { 
      if (cond === null || job.failedReason && job.failedReason.includes(cond))
        promises.push(
          job.retry().then(() => {
            console.log('retrying:', job.data.name);
            success += 1;
          }).catch((reason)=>{
            console.log('failed retrying:', job.data.name, reason);
          })
        );
      
    }
  }))
}
function removeWaitJobs(queue) {
  promises.push(queue.clean(1, 'wait'));
}

function removeAllJobs(queue) {
  promises.push(
    queue.clean(1, 'completed')
    );
  promises.push(
    queue.clean(1, 'failed')
    );
  removeWaitJobs()
  promises.push(
    queue.clean(1, 'active')
    );
}

function removeFailedJobs(queue, cond = null) {
  promises.push(
    queue.getFailed().then(jobs => {
      console.log(jobs.length);
      for (let job of jobs) { 
        if (cond === null || (job.failedReason && job.failedReason.includes(cond)))
          promises.push(
            job.remove().then(() => {
              console.log('removing:', job.data.name);
              success += 1;
            }).catch((reason)=>{
              console.log('failed removing:', job.data.name, reason);
            })
          );
      }
    })
  );
}

function pauseTheQueue(queue) {
  promises.push(
    queue.pause(false)
  );
}

function resumeTheQueue(queue) {
  promises.push(
    queue.resume(false)
  )
}
function closeConnections(){
  Promise.all(promises).then(()=>{
    soft.close();
    hard.close();
    initialQ.close();
    npma.close();
    npmi.close();
    npmi2.close();
  })
}