/**
 * @file This files checks how well MININODE reduced unused code parts.
 * @author Igibek Koishybayev
 */
console.log('===================================');
console.log('STARTED CHECKING REDUCTION EFFIENCY');
console.log('===================================');

[
  'crossref',
  'dynamic-export',
  'dynamic-import',
  'dynamic-module',
  'dynamic-module-usage',
  'function-export',
  'global-module',
  'invisible-child-parent',
  'monkey-patching',
  'object-def-export',
  'proto-export',
  're-export',
  'rename-export',
  'rename-require',
  'normal'
].forEach(name => {
  let mod = require(name);
  checkReductionStatus(name, mod);
})

function checkReductionStatus(name, obj) {
  for (let key in obj) {
    if (key.startsWith('_')) {
      console.log('NOT REDUCED>', name, key);
    }
  }
}
