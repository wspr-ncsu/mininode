const chalk = require('chalk');
const fs = require('fs');
const config = require('../Configurator');
const path = require('path');
const glob = require('glob');
const AppBuilder = require('../models/AppBuilder');
const ModuleBuilder = require('../models/ModuleBuilder');
const nativeModules = require('./native-modules.js');


/**
 * Precalculates application stat
 * @param {AppBuilder} app 
 */
function calculateAppStatistic(app) {
  for (const modul of app.modules) {
   
    app.totalStaticExports += modul.staticExport;
    app.totalDynamicExports += modul.dynamicExport;

    app.totalStaticRequire += modul.staticRequire;
    app.totalDynamicRequire += modul.dynamicRequire;
    app.totalComplexDynamicRequire += modul.complexDynamicRequire;
    app.totalDynamicUsage += modul.dynamicUsage;
    
    app.totalFunctions += modul.functions;
    app.totalVariables += modul.variables;

    app.totalEval += modul.eval;
    app.totalEvalWithVar += modul.evalWithVariable;
    app.totalFunctionNew += modul.functionNew;

    app.totalRegex += modul.regex;
    app.totalRegexDos += modul.regexDos;
    app.totalStringReplace += modul.stringReplace;
    app.totalStringMatch += modul.stringMatch;
    app.totalStringSearch += modul.stringSearch;
    app.totalJsonParse += modul.jsonParse;
    app.totalMonkeyPatching += modul.monkeyPatching;
    if (modul.isOwned) {
      app.originalFilesLOC += modul.initialSloc;
      app.originalFiles += 1;
    } else {
      app.externalFiles += 1;
      app.externalFilesLOC += modul.initialSloc;
      if (modul.isUsed) {
        app.usedExternalFiles += 1;
        app.usedExternalFilesLOC += modul.initialSloc;
        app.usedExternalReducedFilesLOC += modul.finalSloc;
      }
    }

    if (modul.isRemoved) {
      app.totalRemovedFiles += 1;
      app.totalRemovedExports += (modul.staticExport + modul.dynamicExport);
      app.totalRemovedLOC += modul.initialSloc;
      // todo: calculate removed functions
      app.totalRemovedFunctions += modul.functions;
      // todo: calculate removed variables
      app.totalRemovedVariables += modul.variables;
    } else {
      app.totalRemovedLOC += (modul.initialSloc - modul.finalSloc);
      app.totalRemovedVariables += modul.removedVariables;
      app.totalRemovedFunctions += modul.removedFunctions;
      app.totalRemovedExports += modul.removedExports;
    }
    
    // constructs the builtins field by traversing modules children before minimizing the module
    for (let mod of Object.keys(modul.children)) {
      if (nativeModules.includes(mod)) {
        if (mod in app.builtins) {
          Array.prototype.push.apply(app.builtins[mod], modul.children[mod].used);
        } else {
          app.builtins[mod] = modul.children[mod].used;
        }
        
      }
    }
    minimizeModule(modul);
  }

  // removes duplicate entries from array.
  for (let mod of Object.keys(app.builtins)) {
    app.builtins[mod] = [...new Set(app.builtins[mod])];
  }
}

/**
 * Minimizes module object by removing extra properties
 * @param {ModuleBuilder} modul 
 */
function minimizeModule(modul) {
  delete modul.app;
  delete modul.ast;
  delete modul.initialSrc;
  
  if (config.compressLog) {
    delete modul.memusages;
    delete modul.identifiers;
    delete modul.children;
    for (let key of Object.keys(modul)) {
      if (!modul[key]) delete modul[key];
      if (Array.isArray(modul[key]) && modul[key].length === 0) delete modul[key];
    }
  } else {
    for (const key in modul.children) {
      delete modul.children[key].ref;
    }
    for (const key of Object.keys(modul.identifiers.table)) {
      modul.identifiers.table[key].changeToArray();
    }
  }
}

/**
 * Marks module as removed and removes corresponding js file
 * @param {ModuleBuilder} modul 
 */
async function removeFile(modul, dryRun = false) {
  
  try {
    // remove only if it was analyzed.
    if (!modul.parseError) {
      // TODO: .bin, do we need this?
      if (!(modul.path.includes('/.bin/') || modul.path.includes('/bin/'))) {
        modul.isRemoved = true;
        console.debug(`[utils.js] Deleting a file from the disk "${modul.path}"`);
        if (!dryRun) fs.unlinkSync(modul.path);
      }
    }
    
  } catch (error) {
    throw new Error('CAN_NOT_REMOVE: ' + modul.path + '\n' + error.message);
  }
}
/**
 * @returns {Array<String>}
 * @param {AppBuilder} app 
 */
function entryPoints(app) {
  let entries = [];
  if (config.seeds.length > 0) {
    for (let seed of config.seeds) {
      let files = glob.sync(seed, {cwd:app.path, absolute:true, nonull: false});
      for (let file of files) {
        if (fs.lstatSync(file).isDirectory()) {
          let jses = fs.readdirSync(file).filter(f => f.endsWith('.js')).map(e => path.join(file, e));
          for (let js of jses) {
            entries.push(js);
          }  
        } else if (file.endsWith('.js')) {
          entries.push(file);
        }
      }
    }
  } 
  if (app.main && config.seeds.length === 0) {
    let uri = path.join(app.path, app.main);
    if (fs.existsSync(uri)) {
      if (fs.lstatSync(uri).isDirectory()) {
        app.main = path.join(app.main, 'index.js');
      } else if (!app.main.endsWith('.js')) {
        app.main = app.main + '.js';
      }
      uri = path.join(app.path, app.main);
      if (fs.existsSync(uri)) entries.push(uri);
      else app.main = '-- not exists --';
    }
  } else {
    app.main = '-- undefined --';
  }

  return entries;
}

function hasKey(object, key) {
  return Object.prototype.hasOwnProperty.call(object, key);
}

module.exports.flattenObjectKeys = require('./flatten-object-keys');
module.exports.loader = require('./loader');
module.exports.calculateAppStatictic = calculateAppStatistic;
module.exports.removeFile = removeFile;
module.exports.entryPoints = entryPoints;
module.exports.hasKey = hasKey;
module.exports.BinaryExpression = require('./binary-expression-utils');
module.exports.entryPoint = require('./entry-point');