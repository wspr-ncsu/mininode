
const path = require('path');

module.exports.main = {
  PACKAGES: '/packages',
  ARCHIVES: '/archives',
  MININODE: '/mn'
}


module.exports.generator = function(name) {
  return {
    package: path.join(exports.main.PACKAGES, name),
    archive: path.join(exports.main.ARCHIVES, name),
    hard: 'mininode-hard.json',
    soft: 'mininode-soft.json'
  }
}