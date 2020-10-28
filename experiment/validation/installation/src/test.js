const promisify = require('util').promisify;
const exec = promisify(require('child_process').exec);

test();

async function test(){

  let result = await exec(`npm show express scripts.test`)
  if (!result.stdout) console.log('here')
  console.log(result)
}