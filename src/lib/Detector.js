/**
 * @author Igibek Koishybayev
 * @abstract Detects all used modules by traversing the require value. If require's argument is not literal,
 * marks the application as usedDynamicImport
 */
const path = require('path');
const resolveFrom = require('resolve-from');
const esprima = require('esprima');
const syntax = esprima.Syntax;
const utils = require('./utils');
const flatten = require('./utils/flatten-object-keys');
const estraverse = require('estraverse');
const AppBuilder = require('./models/AppBuilder');
const ModuleBuilder = require('./models/ModuleBuilder');


/** @type {AppBuilder} */
let _app = null;
let visited = [];

/**
 * @param {ModuleBuilder} modul 
 */
async function run(modul) {
  
  if (modul.parseError === true) {
    console.error(`[Detector.js] module ${modul.path} parsed with error. Returting without traversing`);
    return;
  }
  let rsv = resolveFrom.silent.bind(null, path.dirname(modul.path));
  console.debug(`[Detector.js] Traversing the AST of ${modul.path}`);
  estraverse.traverse(modul.ast, {
    enter: function(node, parent) {
      switch(node.type) {
        case syntax.CallExpression:
          if (node.callee.name === 'require' || modul.requires.includes(node.callee.name)) {
            if (node.arguments.length >= 1) {
              let arg = node.arguments[0];
              if (arg.type === syntax.Literal) {
                let uri = rsv(arg.value);
                if (uri && !utils.hasKey(modul.children, uri)) {
                  modul.children[uri] = {ref: null, used: []};
                  if (utils.hasKey(node, 'xModule')) {
                    node['xModule'].push(uri);
                  } else {
                    node['xModule'] = [uri];
                  }
                }
              } else if (arg.type === syntax.Identifier) {
                _app.usedDynamicImport = true;
                // identifiers are calculated during stat phase
                if (modul.identifiers.hasIdentifier(arg.name) && !modul.identifiers.isComplex(arg.name)) {
                  let values = modul.identifiers.getValues(arg.name);
                  for (let v of values) {
                    let uri = rsv(v);
                    if (uri && !utils.hasKey(modul.children, uri)) {
                      modul.children[uri] = {ref: null, used: []};
                      if (utils.hasKey(node, 'xModule')) {
                        node['xModule'].push(uri);
                      } else {
                        node['xModule'] = [uri];
                      }
                    }
                  }
                } else {
                  _app.usedComplicatedDynamicImport = true;
                }
              } else {
                _app.usedDynamicImport = true;
                _app.usedComplicatedDynamicImport = true;
              }
            }
          }
        break;
      }
    }
  });
}

/**
 * 
 * @param {ModuleBuilder} modul 
 */
async function readModule(modul) {
  if (!visited.includes(modul.path)) {
    console.info(`[Detector.js] reading the module ${modul.path}`);
    modul.isUsed = true;
    await run(modul);
    visited.push(modul.path);
    for (const key in modul.children) {
      if (!modul.children[key].ref) {
        let child = _app.modules.find(m => m.path === key);
        if (child) {
          modul.children[key].ref = child;
          await readModule(modul.children[key].ref);
        }
      }    
    }
  }
}

/**
 * 
 * @param {AppBuilder} app 
 */
async function main (app, entries = []) {
  _app = app;
  for (let entryPath of entries) {
    let entry = app.modules.find(m => m.path === entryPath);
    if (!entry) throw new Error('[Detector.js] NO_ENTRY_POINT');
    await readModule(entry);
  }
}

module.exports = main;