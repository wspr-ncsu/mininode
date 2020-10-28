const jfs = require('jsonfile')
const { hasTest, hasDependencies, getRepository, dependsOn } = require('./helpers/check-package');
const registry = require('package-stream')();

const frameworks = ['mocha', 'ava', 'jest', 'tap', 'nyc'];

let filtered = [];
let count = 0;
registry.on('package', function(pck, seq) {
    console.log(filtered.length, pck.name, pck.repository);
    let repository = getRepository(pck);
    if(repository && hasTest(pck) && hasDependencies(pck) && dependsOn(pck, frameworks)) {
        filtered.push({
            name: pck.name,
            repo: repository
        });
    }
}).on('up-to-date', function() {
    save();
    process.exit();
});

function save() {
    jfs.writeFileSync('./data/filtered-tmp.json', filtered, {spaces: 2});
}




