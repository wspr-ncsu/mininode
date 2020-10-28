const MongoUtils = require('./helpers/mongoutils')
const argv = require('yargs').argv;
const exec = require('child_process').execSync;
const mininode = '/home/igibek/Desktop/research/mininode/src/src';

if (!argv.pack) {
  console.error('Please provide name of package to download');
  process.exit(1);
}

let package = argv.pack;
if (!argv.red) {
  MongoUtils.downloadFile(`manual/${package}`, package, 'npm-validation').then(()=>{
    chdir('manual/');
  
    exec(`tar -xzf ${package} -C ./`);
    
    exec(`rsync -av --exclude="node_modules" ${package}/* ${package}-prod`);
    
    chdir(package + '-prod');
    
    exec('npm install --only=prod');
    
    chdir('..');
    
    exec(`mynode ${mininode} ${package}-prod --destination=${package}-red --mode=soft`, { stdio: 'inherit' });
    
  }).catch(e => {process.exit(1)});
  
} else {
  chdir('manual/');
  exec(`mynode ${mininode} ${package}-prod --destination=${package}-red --mode=soft`, { stdio: 'inherit' });
}




function chdir(path) {
  process.chdir(path);
}
