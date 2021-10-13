#! /usr/bin/env node

const fs = require('fs');
const es = require('esprima');
const escodegen = require('escodegen');
const path = require('path');
const argv = require('yargs').argv;
const chalk = require('chalk');
const sloc = require('sloc');

const AppBuilder = require('./lib/models/AppBuilder');
const ModuleBuilder = require('./lib/models/ModuleBuilder');
const generator = require('./lib/Generator');
const Analyzer = require('./lib/Analyzer');
const Reducer = require('./lib/Reducer');
const Detector = require('./lib/Detector');
const config = require('./lib/Configurator');
const stat = require('./lib/Stat');
const utils = require('./lib/utils');
const packageDependencies = require('./lib/utils/package-dependencies');


let location = process.argv[2];
let utf = 'utf-8';
location = path.resolve(location);
if (location.indexOf('package.json') !== -1) {
  location = path.dirname(location);
}

let _app = new AppBuilder();
let entries = [];
// let devs = packageDependencies.toList(location, true);
// console.log(devs, devs.length);
// process.exit(0);
(async function () {
  console.time('overall');
  try {
    console.info(chalk.bold.blue(`====================\nSTARTED ${location}\n====================`));
    console.info(chalk.bold.green('>> INITIALIZING...'));
    await init();
    console.info(chalk.bold('>> DONE INITIALIZING'));
    
    console.info(chalk.bold.green('>> TRAVERSING...'));
    await traverse(location);
    console.info(chalk.bold('>> DONE TRAVERSING'));

    console.log(chalk.bold.green('>> DETECTOR...'));
    await Detector(_app);
    console.log(chalk.bold(">> DONE DETECTOR"))
    
    if (_app.usedComplicatedDynamicImport) {
      throw new Error('DYNAMIC_IMPORT_DETECTED');
    }
    
    if (config.mode === 'hard') {
      console.log(chalk.bold.green('>> BUILDING DEPENDENCY GRAPH...'));
      await buildDependency();
      console.log(chalk.bold('>> DONE BUILDING DEPENDENCY GRAPH'));
      // await attackSurface();
      
      console.log(chalk.bold.green('>> FINAL REDUCING...'));
      /**
       * 1. iterate modules' memusage
       * 2. map results to app.globals by name
       * 3. add to individual modules used globals.
       */
      for (let modul of _app.modules) {
        for (let mem in modul.memusages) {
          _app.globals.forEach(i => {
            if (i.name === mem) {
              for(let m of modul.memusages[mem]) {
                i.members.push(m);
              }
            }
          })
        }
      }
  
      for (let modul of _app.modules) {
        for (let glb of _app.globals) {
          if (glb.path === modul.path) {
            for (let m of glb.members) {
              modul.used.push(m);
            }
          }
        }
      }
  
      let usedExternalModules = _app.modules.filter(m => (m.isUsed && !m.skipReduce));
      for (let modul of usedExternalModules) {
        if (config.verbose) console.log(chalk.bold('> REDUCING:'), modul.path);
        await reduceModule(modul);
        if (config.verbose) console.log('-- done');
      }
      console.log(chalk.bold('>> DONE FINAL REDUCING'));
    
    }
    
    if (!config.skipRemove) {
      console.log(chalk.bold.green('>> REMOVING UNUSED MODULES...'));
      
      if (!_app.usedComplicatedDynamicImport) {
        let modulesToRemove = _app.modules.filter(m => !m.isUsed);
        for (let modul of modulesToRemove) {
          await utils.removeFile(modul, config.dryRun);
        } 
      } else if (config.mode === 'hard'){
        // run reduction with dimports
        for (const dimport of _app.dimports) {
          if (config.verbose) console.log('> DYNAMIC IMPORT REDUCTION', _app.dimports);
          let reducableModules = _app.modules.filter(m => (!m.skipReduce) && dimport.members.every(v => m.members.includes(v)));
          for (let modul of reducableModules) {
            await reduceModule(modul, dimport.members);
          }  
        }
      }
      
      console.log(chalk.bold('>> DONE REMOVING UNUSED MODULES'));
    }
    
    console.log(chalk.bold.green('>> GENERATING...'));
    let usedModules = _app.modules.filter(m => !m.isRemoved && !m.skipReduce);
    for (var modul of usedModules) {
      if (!modul.parseError) {
        generator.generate(modul, config.dryRun);
      }
    }
    console.log(chalk.bold('>> DONE GENERATING'));

    console.log(chalk.bold.green('>> CALCULATING STATS...'));
    utils.calculateAppStatictic(_app);
    console.log(chalk.bold('>> DONE CALCULATING'));

    if (config.log) {
      console.log(chalk.bold.green('>> CREATING MININODE.JSON...'));
      let log_path = path.join(location, config.logOutput);
      fs.writeFileSync(log_path, JSON.stringify(_app, null, 2), {encoding: 'utf-8'});
      console.log(chalk.bold('>> DONE CREATING MININODE.JSON'));
    }

  } catch (err) {
    throw err;
  }
  console.timeEnd('overall');
})().catch(e => {
  console.error(e);
  process.exit(1);
});


