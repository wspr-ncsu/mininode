const path = require("path");

// normal (CORRECT!!!) usage of CommonJS exports and imports
try {
  const normal = require("normal");
  normal.x();
  normal.z();
} catch (error) {
  console.log("normal.js failed", error);
}

// challenge #7: cross-reference
try {
  const crossref = require("crossref");
  crossref.use; //todo: is not working. Because I am not skipping unused exports.
} catch (error) {
  console.log("crossref failed", error);
}

// challenge #9: dynamic export
try {
  const dynamicExport = require("dynamic-export");
  dynamicExport.a();
  dynamicExport.c();
} catch (error) {
  console.error("dynamic-export failed", error);
}

// challenge #5: dynamic import
try {
  const dynamicImport = require("dynamic-import");
  dynamicImport.a();
} catch (error) {
  console.error("dynamic-import failed", error);
}

// challenge #2: dynamic module
try {
  const dynamicModule = require("dynamic-module");
  dynamicModule.a(); //todo: need to delete foo._b
} catch (error) {
  console.error("dynamic-module failed", error);
}

// challenge #3: invisible-child-parent
try {
  const invisibleChildParent = require("invisible-child-parent");
  invisibleChildParent.used();
} catch (error) {
  console.error("invisible-child-parent", error);
}

// challenge #4: monkey patching
try {
  const monkeyPatching = require("monkey-patching");
  monkeyPatching.used;
} catch (error) {
  console.error("monkey-patching failed", error);
}

// challenge #
try {
  const protoExport = require("proto-export");
  protoExport.a();
  protoExport.b();
  protoExport.d();
} catch (error) {
  console.error("proto-export failed", error);
}

// challenge #
try {
  const reExport = require("re-export");
  reExport.a;
  reExport.b;
  // checkReductionStatus('re-export', reExport);
} catch (error) {
  console.error("re-export", error);
}

// challenge #8: re-assigning export
try {
  // todo: implement
  const renameExport = require("rename-export");
  renameExport.a();
  renameExport.b();
  renameExport.c();
} catch (error) {
  console.error("rename-export failed", error);
}

// challenge #6: overwriting/renaming require
try {
  const renameRequire = require("rename-require");
  renameRequire.used();
} catch (error) {
  console.error("rename-require failed", error);
}

// challenge #: dynamic usage of module
// fix: it is reducing dynamically used module
try {
  const dynamicModuleUsage = require("dynamic-module-usage");
  dynamicModuleUsage.a();
} catch (error) {
  console.error("dynamic-module-usage failed", error);
}

// challenge #: object-def-export
try {
  const objectDefExport = require("object-def-export");
  objectDefExport.a();
  objectDefExport.b();
  // checkReductionStatus('object-def-export', objectDefExport);
} catch (error) {
  console.log("object-def-export failed", error);
}

try {
  const globalModule = require("global-module");
  globalModule.use();
} catch (error) {
  console.log("global-module failed", error);
}

try {
  const functionExport = require("function-export");
  const fe = new functionExport();
  fe.a();
  fe.b();
} catch (error) {
  console.log("function-export failed", error);
}
