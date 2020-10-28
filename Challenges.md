### 1. Binary dependency detection
The binary file can't be used as a CommonJS module because it has a shebang (`#! /usr/bin/env node`) at the top, which is an invalid syntax for JavaScript. That is why they are not considered when building a dependency tree of the application. The application fails when it tries to run test binary such as `mocha` because Mininode removed required dependencies.
- Issue: #65 
- Commit: _still working on automatic_

**Solution**: The idea behind the solution is to install devDependencies as global packages. In this way `mocha` or other executable JS files required for testing will not fail because Mininode will not reduce it. Additionally, because of executable JS files cannot be used as a required module we can remove them from node_modules folder _"safely"_. However, if executable JS files are called indirectly from modules using `child_processes`, our solution will break the application. 

### 2. Dynamic manipulation of the required module
Dynamic manipulation happens when the required module is passed to some *dynamic* function. The dynamic function is a function which is not defined inside the requested module. 
```JavaScript
var utils = require('utils');
foo(utils); // we don't know what will happen inside foo function.
```

### 3. Invisible child-parent exporting
Example: debug module.
### 4. Monkey-patching / Extending the required module
Example:
```JavaScript
// in malware.js
var express = require(express'');
express.get = function() {
  // rewrite original get to any functionality
}
```
### 5. Dynamically importing modules
When require is passed a variable. 
```JavaScript
var a = null;
if (b === 0)
  a = 'bar'
else
  a = 'foo'
const c = require(a)
```

### 6. Overwriting/renaming the require function

### 7. Cross-reference dependencies
```JavaScript
// in index.js
var foo = require('foo'), bar = require('bar');
foo.x()
bar.a()
// in foo.js
var bar = require('bar');
exports.x = function(){}
exports.y = function(){}
// in bar.js
var foo = require('foo')
exports.a = function() {}
exports.b = function() {
  foo.y()
}
```
### 8. Re-assigning exports (module.exports) to another variable.
Example:
```JavaScript
var es = exports, flatmap = require('flatmap-stream');
es.flatmap = flatmap;
```
### 9. Dynamically exporting functionality from module
There may be diffirent ways to dynamically export the functionality.
Example:
```JavaScript
var member = 'foo';
exports[member];
```
### 10. Requiring module globally
Example:
```JavaScript
// inside a.js
let foo = require('foo');
bar = require('bar'); // globally requiring
globalFoo = foo; // global variable
// inside b.js
bar.a(); // should detect this.
globalFoo.b() // should detect this
```

### 11. Exporting using Object.defineProperty