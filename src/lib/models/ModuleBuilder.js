const AppBuilder = require('./AppBuilder');
const IdentifierTable = require('./IdentifierTable');

module.exports = function () {
  this.name = '';
  this.path = '';
  this.packagename = ''; // retrieve from package.json or module path?
  this.packageversion = ''; // retrieve from package.json
  this.attackSurface = 0;
  this.attackVectors = []; // object: {value:"fs", members:[]}

  this.initialSrc = '';
  this.initialSloc = 0;
  this.ast = null;

  // reduction stats
  this.finalSrc = '';
  this.finalSloc = 0;
  this.removedFunctions = 0;
  this.removedVariables = 0;
  this.removedExports = 0;

  this.isUsed = false;
  this.isDynamicallyUsed = false;
  this.isOwned = false;
  this.isRemoved = false;
  this.skipReduce = false;

  // Module statistics
  this.eval = 0;
  this.evalWithVariable = 0;
  this.functionNew = 0;
  this.definesGlobal = 0;

  this.staticRequire = 0;
  this.dynamicRequire = 0;
  this.complexDynamicRequire = 0;
  this.dynamicUsage = 0;
  
  this.staticExport = 0;
  this.dynamicExport = 0;
  this.dynamicExportUsage = 0;

  this.variables = 0;
  this.functions = 0;

  this.regex = 0;
  this.regexDos = 0;
  this.stringReplace = 0;
  this.stringMatch = 0;
  this.stringSearch = 0;
  this.jsonParse = 0;
  this.monkeyPatching = 0;
  /**
   * METADATA
   */
  /** @type {AppBuilder} */
  this.app = null;
  this.parseError = false;
  this.hashbang = null;

  this.used = []; // members that were used by another modules.
  this.selfUsed = []; // members that were used by module itself. For ex: exports.save()
  this.members = []; // exported members to the outside
  this.children = {}; // object. { "path/to/child.js": { ref: module, used: [] } }
  this.dynamicChildren = [];
  this.ancestors = []; // stores all parents of the module
  this.descendents = []; // stores all of the module
  this.requires = []; // stores the name of require functions. Example: var r = require;
  this.exporters = []; // stores the name of exporters. Example: var es = exports;
  this.memusages = {}; // member expression usages that are not declared. For example: console.log(), foo.a() (if foo is global)
  this.identifiers = new IdentifierTable() // {"identifier": { complex: true|false, values: [literals only], links: [literals only]} }
};
