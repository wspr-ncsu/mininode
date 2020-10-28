if (process.argv.length < 3) {
    console.error('please provide <git url>');
    process.exit(1);
}


const exec = require('child_process').execSync;

// exec(`git clone ${process.argv[2]} test-pack`);

process.chdir('test-pack');
console.log('INSTALLING...');
exec('npm install');

console.log('INSTALLING PROD...');
process.chdir('..');
exec('rsync -av --exclude="node_modules" test-pack/* test-pack-prod');
process.chdir('test-pack-prod');
exec('npm install --only=prod');
console.log('REDUCING...');
process.chdir('..');
exec('mynode src/ test-pack-prod/ --destination=test-pack-red --mode=soft --silent --compress-log')