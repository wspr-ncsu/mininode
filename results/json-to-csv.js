const fs = require('fs');
const jfs = require('jsonfile');
const argv = require('yargs').argv;

if (!argv.filename || !argv.out) {
    console.error('--filename and --out is required');
    process.exit(1);
}

let json = jfs.readFileSync(argv.filename);

if (argv.path) {
    json = json[argv.path];
}

if(argv.skips) {
    argv.skips = argv.skips.split(',');
    for (const skip of argv.skips) {
        delete json[0][skip];
    }
}

let keys = Object.keys(json[0]);

let csv = keys.join(',') + '\n';

for (const item of json) {
    for (const key of keys) {
        csv += item[key] + ',';
    }
    csv = csv.slice(0, -1);
    csv += '\n';
}


fs.writeFileSync(argv.out, csv);