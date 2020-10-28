const path = require('path')
const fs = require('fs');
const utils = require('.');
let glocation;
let table = {};

function main(location, dev = false) {
  glocation = location;
  table = {};
  if (!fs.existsSync(`${location}/package.json`)) {
    throw new Error(`NO_PACKAGE.JSON`);
  }
  
  let content = fs.readFileSync(`${location}/package.json`, {encoding: 'utf8'});
  let pckg = JSON.parse(content);
  let seed = null;
  if (dev) {
    seed = pckg.devDependencies;
  } else {
    seed = pckg.dependencies;
  }
  if (!seed) {
    return false;
  }

  let result = {}
  for (let key in seed) {
    result[key] = dependencyBuilder(location, key);
  }

  return result;
}

function toList(location, dev = false) {
  let dependencies = main(location, dev);
  let result = utils.flattenObjectKeys(dependencies);
  return [...new Set(result)];
}
function dependencyBuilder(loc, name) {
  if (glocation.length > loc.length) return null;
  let l = `${loc}/node_modules/${name}`;
  while(!fs.existsSync(l)) {
    loc = path.dirname(loc);
    if (loc.length < glocation.length) return null;
    l = `${loc}/node_modules/${name}`;
  }

  if (fs.existsSync(`${l}/package.json`)) {
    let result = {};
    let content = fs.readFileSync(`${l}/package.json`, {encoding: 'utf8'});
    let package = JSON.parse(content);
    if (!package.dependencies || Object.keys(package.dependencies).length === 0) return null;
    for (let key in package.dependencies) {
      if (table[l+key]) {
        result[key] = JSON.parse(JSON.stringify(table[l+key]));
      } else {
        let depen = dependencyBuilder(l, key);
        result[key] = depen;
        table[l+key] = depen;
      }
    }
    return result;
  } else {
    return null;
  }
}

function installedPackages(package, obj, includeDev = false) {
  if (!package) return null;

  for(let p in package.dependencies) {
    if (!package.dependencies[p].dev || includeDev) {
      if(!Object.prototype.hasOwnProperty.call(obj, p)) {
        obj[p] = [package.dependencies[p].version];
      } else if (!obj[p].includes(package.dependencies[p].version)){
        obj[p].push(package.dependencies[p].version);
      }
      installedPackages(package.dependencies[p], obj);
    }
    
  }
}

module.exports = main;
module.exports.toList = toList;
module.exports.installedPackages = installedPackages;