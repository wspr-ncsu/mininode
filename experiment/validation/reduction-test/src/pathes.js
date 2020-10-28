const path = require('path');
module.exports.main = {
  ORIGINAL: '/mn-packages',
  ARCHIVES: '/mn-archives',
  ARCHIVES_PROD: '/mn-archives-prod',
  MININODE: '/mn',
  PRODONLY: '/mn-tests',
  REDUCED: '/mn-todos',
  LINTERS: '/linters'
}

module.exports.generator = function(name) {
  return {
    original: path.join(exports.main.ORIGINAL, name),
    prodonly: path.join(exports.main.PRODONLY, name),
    archived: path.join(exports.main.ARCHIVES, name),
    reduced: path.join(exports.main.REDUCED, name),
    coverage: path.join(exports.main.REDUCED, name, 'coverage', 'coverage.json'),
    coverageSummary: path.join(exports.main.REDUCED, name, 'coverage', 'coverage-summary.json'),
    archivedProd: path.join(exports.main.ARCHIVES_PROD, name)
  }
}