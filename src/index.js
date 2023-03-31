#! /usr/bin/env node
const fs = require("fs");
const es = require("espree");
const escodegen = require("escodegen");
const path = require("path");
const chalk = require("chalk");
const sloc = require("sloc");
const AppBuilder = require("./lib/models/AppBuilder");
const ModuleBuilder = require("./lib/models/ModuleBuilder");
const generator = require("./lib/Generator");
const Analyzer = require("./lib/Analyzer");
const Reducer = require("./lib/Reducer");
const Detector = require("./lib/Detector");
const config = require("./lib/Configurator");
const stat = require("./lib/Stat");
const utils = require("./lib/utils");
const packageDependencies = require("./lib/utils/package-dependencies");
const createLogger = require("./lib/Logger");

let logger = createLogger();
if (config.silent) {
  logger = createLogger("error");
} else if (config.verbose) {
  logger = createLogger("debug");
}

let location = config.origin;

let utf = "utf-8";
location = path.resolve(location);
if (location.indexOf("package.json") !== -1) {
  location = path.dirname(location);
}

let _app = new AppBuilder();
let entries = [];

(async function () {
  console.time("overall");
  try {
    console.info(`Starting with app at ${location}`);
    await init();

    console.info("[index.js] Started Traversing");
    await traverseGenerateModule(location, _app.type);
    console.info("[index.js] Finished Traversing");

    console.info("[index.js] Started Detector");
    await Detector(_app, entries);
    console.info("[index.js] Finished Detector");

    if (_app.usedComplicatedDynamicImport) {
      throw new Error("DYNAMIC_IMPORT_DETECTED");
    }

    if (config.mode === "fine") {
      console.info("[index.js] Started building dependency graph");
      await buildDependency();
      console.info("[index.js] Finished building dependency graph");
      console.info("[index.js] Started final reduction");
      // 1. iterate modules' memusage
      // 2. map results to app.globals by name
      // 3. add to individual modules used globals.
      for (let modul of _app.modules) {
        for (let mem in modul.memusages) {
          _app.globals.forEach((globalVar) => {
            if (globalVar.name === mem) {
              for (let m of modul.memusages[mem]) {
                globalVar.members.push(m);
              }
            }
          });
        }
      }

      for (let modul of _app.modules) {
        for (let globalVar of _app.globals) {
          if (globalVar.path === modul.path) {
            for (let m of globalVar.members) {
              modul.used.push(m);
            }
          }
        }
      }

      let usedExternalModules = _app.modules.filter(
        (m) => m.isUsed && !m.skipReduce
      );
      for (let modul of usedExternalModules) {
        console.debug(`[index.js] Reducing the module "${modul.path}"`);
        await reduceModule(modul);
        console.debug(
          `[index.js] Finished reducing the module "${modul.path}"`
        );
      }
      console.info(`[index.js] Finished final reduction`);
    }

    if (!config.skipRemove) {
      console.info(`[index.js] Deleting unused modules(files)`);

      if (!_app.usedComplicatedDynamicImport) {
        let modulesToRemove = _app.modules.filter((m) => !m.isUsed);
        for (let modul of modulesToRemove) {
          await utils.removeFile(modul, config.dryRun);
        }
      } else if (config.mode === "fine") {
        // run reduction with dimports
        for (const dimport of _app.dimports) {
          console.debug(
            "[index.js] Reducing modules with dynamic imports",
            _app.dimports
          );
          let reducableModules = _app.modules.filter(
            (m) =>
              !m.skipReduce &&
              dimport.members.every((v) => m.members.includes(v))
          );
          for (let modul of reducableModules) {
            await reduceModule(modul, dimport.members);
          }
        }
      }
      console.info(`[index.js] Finished deleting unused modules(files)`);
    }

    console.info(`[index.js] Generating codes for modules`);
    let usedModules = _app.modules.filter((m) => !m.isRemoved && !m.skipReduce);
    for (var modul of usedModules) {
      if (!modul.parseError) {
        generator.generate(modul, config.dryRun);
      }
    }
    console.info(`[index.js] Finished generating codes for modules`);

    console.info(`[index.js] Calculating overall statistics`);
    utils.calculateAppStatictic(_app);
    console.info(`[index.js] Finished calculating overall statistics`);

    if (config.log) {
      console.info(
        `[index.js] Creating final statistics file "${config.logOutput}"`
      );
      let log_path = path.join(location, config.logOutput);
      fs.writeFileSync(log_path, JSON.stringify(_app, null, 2), {
        encoding: "utf-8",
      });
      console.info(
        `[index.js] Finished creating statistics file. Statistics are stored in "${log_path}"`
      );
    }
  } catch (err) {
    throw err;
  }
  console.timeEnd("overall");
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

// Initializes the initial state of the application.
async function init() {
  if (!config.dryRun) {
    generator(location, config.destination);
    location = path.resolve(config.destination);
  }
  if (!fs.existsSync(path.join(location, "package.json"))) {
    console.error("Couldn't find package.json");
    process.exit(1);
  }
  let content = fs.readFileSync(path.join(location, "package.json"), {
    encoding: utf,
  });
  let packageJson = JSON.parse(content);

  _app.appname = packageJson.name;
  _app.version = packageJson.version;
  _app.type = packageJson.type || "commonjs";
  _app.path = location;
  if (packageJson.exports) {
    for (var key in packageJson.exports) {
      // for now we do not consider difference among these multiple entrypoints
      _app.main.push(packageJson.exports[key]);
    }
  } else {
    _app.main.push(utils.entryPoint(location, packageJson.main));
  }

  // add more entry points from test scripts
  let testEntryPoints = getJSFilenamesInScriptsField(packageJson);
  if (testEntryPoints && testEntryPoints.length > 0) {
    //TODO-Hui: here do we need to find the path to these test entry points?
    //TODO-Hui: also, with these test entry points, perhaps we should not block test directories?
    testEntryPoints.forEach((entryP) => {
      if (!_app.main.includes(entryP)) {
        _app.main.push(entryP);
      }
    });
  }

  if (packageJson.hasOwnProperty("directories")) {
    if (packageJson.directories.hasOwnProperty("test")) {
      _app.directories = packageJson.directories.test;
    }
  }

  if (config.seeds.length === 0) {
    if (!_app.main) {
      throw new Error("NO_ENTRY_POINT");
    }
    _app.main.forEach((entryP) => {
      entries.push(path.join(_app.path, entryP));
    });
  } else {
    for (let seed of config.seeds) {
      let s = utils.entryPoint(location, seed);
      if (s) {
        entries.push(path.join(location, seed));
      } else {
        console.error(chalk.default.red(`Can not find ${seed} in ${location}`));
      }
    }
  }
  if (packageJson.dependencies) {
    _app.declaredDependencyCount = Object.keys(packageJson.dependencies).length;
    let packageLock = path.join(location, "package-lock.json");
    if (fs.existsSync(packageLock)) {
      content = fs.readFileSync(path.join(location, "package-lock.json"), {
        encoding: utf,
      });
      packageJson = JSON.parse(content);
      packageDependencies.installedPackages(packageJson, _app.dependencies);
      _app.installedUniqueDependencyCount = Object.keys(
        _app.dependencies
      ).length;
      for (let i in _app.dependencies) {
        _app.installedTotalDependencyCount += _app.dependencies[i].length;
      }
    }
  }
}

// Builds the dependency graph of the application
async function buildDependency() {
  console.info(`[index.js] Building the dependency graph of ${_app.appname}`);
  for (let entry of entries) {
    let entryModule = _app.modules.find((m) => {
      return m.path === entry;
    });
    if (!entryModule) {
      console.error(
        `[index.js] Critical error, can not find entry point module "${entry}". Exiting the process...`
      );
      process.exit(1);
    }
    entryModule.skipReduce = true;
    entryModule.isUsed = true;
    await readModule(entryModule);
  }
}

/**
 * @param {ModuleBuilder} modul
 */
async function readModule(modul) {
  try {
    /**
     * Reducer part:
     * it will skip reduction if:
     *  - module was marked with "SkipReduce" flag
     *  - or --skip-reduce flag was setup when script started
     */
    if (!config.skipReduction && !modul.skipReduce) {
      await reduceModule(modul);
    }

    // Analyzer part
    console.info("[index.js] Started analysis of ", modul.path);
    let result = await Analyzer.analyze(modul);
    console.debug(`[index.js] Analysis of ${modul.path} returned ${result}`);
    console.info("[index.js] Finished analysis of", modul.path);

    for (let i of modul.descendents) {
      let descendent = _app.modules.find((m) => {
        return m.path === i;
      });
      if (descendent) {
        if (!descendent.ancestors.includes(modul.path))
          descendent.ancestors.push(modul.path);
        Array.prototype.push.apply(descendent.used, modul.used);
        descendent.isUsed = true;
        if (modul.skipReduce) descendent.skipReduce = true;
        await readModule(descendent);
      }
    }

    /**
     * Invokes readModule for module's child
     * only if child's usage has changed
     */
    let changed = false;
    for (let cindex in modul.children) {
      let child = modul.children[cindex].ref;
      if (!child) continue;
      if (modul.dynamicChildren.includes(cindex)) {
        child.skipReduce = true;
      }

      child.isUsed = true;
      for (let e of modul.children[cindex].used) {
        if (!child.used.includes(e)) {
          child.used.push(e);
          changed = true;
        }
      }
      if (changed) {
        // calling readModule only if child was updated
        console.debug(
          `[index.js] Changed the child of "${modul.path}" "${child.path}" is used "${child.used}"`
        );
        await readModule(child);
        changed = false;
      }
    }
  } catch (err) {
    throw err;
  }
}

/**
 * Traverses given directory and create ModuleBuilder object for each .js file
 * @returns {Boolean}
 * @param {String} directory
 * @param {String} packageJsonType  Type of package.json. Can be modified if there's a child package.json.
 */
async function traverseGenerateModule(directory, packageJsonType) {
  console.info(`[index.js] Traversing directory ${directory}`);
  try {
    var folderContent = fs.readdirSync(directory);

    // override type if there's a package.json in this directory
    if (fs.existsSync(path.join(directory, "package.json"))) {
      let content = fs.readFileSync(path.join(location, "package.json"), {
        encoding: utf,
      });
      let packageJson = JSON.parse(content);
      if (packageJson.hasOwnProperty("type")) {
        packageJsonType = packageJson.type;
      } else {
        packageJsonType = "commonjs";
      }
    }

    for (let item of folderContent) {
      // ignore list (configure for your use case)
      if (config.ignored.includes(item.toLowerCase())) continue;

      let itemPath = path.join(directory, item);
      let stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        await traverseGenerateModule(itemPath, packageJsonType);
      } else if (stat.isFile()) {
        let itemPathExtension = path.extname(itemPath).toLowerCase();

        if (isValidJavascriptFile(itemPath)) {
          var _module = new ModuleBuilder();
          _module.app = _app;
          _module.name = path.basename(itemPath);
          _module.path = itemPath;

          switch (packageJsonType) {
            case "commonjs":
              if ([".js", ".cjs", ""].includes(itemPathExtension)) {
                _module.type = "commonjs";
              } else if (itemPathExtension === ".mjs") {
                _module.type = "module";
              } else {
                _module.type = packageJsonType;
                console.warn(item + " :: File extention not supported");
              }
              break;
            case "module":
              if ([".js", ".mjs", ""].includes(itemPathExtension)) {
                _module.type = "module";
              } else if (itemPathExtension === ".cjs") {
                _module.type = "commonjs";
              } else {
                _module.type = packageJsonType;
                console.warn(item + " :: File extention not supported");
              }
              break;
            default:
              console.warn("Unsupported package.json type");
              break;
          }

          if (directory.indexOf("/node_modules", location.length - 1) === -1) {
            _module.isOwned = true;
            // should we add do not reduce here?
          } else {
            let arr = _module.path.split("/");
            let lastIndexNodeModules = arr.lastIndexOf("node_modules");
            _module.packagename = arr[lastIndexNodeModules + 1];
            // scoped packages packagename
            if (_module.packagename.startsWith("@")) {
              _module.packagename += "/" + arr[lastIndexNodeModules + 2];
            }
          }
          _module.initialSrc = fs.readFileSync(`${_module.path}`, utf);
          await generateModuleStatistics(_module);
          _app.modules.push(_module);
        }
      }
    }
  } catch (err) {
    console.error(
      `[index.js] Traversing directory ${directory} returned error ${err.message}`
    );
    throw new Error(err);
  }
  return true;
}

/**
 * Generate a general statistic for the module
 * @param {ModuleBuilder} modul
 */
async function generateModuleStatistics(modul) {
  try {
    if (modul.initialSrc.startsWith("#!")) {
      modul.hashbang = modul.initialSrc.split("\n", 1)[0]; // saves the hashbang value
      modul.initialSrc = modul.initialSrc.replace(/^#!(.*\n)/, ""); // removes hashbang value
    }
    let ast = es.parse(modul.initialSrc, {
      sourceType: modul.type || "commonjs",
      ecmaVersion: 14,
      range: true,
      comment: true,
      tokens: true,
    });
    modul.ast = ast;

    //calculating the SLOC
    let gen = escodegen.generate(modul.ast);
    modul.initialSloc = sloc(gen, "js").source;
    modul.finalSloc = modul.initialSloc;
  } catch (ex) {
    console.warn(
      `[index.js] Error occured while parsing "${modul.path}". Error message: ${ex.message}. Module type: ${modul.type}`
    );
    modul.parseError = true;
  } finally {
    modul.initialSrc = null;
  }

  try {
    if (!config.skipStat && !modul.parseError) {
      await stat(modul);
    }
  } catch (error) {
    console.error(
      `[index.js] Module ${modul.path} stat returned an error ${error.message}`
    );
    throw new Error(`STAT FAILED: ${modul.path} ${error.message}`);
  }

  return modul;
}

/**
 * Executes Reducer.reduce function on a provided module
 * @param {ModuleBuilder} modul
 */
async function reduceModule(modul, extra = null) {
  console.debug(`[index.js] reducing the module ${modul.path}`);
  let additional = [];

  if (extra && extra.length > 0) {
    Array.prototype.push.apply(additional, extra);
  }

  for (let i of modul.descendents) {
    let descendent = _app.modules.find((m) => {
      return m.path === i;
    });
    if (descendent) Array.prototype.push.apply(additional, descendent.selfUsed);
  }

  for (let i of modul.ancestors) {
    let ancestor = _app.modules.find((m) => {
      return m.path === i;
    });
    Array.prototype.push.apply(additional, ancestor.selfUsed);
  }

  await Reducer.reduce(modul, additional);
}

// Acceptable: .js, .cjs, .mjs files. Blank file extensions without the dot.
// Unacceptable: dot files without extension. Like .gitignore, .eslintrc
function isValidJavascriptFile(file) {
  let extension = path.extname(file).toLowerCase();
  if ([".js", ".cjs", ".mjs", ""].includes(extension) === false) {
    return false;
  }
  let fileSplitBySlash = file.split("/");
  if (
    extension === "" &&
    fileSplitBySlash[fileSplitBySlash.length - 1].startsWith(".")
  ) {
    return false;
  }
  return true;
}

// parse a field in Package.JSON to retrieve the names of valid JavaScript files
function getJSFilenamesInScriptsField(packageJson) {
  let result = [];
  if (packageJson.hasOwnProperty("scripts")) {
    let scripts = packageJson.scripts;
    for (let key in scripts) {
      let stringToDealWith = scripts[key];
      let words = stringToDealWith.split(" ");
      for (let wPotentialFile of words) {
        if (wPotentialFile.indexOf("*") > -1) {
          continue;
        }
        let splitWordArr = wPotentialFile.split(".");
        if (splitWordArr.length > 1) {
          if (
            ["js", "mjs", "cjs"].includes(splitWordArr[splitWordArr.length - 1])
          ) {
            result.push(wPotentialFile);
          }
        }
      }
    }
  }
  return result;
}