/**
 * Initializes the initial state of the application.
 */
async function init () {
  if (!config.dryRun) {
    generator(location, config.destination);
    location = path.resolve(config.destination);
  }

  let content = fs.readFileSync(path.join(location, 'package.json'), {encoding: utf});
  let packageJson = JSON.parse(content);

  _app.appname = packageJson.name;
  _app.version = packageJson.version;
  _app.path = location;
  _app.main = utils.entryPoint(location, packageJson.main);

  if (!_app.main) {
    throw new Error("NO_ENTRY_POINT");
  }
  entries.push(path.join(_app.path, _app.main));

  if (packageJson.dependencies) {
    _app.declaredDependencyCount = Object.keys(packageJson.dependencies).length;
    let packageLock = path.join(location, 'package-lock.json');
    if (fs.existsSync(packageLock)) {
      content = fs.readFileSync(path.join(location, 'package-lock.json'), {encoding: utf});
      packageJson = JSON.parse(content);
      packageDependencies.installedPackages(packageJson, _app.dependencies);
      _app.installedUniqueDependencyCount = Object.keys(_app.dependencies).length;
      for(let i in _app.dependencies) {
        _app.installedTotalDependencyCount += _app.dependencies[i].length;
      }
    }
  }
  // entries = utils.entryPoints(_app);

  // if (entries.length === 0) {
  //   console.error(chalk.bold.red('NO ENTRY POINTS SPECIFIED'));
  //   throw new Error('NO ENTRY POINTS SPECIFIED');
  // }
}

/**
 * Builds the dependency graph of the application
 */
async function buildDependency () {
  
  for(let entry of entries) {
    let entryModule = _app.modules.find(m => { return m.path === entry; });
    if (!entryModule) {
      console.error(chalk.red(`NO_ENTRY_POINT:`, entry));
      process.exit(1);
    }
    entryModule.skipReduce = true;
    entryModule.isUsed = true;
    console.log(chalk.bold.yellow('> STARTING:'), entry)
    await readModule(entryModule);
  }
}

/**
 * @param {ModuleBuilder} modul
 */
