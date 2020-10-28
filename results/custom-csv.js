const fs = require('fs');
const readline = require('readline');
let argv = require('yargs').argv;

let liner = readline.createInterface({
    input: fs.createReadStream(`./data/${argv.file}`, {encoding: 'utf8'})
});

argv.fields = argv.fields.split(',');
let count = 0, csv = argv.fields.join(',') + '\n', ln = "";

liner.on('line', (line) => {
    let doc = JSON.parse(line);
    console.log(count++, doc.path);
    ln = "";
    for (const field of argv.fields) {
        ln += doc[field] + ',';
    }
    ln = ln.substring(0, ln.length-1) + '\n';
    csv += ln;
});

liner.on('close', ()=>{
    fs.writeFileSync(`./data/${argv.out}`, csv);
})
