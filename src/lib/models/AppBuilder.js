const ModuleBuilder = require('./ModuleBuilder');
module.exports = function () {
  this.appname = '';
  this.version = '';
  this.type = '';
  this.path = '';
  this.main = '';
  this.testsDirectory = null;

  this.attackSurface = 0;
  this.externalAttackSurface = 0;
  this.usedDynamicImport = false;
  this.usedComplicatedDynamicImport = false;
  // measurement stats
  this.originalFiles = 0;
  this.externalFiles = 0;
  this.usedExternalFiles = 0;

  this.originalFilesLOC = 0;
  this.externalFilesLOC = 0;
  this.usedExternalFilesLOC = 0;
  this.usedExternalReducedFilesLOC = 0;

  this.declaredDependencyCount = 0;
  this.installedUniqueDependencyCount = 0;
  this.installedTotalDependencyCount = 0;
  
  this.totalStaticExports = 0;
  this.totalDynamicExports = 0;
  
  this.totalStaticRequire = 0;
  this.totalDynamicRequire = 0;
  this.totalComplexDynamicRequire = 0;
  this.totalDynamicUsage = 0;

  this.totalFunctions = 0;
  this.totalVariables = 0;
  
  this.totalEval = 0;
  this.totalEvalWithVar = 0;
  this.totalFunctionNew = 0;
  this.totalMonkeyPatching = 0;

  // ReDOS attack related fields
  this.totalRegex = 0;
  this.totalRegexDos = 0;
  this.totalStringReplace = 0;
  this.totalStringMatch = 0;
  this.totalStringSearch = 0;
  this.totalJsonParse = 0;

  // reduction stats
  this.totalRemovedVariables = 0;
  this.totalRemovedFunctions = 0;
  this.totalRemovedExports = 0;
  this.totalRemovedFiles = 0;
  this.totalRemovedLOC = 0;

  this.globals = []; // all global variables that Application has. Ex: {name: 'foo', path: 'lib/foo.js', members: []}
  this.dimports = []; // all modules that dynamically imported. Ex: {name: 'foo', members: [], by: ''}. DIMPORTS has higher precedence than GLOBALS
  /** @type {ModuleBuilder} */
  this.modules = [];// all modules that Application has, i.e. all js files inside every package. Ex: express/lib/express.js, mocha/index.js
  
  this.dependencies = {};// all packages Application has. Ex: express, mocha, lodash. {parent: "", name:"", version:""}

  this.builtins = {}; // all native modules that were used inside the application.
};
