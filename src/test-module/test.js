const exec = require('child_process').execSync;

exec('node index.js test/module/ --mode=hard --destination=mininode.hard', {stdio: [0, 1, 2]});

exec('node index.js test/module/ --destination=mininode.soft', {stdio: [0, 1, 2]});
