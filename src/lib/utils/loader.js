const vm = require('vm');
const m = require('module');

/** @param {String} path */
function load(path, useVM = true) {
  if (!useVM) {
    let mod = null;
    try {
      mod = require(path);
    } catch (ex) {
      console.log('failed loading', path);
    }
    return mod;
  } else {
    let code = m.wrap(`module.exports = require('${path}')`);
    vm.runInThisContext(code)(exports, require, module, __filename, __dirname)
    return module.exports;
  }
}

module.exports = load;