const jfs = require('jsonfile');
const fs  = require('fs');
const path = require('path');

module.exports = function entryPoint(location, seed = null) {
  let pckg, main;
  main = seed;
  if (seed === null) {
    pckg = jfs.readFileSync(path.join(location,'package.json'));
    main = pckg.main;
  }
  
  if (!main) main = 'index.js';
  let url = path.join(location, main);
  if (fs.existsSync(url)) {
    if (fs.lstatSync(url).isDirectory()) {
      main = path.join(main, 'index.js');
      url = path.join(location, main);
      if (fs.existsSync(url)) {
        return main;
      }
    } else {
      return main;
    }
  } else if (!main.endsWith('.js')) {
    main  += '.js';
    url = path.join(location, main);
    if (fs.existsSync(url)) {
      return main;
    }
  }

  return null;
}