async function readModule (modul) {
  
  try {
    /**
		 * Reducer part:
		 * it will skip reduction if:
		 *  - module was marked with "SkipReduce" flag
		 *  - or --skip-reduce flag was setup when script started
		 */
    if (!config.skipReduction && !modul.skipReduce) {
      if(!config.silent) console.log(chalk.bold('> REDUCING:'), modul.path);
      await reduceModule(modul);
      if(!config.silent) console.log('-- done');
    }

    /**
     * Analyzer part:
     */
    if(!config.silent) console.log(chalk.bold('> ANALYZING:'), modul.path);
    let result = await Analyzer.analyze(modul);
    if(!config.silent) console.log('-- done');
    if (config.verbose) console.log(result);
    
    for (let i of modul.descendents) {
      let descendent = _app.modules.find(m => { return m.path === i; });
      if (descendent) {
        if (!descendent.ancestors.includes(modul.path)) descendent.ancestors.push(modul.path);
        Array.prototype.push.apply(descendent.used, modul.used);
        descendent.isUsed = true;
        if (modul.skipReduce) descendent.skipReduce = true;
        await readModule(descendent);
      }
    }

    /**
     * Invokes readModule for module's child
     * only if child's usage has changed
     */
    let changed = false;
    for (let cindex in modul.children) {
      // let child = _app.modules.find(m => { return m.path === cindex; });
      let child = modul.children[cindex].ref;
      if (!child) continue;
      // if (modul.dynamicUsage) child.skipReduce = true; // why I wrote this line?
      if (modul.dynamicChildren.includes(cindex)) {
        child.skipReduce = true;
      }

      child.isUsed = true;
      for (let e of modul.children[cindex].used) {
        if (!child.used.includes(e)) {
          child.used.push(e);
          changed = true;
        }
      }
      if (changed) { // calling readModule only if child was updated
        if (argv.verbose) console.log(chalk.cyan('READMODULE:'), child.path, child.used);
        await readModule(child);
        changed = false;
      }
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Traverses given directory and create ModuleBuilder object for each .js file
 * @returns {Boolean}
 * @param {String} directory
 */
async function traverse (directory) {
  try {
    var folderContent = fs.readdirSync(directory);
    for (let item of folderContent) {
      item = path.join(directory, item);
      let stat = fs.statSync(item);
      if (stat.isDirectory()) {
        await traverse(item);
      } else if (stat.isFile()) {
        let extension = path.extname(item).toLowerCase();
        if (extension === '.js' || extension === '') {
          var _module = new ModuleBuilder();
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
            // scoped packages packagename
            if (_module.packagename.startsWith('@')) {
              _module.packagename += '/' + arr[lIndex+2];
            }
          }
          _module.initialSrc = fs.readFileSync(`${_module.path}`, utf);
          await moduleStat(_module);
          
          // let exprt = utils.loader(_module.path);
          // if (exprt) _module.members = utils.flattenObjectKeys(exprt);
  
          _app.modules.push(_module);
        }
      } 
    }
  } catch (err) {
    throw new Error(err);
  }
  return true;
}

/**
 * Generate a general statistic for the module
 * @param {ModuleBuilder} modul
 */
async function moduleStat (modul) {
  try {
    if (modul.initialSrc.startsWith('#!')) {
      modul.hashbang = modul.initialSrc.split('\n', 1)[0]; // saves the hashbang value
      modul.initialSrc = modul.initialSrc.replace(/^#!(.*\n)/, ''); // removes hashbang value
    }
    // modul.initialSrc = modul.initialSrc.replace(/\.\.\./g, '_mininode_'); // breaks the test


    let ast = es.parseScript(modul.initialSrc, {range: true, tokens: true, comment: true});
    modul.ast = ast;

    //calculating the SLOC
    let gen = escodegen.generate(modul.ast);
    modul.initialSloc = sloc(gen, 'js').source;
    modul.finalSloc = modul.initialSloc;
  } catch (ex) {
    if (config.verbose) console.warn(chalk.bold.yellow('WARN:'), modul.path, ex.message);
    modul.parseError = true;
  } finally {
    modul.initialSrc = null;
  }
  try {
    if(!config.skipStat && !modul.parseError) {
      await stat(modul);
    }    
  } catch (error) {
    throw new Error(`STAT FAILED: ${modul.path} ${error.message}`);
  }

  
  return modul;
}

/**
 * Executes Reducer.reduce function on a provided module
 * @param {ModuleBuilder} modul 
 */
async function reduceModule(modul, extra = null) {
  let additional = [];

  if (extra && extra.length > 0) {
    Array.prototype.push.apply(additional, extra);
  }

  for (let i of modul.descendents) {
    let descendent = _app.modules.find(m => { return m.path === i; });
    if (descendent) Array.prototype.push.apply(additional, descendent.selfUsed); 
  }

  for (let i of modul.ancestors) {
    let ancestor = _app.modules.find(m => { return m.path === i; });
    Array.prototype.push.apply(additional, ancestor.selfUsed);
  }

  
  await Reducer.reduce(modul, additional);
}

