const fs = require('fs');
const path = require('path');
const escodegen = require('escodegen');

const AppBuilder = require('./models/AppBuilder');
const ModuleBuilder = require('./models/ModuleBuilder');
const config = require('./Configurator');

/** @type {AppBuilder} */
let _app = null;
let location = null;

/**
 * @returns {Boolean}
 * @param {String} directory 
 */
async function traverse(directory) {
  try {
    var folderContent = fs.readdirSync(directory);
    for (let item of folderContent) {
      item = path.join(directory, item);
      let stat = fs.statSync(item);
      if (stat.isDirectory()) {
        await traverse(item);
      } else if (stat.isFile() && (item.endsWith('.js') || item.endsWith('.cjs'))) {
        let _module = new ModuleBuilder();
        _module.app = _app;
        _module.name = path.basename(item);
        _module.path = item;

        if (directory.indexOf('/node_modules', location.length - 1) === -1) {
          _module.isOwned = true;
          // should we add do not reduce here?
        } else {
          let arr = _module.path.split('/');
          let lIndex = arr.lastIndexOf('node_modules');
          _module.packagename = arr[lIndex + 1];
        }

        _module.initialSrc = fs.readFileSync(`${_module.path}`, 'utf8');
        // _module.initialSloc = sloc(_module.initialSrc, 'js').source;
        await parse(_module);
        _module.initialSrc = null;
        _app.modules.push(_module);
      } else if (stat.isFile() && item === 'package.json') {
        let content = fs.readFileSync(`${item}`, utf);
        let packageJson = JSON.parse(content);
        for (let index in packageJson.dependencies) {
          let obj = {};
          obj.parent = packageJson.name;
          obj.name = index;
          obj.version = packageJson.dependencies[index];
          _app.dependencies.push(obj);
        }
      }
    }
  } catch (err) {
    throw new Error(err);
  }
  return true;
}
/**
 * 
 * @param {ModuleBuilder} modul 
 */
async function parse(modul) {
  try {
    if (modul.initialSrc.startsWith('#!')) {
      modul.hashbang = modul.initialSrc.split('\n', 1)[0]; // saves the hashbang value
      modul.initialSrc = modul.initialSrc.replace(/^#!(.*\n)/, ''); // removes hashbang value
    }
    let ast = es.parseScript(modul.initialSrc, {range: true, tokens: true, comment: true});
    modul.ast = ast;

    //calculating the SLOC
    let gen = escodegen.generate(modul.ast);
    modul.initialSloc = sloc(gen, 'js').source;
  } catch (ex) {
    if(config.verbose) console.warn(chalk.bold.yellow('WARN:'), modul.path, ex.message);
    modul.parseError = true;
  }
  return modul;
}

/**
 * @returns {AppBuilder}
 * @param {String} directory 
 */
async function main(app, directory) {
  _app = app;
  location = directory;
  await traverse(directory);
}

module.exports = main;