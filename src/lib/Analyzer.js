/**
 * @author Igibek Koishybayev
 * @abstract Analyzes the AST of the module to detect
 *  - used/unused members of the required modules
 */
const estraverse = require("estraverse");
const syntax = require("espree").Syntax;
const chalk = require("chalk");
const config = require("./Configurator");
const helper = require("./utils/helpers");
const path = require("path");
const resolveFrom = require("resolve-from");
let ModuleBuilder = require("./models/ModuleBuilder");
let utils = require("./utils");
let resolve = null;

let variables = []; // all variables
let assignments = [],
  vars = [],
  leaks = [];
let trackids = []; // required modules variable identifiers
let callbacks = [];
let currentScope = -1;

async function init() {
  variables = [];
  assignments = [];
  vars = [];
  leaks = [];
  trackids = [];
  callbacks = [];
  currentScope = -1;
}
/**
 * @param {ModuleBuilder} modul
 * @returns {AnalyzeResult}
 */
module.exports.analyze = async function analyze(modul) {
  console.info(`[Analyzer.js] analyzing ${modul.path}`);
  await init();
  resolve = resolveFrom.silent.bind(null, path.dirname(modul.path));
  await traverse(modul);
  console.debug(`[Analyzer.js] ${modul.path} has scope variables ${vars}`);
  console.debug(
    `[Analyzer.js] ${modul.path} has scope assignments ${assignments}`
  );
  await checkForLeaks();
  console.debug(`[Analyzer.js] ${modul.path} global leaks ${leaks}`);
  variables.forEach((item, index) => {
    if (item.isModule && item.value) {
      if (utils.hasKey(modul.children, item.value)) {
        for (var member of item.members) {
          if (!modul.children[item.value].used.includes(member)) {
            modul.children[item.value].used.push(member);
          }
        }
      } else {
        modul.children[item.value] = {};
        modul.children[item.value].used = item.members.slice();
      }

      // marking dynamically used children
      if (item.isDynamic && !modul.dynamicChildren.includes(item.value)) {
        modul.dynamicChildren.push(item.value);
      }

      if (leaks.includes(item.name)) {
        console.debug(`[Analyzer.js] Global var "${item.name}"`);
        modul.app.globals.push({
          name: item.name,
          path: item.value,
          members: item.members.slice(),
        });
      }
    } else if (item.isModule && item.value === null) {
      console.debug(
        `[Analyzer.js] Dynamic import "${item.name}" inside "${modul.path}"`
      );
      let arr = modul.app.dimports.concat({
        name: item.name,
        members: item.members.filter((i) => i !== "."),
        by: modul.path,
      });
      modul.app.dimports = [...new Set(arr)];
    }
  });
};

/**
 * @param {ModuleBuilder} modul
 */
async function traverse(modul) {
  console.debug(`[Analyzer.js] traversing AST of ${modul.path}`);
  estraverse.traverse(modul.ast, {
    enter: function (node, parent) {
      node["xParent"] = parent;
      if (helper.createsNewScope(node)) {
        currentScope += 1;
        if (vars[currentScope] === undefined) {
          vars.push([[]]);
          assignments.push([[]]);
        } else {
          vars[currentScope].push([]);
          assignments[currentScope].push([]);
        }
      }
      if (node["xUsed"] === false) {
        // todo: implement skipping mechanisms
        // I need to skip unused function declarations
        // I need to skip unused exports initialized with function declarations
        if (
          node.type === syntax.FunctionDeclaration ||
          node.type === syntax.FunctionExpression
        ) {
          this.skip();
        } else if (
          node.type === syntax.MemberExpression &&
          parent.type === syntax.AssignmentExpression
        ) {
          if (
            parent.xParent.type !== syntax.AssignmentExpression &&
            parent.right.type === syntax.FunctionExpression
          ) {
            this.skip();
          }
        }
        // skip unused function in export declarations
        // FunctionDeclaration inside ExportNamedDeclaration or ExportDefaultDeclaration have already been handled above
        // TODO-Hui: check function declaration inside ExportAllDeclaration
      }

      switch (node.type) {
        case syntax.Identifier:
          if (
            parent &&
            (parent.type !== syntax.VariableDeclarator ||
              parent.type !== syntax.AssignmentExpression ||
              parent.type !== syntax.FunctionDeclaration)
          ) {
            let variable = getLatestVariable(variables, node.name, true);
            if (variable && !variable.members.includes("."))
              variable.members.push(".");
          }
          break;
        case syntax.VariableDeclarator:
          if (node.id.type === syntax.Identifier) {
            vars[currentScope][vars[currentScope].length - 1].push(
              node.id.name
            );
          }
          VariableDeclarator(node);
          break;
        case syntax.MemberExpression:
          // TODO-Hui: the following if-block is for commonjs AND export. We can use (modul.type === "commonjs") for this if-block, 
          // and add another else-if block for ES6 exports right before the current else block if needed
          // Question: do we need to exclude es6 imports and commonjs import()?
          if (node.object.type === syntax.Identifier) {
            // makes sure that this will be called only for top memberexpression
            let isComputed = helper.isComputed(node);
            if (
              modul.exporters.includes(node.object.name) ||
              node.object.name === "exports" ||
              (node.object.name === "module" &&
                node.property.name === "exports")
            ) {
              let memexp = helper.getMemberExpressionString(node);
              let full = memexp.object + "." + memexp.property;
              let prop = helper.getExportedProperty(full);
              if (!prop) prop = memexp.property;
              let assignment = helper.closestsNot(
                node,
                syntax.MemberExpression
              );
              if (assignment.type === syntax.AssignmentExpression) {
                // todo: detect if it is assigned or used by comparing left and right
                if (assignment.left.type === syntax.MemberExpression) {
                  //
                  let left = helper.getMemberExpressionString(assignment.left);
                  left = left.object + "." + left.property;
                  if (left === full) {
                    if (!modul.members.includes(prop)) modul.members.push(prop);
                    // detecting descendents
                    if (assignment.right.type === syntax.Identifier) {
                      if (trackids.includes(assignment.right.name)) {
                        let variable = getLatestVariable(
                          variables,
                          assignment.right.name
                        );
                        if (variable) modul.descendents.push(variable.value);
                      }
                    }
                    // todo: add detecting descendents in forms of memberexpression. Ex: var des = require('foo'); module.exports = des.another;
                  }
                }
                if (assignment.right.type === syntax.MemberExpression) {
                  let right = helper.getMemberExpressionString(
                    assignment.right
                  );
                  if (right) {
                    right = right.object + "." + right.property;
                    if (right === full) {
                      if (!modul.selfUsed.includes(prop)) {
                        modul.selfUsed.push(prop);
                        let propStart = getPropertyStart(prop);
                        if (propStart && !modul.selfUsed.includes(propStart))
                          modul.selfUsed.push(propStart);
                      }
                    }
                  }
                }
              } else {
                if (!modul.selfUsed.includes(prop)) {
                  modul.selfUsed.push(prop);
                  let propStart = getPropertyStart(prop);
                  if (propStart && !modul.selfUsed.includes(propStart))
                    modul.selfUsed.push(propStart);
                }
              }
            } else {
              let item = callbacks
                .filter((item, index) => {
                  return (
                    item.name === node.object.name && item.scope <= currentScope
                  );
                })
                .sort(sortByScope)
                .pop();
              let variable = null;
              let propertyName = helper.getPropertyName(node);
              if (item) {
                variable = getLatestVariable(variables, item.value);
                if (variable) {
                  variable.members.push(propertyName);
                  let propStart = getPropertyStart(propertyName);
                  if (propStart && !variable.members.includes(propStart))
                    variable.members.push(propStart);
                }
              } else if (trackids.includes(node.object.name)) {
                variable = getLatestVariable(variables, node.object.name);
                if (variable) {
                  variable.members.push(propertyName);
                  let propStart = getPropertyStart(propertyName);
                  if (propStart && !variable.members.includes(propStart))
                    variable.members.push(propStart);
                }
              } else if (
                !isDeclaredInCurrentScope(node.object.name) &&
                node.object.name !== "constructor"
              ) {
                let objname = node.object.name;
                if (utils.hasKey(modul.memusages, objname)) {
                  if (!modul.memusages[objname].includes(propertyName)) {
                    modul.memusages[objname].push(propertyName);
                  }
                } else {
                  modul.memusages[objname] = [propertyName];
                }
              }
              if (variable && isComputed) variable.isDynamic = true;
            }
          }
          break;
        case syntax.CallExpression:
          if (
            (modul.requires.includes(node.callee.name) ||
              node.callee.name === "require") &&
            node.arguments.length === 1
          ) {
            let importPath = null;
            if (node.arguments[0].type === syntax.Literal) {
              importPath = resolve(node.arguments[0].value);
            } else if (node.arguments[0].type === syntax.Identifier) {
              if (utils.hasKey(node, "xModule")) {
                console.log(node["xModule"]);
                importPath = node["xModule"][0];
              }
            }

            let assignment = helper.closests(node, syntax.AssignmentExpression);
            if (assignment) {
              if (assignment.left.type === syntax.MemberExpression) {
                let memexp = helper.getMemberExpressionString(assignment.left);
                // chaining detection
                if (
                  memexp &&
                  (memexp.object === "module" ||
                    memexp.object === "exports" ||
                    modul.exporters.includes(memexp.object))
                ) {
                  if (!config.silent)
                    console.log(
                      chalk.bold.magenta(`-- CHAINING`),
                      memexp,
                      importPath
                    );
                  if (!modul.descendents.includes(importPath)) {
                    modul.descendents.push(importPath);
                  }
                  if (parent && parent.type === syntax.MemberExpression) {
                    let propertyName = helper.getPropertyName(parent);
                    if (propertyName) {
                      let variable = new VariableBuilder(
                        propertyName,
                        importPath,
                        true
                      ); // why name is propertyName?
                      variable.members.push(propertyName);
                      variables.push(variable);
                    }
                  }
                  // }
                } else if (memexp) {
                  let variable = new VariableBuilder(
                    memexp.object + "." + memexp.property,
                    importPath,
                    true
                  );
                  let propertyName = helper.getPropertyName(parent); // detects require('something').property
                  if (propertyName) variable.members.push(propertyName);
                  variable.members.push(".");
                  trackids.push(variable.name);
                  variables.push(variable);
                }
              } else if (assignment.left.type === syntax.Identifier) {
                let variable = new VariableBuilder(
                  assignment.left.name,
                  importPath,
                  true
                );
                let propertyName = helper.getPropertyName(parent); // detects require('something').property
                if (propertyName) variable.members.push(propertyName);
                trackids.push(variable.name);
                variables.push(variable);
              }
            }

            let vardeclarator = helper.closests(
              node,
              syntax.VariableDeclarator
            );
            if (vardeclarator) {
              if (vardeclarator.id.type === syntax.Identifier) {
                let varid = vardeclarator.id.name;
                let oprop = null;
                if (vardeclarator.init.type === syntax.ObjectExpression) {
                  oprop = helper.closests(node, syntax.Property);
                  if (oprop) {
                    if (oprop.key && oprop.key.type === syntax.Identifier)
                      varid = oprop.key.name;
                    else if (oprop.key && oprop.key.type === syntax.Literal)
                      varid = oprop.key.value;
                  }
                }
                let variable = new VariableBuilder(varid, importPath, true);
                let propertyName = helper.getPropertyName(parent); // detects require('something').property
                if (propertyName) variable.members.push(propertyName);
                trackids.push(variable.name);
                variables.push(variable);
                if (vardeclarator.xUsed || oprop) {
                  variable.members.push(".");
                }
              } else if (vardeclarator.id.type === syntax.ObjectPattern) {
                let objectPattern = vardeclarator.id;
                for (let p of objectPattern.properties) {
                  if (p.key.type === syntax.Identifier) {
                    let variable = new VariableBuilder(
                      p.key.name,
                      importPath,
                      true
                    );
                    console.log(variable);
                    variable.members.push(p.key.name);
                    let propertyName = helper.getPropertyName(parent); // detects require('something').property
                    if (propertyName) variable.members.push(propertyName);
                    trackids.push(variable.name);
                    variables.push(variable);
                  }
                }
              }
            }

            if (
              parent &&
              parent.type === syntax.CallExpression &&
              parent.callee !== node
            ) {
              // function ( require() )
              let variable = new VariableBuilder(importPath, importPath, true);
              variable.isDynamic = true;
              variable.members.push(".");
              variables.push(variable);
            } else if (parent && parent.type === syntax.ExpressionStatement) {
              // require()
              let variable = new VariableBuilder(importPath, importPath, true);
              variable.isDynamic = true;
              variable.members.push(".");
              variables.push(variable);
            } else if (
              parent &&
              parent.type === syntax.CallExpression &&
              parent.callee === node
            ) {
              // require("foo")()
              let variable = new VariableBuilder(importPath, importPath, true);
              variable.members.push(".");
              variables.push(variable);
            } else if (
              parent &&
              parent.type === syntax.MemberExpression &&
              parent.object === node
            ) {
              // require("foo").something().hello
              let meta = helper.getMemberExpressionMeta(parent);
              if (meta) {
                let variable = new VariableBuilder(
                  importPath,
                  importPath,
                  true
                );
                if (meta.computed) variable.isDynamic = true;
                variable.members.push(meta.property);
                variables.push(variable);
              }
            }
          } else if (node.arguments.length > 0) {
            // Detecting if variable was passed as argument to a function
            // If so, it will mark it as dynamically used variable
            for (let argument of node.arguments) {
              if (argument.type === syntax.Identifier) {
                let variable = getLatestVariable(variables, argument.name);
                if (variable && variable.isModule) {
                  variable.isDynamic = true;
                } else if (argument.name === "exports") {
                  modul.skipReduce = true;
                  modul.isDynamicallyUsed = true;
                }
              }
            }
          }
          break;
        case syntax.FunctionExpression:
          if (parent.type === syntax.CallExpression) {
            let calleeName = null;
            if (parent.callee.type === syntax.Identifier) {
              calleeName = parent.callee.name;
            } else if (parent.callee.type === syntax.MemberExpression) {
              calleeName = helper.getObjectName(parent.callee);
            }
            if (calleeName && trackids.includes(calleeName)) {
              for (let arg of node.params) {
                if (arg.type === syntax.Identifier) {
                  callbacks.push({
                    name: arg.name,
                    value: calleeName,
                    scope: currentScope,
                  });
                }
              }
            }
          }
          break;
          case syntax.ImportDeclaration:
            // ImportDeclaration: static import in ES6. 
            //     type: "ImportDeclaration"
            //     specifiers: [ ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier ]
            //     source: Literal
            // static imports
            importPath = resolve(node.source.value);
            console.debug(`Analyzer-ImportDeclaration: modul name: ${modul.name}, importPath: ${node.source.value}`);
            node.specifiers.forEach(specifier => {
              const localIdName = specifier.local.name; // the name of the identifier used in current module
              // one new variable for each specifier
              let variable = new VariableBuilder(localIdName, importPath, true);
              switch (specifier.type) {
                case 'ImportSpecifier':
                  //     type: "ImportSpecifier"
                  //     imported: Identifier
                  // example: {foo} in import {foo} from "mode", or {foo as bar} in import {foo as bar} from "mode"
                  // In the first example, imported and local are equivalent Identifier node. 
                  // In the second example, imported represents foo while local represents bar
                  // This ES6 syntax is like bar = require("mode.js").foo
                  variable.members.push(specifier.imported.name); // imported ID name
                  
                  break;
                case 'ImportDefaultSpecifier':
                  //     type: "ImportDefaultSpecifier"
                  // example: foo in import foo from "mod.js"
                  // This ES6 syntax is like foo = require("mod.js").foo
                  variable.members.push(localIdName); // imported ID has the same name as the local one. 
                  // QUESTION: would the imported name be empty in the corresponding export declaration? for example: export default function () {}
                  
                  break;
                case 'ImportNamespaceSpecifier':
                  //     type: "ImportNamespaceSpecifier"
                  // example: * as foo in import * as foo from "mod.js"
                  // This ES6 syntax is like foo = require("mod.js") used in the commonjs module
                  console.debug(`Analyzer-ImportNamespaceSpecifier: this case will be removed. modul name: ${modul.name}, importPath: ${node.source.type}`);
                  break;
              }

              trackids.push(variable.name);
              variables.push(variable);
              // TODO-Hui: is there a way to know whether this variable is used? In commonjs, we can find the VarDeclarator and check its xUsed
              modul.requires.push(importPath); // TODO-Hui: check whether this will break the logic in commonjs
            });
            break;
          case syntax.ImportExpression:
            //TODO-Hui future
            break;
          case syntax.ExportNamedDeclaration:
            // ExportNamedDeclaration: ['declaration', 'specifiers', 'source']
            //     declaration: Declaration | null
            //     specifiers: [ ExportSpecifier ]. where ExportSpecifier: ['exported', 'local']
            //     source: Literal | null
            // Check the Declaraion options listed in the ExportDefaultDeclaration syntax
            // Examples:
            //     export var foo
            //     export class MyClass{}
            //     export function myfunc() {}
            //     export {_copy, _empty} // _copy and _empty are stored in specifiers instead of declarations
            //     export const copy = _copy.copy, copySync = _copy.copySync. 
            //     export const move = _move.move
            
            console.log(`ExportNamedDeclaration: modul name: ${modul.name}, source: ${node.source}`);
            if (node.declaration) {
              // for now I only see the following types in the declaration of ExportNamedDeclaration
              console.log(`    declaration type: ${node.declaration.type}`);
              if (node.declaration.type === syntax.VariableDeclaration) {
                // this supports multiple VariableDeclarator in declaration.declarations
                for (const declaElem of node.declaration.declarations) {
                  if ( (declaElem.type === syntax.VariableDeclarator) ) {
                    // TODO-Hui: store the variable exported in members, and internal names in selfUsed
                    // in the above example export const move = _move.move, _move and _move.move are stored in selfUsed, while copy is stored in members
                    // QUESTION: shall we store ("export." + ${variable}) in modul.members instead of the variable?
                    // QUESTION 2: does selfUsed mean "exposed and can be used internally" or "already used internally"?
                    if (declaElem.id.type === syntax.Identifier) {
                      if (!modul.members.includes(declaElem.id.name)) {
                        modul.members.push(declaElem.id.name);
                      }
                    }
                    if (declaElem.init && declaElem.init.type === syntax.Identifier) {
                      if (!modul.selfUsed.includes(declaElem.init.name)) {
                        modul.selfUsed.push(declaElem.init.name);
                      }                   
                    }
                    if (declaElem.init && declaElem.init.type === syntax.MemberExpression) {
                      //TODO-Hui: Need to debug this to see whether it gets the string correctly
                      let right = helper.getMemberExpressionString(declaElem.init);
                      if (right) {
                        right = right.object + "." + right.property;
                        if (!modul.selfUsed.includes(right)) {
                          modul.selfUsed.push(right);
                        }
                      }
                      // Instead of using getPropertyStart(), I directly add the top level name
                      if (declaElem.init.object === syntax.Identifier) {
                        if (!modul.selfUsed.includes(declaElem.init.object.name)) {
                          modul.selfUsed.push(declaElem.init.object.name);
                        }
                      }
                    }
                  }

                  console.log(`    declaration.id.name: ${declaElem.id.name}`);
                }
              } else if ( (node.declaration.type === syntax.FunctionDeclaration) || 
                          (node.declaration.type === syntax.ClassDeclaration)
                ) {
                // there is no declarations in the function or class declaration. Use declaration directly
                // follow the same to-dos in syntax.VariableDeclaration
                if (node.declaration.id.type === syntax.Identifier) {
                  if (!modul.members.includes(node.declaration.id.name)) {
                    modul.members.push(node.declaration.id.name);
                  }
                  // my understanding is: 1) we do not know whether this function or class is self used or not
                  // 2) if this function or class is used, it will be detected later on
                  // TODO-Hui: check the "xUsed" field of the variable, function and class
                }
              } else {
                // TODO-Hui: will there be MemberExpression or AssignmentExpression? The answer is no for now.
                  console.log(`    warning: this declaration.id.type ${node.declaration.type} is not supported!`);
              }
            }
            
            if (node.specifiers && node.specifiers.length > 0) {
              // follow the same to-dos in syntax.VariableDeclaration
              node.specifiers.forEach(specifier => {
                console.log(`    specifier: Exported: ${specifier.exported.name}, Local: ${specifier.local.name}`);
                if (!modul.members.includes(specifier.exported.name)) {
                  modul.members.push(specifier.exported.name);
                }
                if (!modul.selfUsed.includes(specifier.local.name)) {
                  modul.selfUsed.push(specifier.local.name);
                }
              })
            }
            
            // detecting descendents (i.e., importing from the other file) for future analysis in index.js
            if (node.source && node.source === syntax.Literal) {
              if (!modul.descendents.include(node.source.value)) {
                modul.descendents.push(node.source.value);
              }
            }
            break;
          case syntax.ExportDefaultDeclaration:
            // ExportDefaultDeclaration: ['declaration']
            //     declaration: OptFunctionDeclaration | OptClassDeclaration | Expression
            // Examples:
            //     export default {..._copy, ..._empty, ..._ensure, ..._json, ..._mkdirs, ..._move, ..._outputFile, ..._pathExists, ..._remove}
            //     export default foo
            //     export default class MyClass{}, export default class {}
            //     export default function myfunc2() {}, export default function () {}
            // Note: export default Literal is not considered here. I believe it does not have big impact on our debloating.  

            // should use "module.exports" to align with the commonjs modules, or simply use "default"? 
            // we can use "default" to distinguish with "module.exports". "default" and "module.exports" will not occur in the same file anyway
            // right now, we use the variable if exists; otherwise "default"
            
            // TODO-Hui: follow the same to-dos in syntax.ExportNamedDeclaration
            console.log(`ExportDefaultDeclaration: modul name: ${modul.name}, declaration type: ${node.declaration.type}`);
            let name = "UNDEFINED";
            switch (node.declaration.type) {
              case syntax.Identifier:
                // export default foo
                if (!modul.members.includes(node.declaration.name)) {
                  modul.members.push(node.declaration.name);
                }
                if (!modul.selfUsed.icludes(node.declaration.name)) {
                  modul.selfUsed.push(node.declaration.name);
                }
                name = node.declaration.name;
                console.log(`    declaration.id.name: ${name}`);
                break;
              case syntax.ClassDeclaration:
                if (node.declaration.id) {
                  // export default class MyClass{}
                  if (node.declaration.id.type === syntax.Identifier) {
                    if (!modul.members.includes(node.declaration.id.name)) {
                      modul.members.push(node.declaration.id.name);
                    }
                    if (!modul.selfUsed.includes(node.declaration.id.name)) {
                      modul.selfUsed.push(node.declaration.id.name);
                    }
                    name = node.declaration.id.name;
                  }
                } else {
                  // export default class {}
                  name = "default";
                  if (!modul.members.includes(name)) {
                    modul.members.push(name);
                  }
                  // not exposed internally
                }
                console.log(`    declaration.id.name: ${name}`);
                break;
              case syntax.FunctionDeclaration:
                if (node.declaration.id) {
                  // export default function myfunc2() {}
                  if (node.declaration.id.type === syntax.Identifier) {
                    if (!modul.members.includes(node.declaration.id.name)) {
                      modul.members.push(node.declaration.id.name);
                    }
                    if (!modul.selfUsed.includes(node.declaration.id.name)) {
                      modul.selfUsed.push(node.declaration.id.name);
                    }
                    name = node.declaration.id.name;
                  }
                } else {
                  // export default function () {}
                  name = "default";
                  if (!modul.members.includes(name)) {
                    modul.members.push(name);
                  }
                  // not exposed internally
                }
                console.log(`    declaration.id.name: ${name}`);
                break;
              case syntax.ObjectExpression:
                // I only see ObjectExpression from the specification/examples. 
                // The peroperties of ObjectExpression include SpreadElements. The argument of each SpreadElement is an identifier
                if (node.declaration.properties) {
                  for (const spreadElem of node.declaration.properties) {
                    if ( spreadElem.argument && (spreadElem.argument.type === syntax.Identifier) ) {
                      if (!modul.members.includes(spreadElem.argument.name)) {
                        modul.members.push(spreadElem.argument.name);
                      }
                      if (!modul.selfUsed.includes(spreadElem.argument.name)) {
                        modul.selfUsed.push(spreadElem.argument.name);
                      }
                      name = spreadElem.argument.name;
                    } 
                    console.log(`    declaration.properties.element.argument: ${name}`);
                  }
                }
                break;
              default:
                // in case there is other Expression type
                console.log(`Warning: Not supported node.declaration.type ${node.declaration.type} in ExportDefaultDeclaration.`);
              }
            break;
          case syntax.ExportAllDeclaration:
            // ExportAllDeclaration: ['source']
            // example: export * as a from 'mymodule'

            // TODO-Hui: This is also called re-exporting since the exported is from another file, like an import + export. 
            // The modules are not exposed or used internally 
            // To support chaining using descendents
            // To get the detail, this may need to go to 'source' to retrieve all related identifiers

            // detecting descendents (i.e., importing from the other file) for future analysis in index.js
            if (node.source && node.source === syntax.Literal) {
              if (!modul.descendents.include(node.source.value)) {
                modul.descendents.push(node.source.value);
              }
            }
            // TODO-Hui: do we need to track node.exported if it is an identifier? It is not exposed in this file
            console.log(`ExportAllDeclaration: modul name: ${modul.name}, source: ${node.source}`);
            break;
      }
    },

    leave: function (node, parent) {
      if (helper.createsNewScope(node)) {
        currentScope -= 1;
      }
      switch (node.type) {
        case syntax.FunctionExpression:
          callbacks = callbacks.filter((item, index) => {
            return item.scope !== currentScope + 1;
          });
          break;
        case syntax.AssignmentExpression:
          if (node.left.type === syntax.Identifier) {
            assignments[currentScope][
              assignments[currentScope].length - 1
            ].push(node.left.name);
            let left = new VariableBuilder(node.left.name);
            if (node.right.type === syntax.Identifier) {
              if (trackids.includes(node.right.name)) {
                trackids.push(node.left.name);
                let right = getLatestVariable(variables, node.right.name);
                if (right) {
                  left.value = right.value;
                  left.isModule = true;
                }
              }
            } else if (node.right.type === syntax.CallExpression) {
              let cname = node.right.callee.name;
              if (trackids.includes(cname)) {
                trackids.push(node.left.name);
                let right = getLatestVariable(variables, cname, true);
                if (right) {
                  left.value = right.value;
                  left.isModule = true;
                }
              }
            }
            variables.push(left);
          }
          break;
      }
    },
  });
}
/**
 * @param {Array<Child>} children
 * @param {Boolean} donNotReduce
 * @constructor
 */
function AnalyzeResult(children = new Object(), doNotReduce = false) {
  this.children = children;
  this.doNotReduce = doNotReduce;
}

function VariableDeclarator(node) {
  let variable = null;
  if (node.id.type === syntax.Identifier) {
    variable = new VariableBuilder(node.id.name);
    if (node.init) {
      if (node.init.type === syntax.CallExpression) {
        let callee = node.init.callee;
        if (callee.type === syntax.Identifier) {
          if (trackids.includes(callee.name)) {
            trackids.push(node.id.name);
            let item = getLatestVariable(variables, callee.name, true);
            if (item) {
              variable.value = item.value;
              variable.isModule = true;
            }
          }
        }
      } else if (node.init.type === syntax.Identifier) {
        if (trackids.includes(node.init.name)) {
          trackids.push(node.id.name);
          let item = getLatestVariable(variables, node.init.name, true);
          if (item) {
            variable.value = item.value;
            variable.isModule = true;
          }
        }
      } else if (node.init.type === syntax.MemberExpression) {
        // todo: VariableDeclare with MemberExpression init
        let memexp = helper.getMemberExpressionString(node.init);
        if (memexp) {
          if (trackids.includes(memexp.object)) {
            trackids.push(node.id.name);
            let item = getLatestVariable(variables, memexp.object, true);
            if (item) {
              variable.value = item.value;
              variable.isModule = true;
            }
          }
        }
      }
    }
  }
  if (variable) variables.push(variable);
}

/**
 * ===================
 * UTILITIES
 * ===================
 */

/**
 *
 * @param {Array} arr
 * @param {String} name
 * @returns {VariableBuilder}
 */
function getLatestVariable(arr, name, isModule = true) {
  if (arr.length) {
    let element = null;
    if (isModule) {
      element = arr
        .filter((item, index) => {
          return (
            item.name === name && item.scope <= currentScope && item.isModule
          );
        })
        .sort(sortByScope)
        .pop();
    } else if (isModule === false) {
      element = arr
        .filter((item, index) => {
          return (
            item.name === name &&
            item.scope <= currentScope &&
            item.isModule === false
          );
        })
        .sort(sortByScope)
        .pop();
    } else {
      element = arr
        .filter((item, index) => {
          return item.name === name && item.scope <= currentScope;
        })
        .sort(sortByScope)
        .pop();
    }

    return element;
  }
  return null;
}

function sortByScope(a, b) {
  return a.scope > b.scope ? 1 : a.scope < b.scope ? -1 : 0;
}

function VariableBuilder(name, value = null, isModule = false) {
  this.name = name;
  this.value = value;
  this.isModule = isModule;
  this.scope = currentScope;
  this.members = [];
}
/**
 * @returns {String}
 * @param {String} property
 */
function getPropertyStart(property) {
  property = property.toString();
  if (!property) return null;
  if (!property.includes(".")) return property;
  return property.split(".", 1)[0];
}

async function checkForLeaks() {
  for (let i in vars) {
    for (let j in vars[i]) {
      for (let v of vars[i][j]) {
        for (let k = i; k < assignments.length; k++) {
          if (k === i) {
            for (let n in assignments[k][j]) {
              if (assignments[k][j][n] === v) assignments[k][j].splice(n, 1);
            }
          } else {
            for (let m in assignments[k]) {
              for (let n in assignments[k][m]) {
                if (assignments[k][m][n] === v) assignments[k][m].splice(n, 1);
              }
            }
          }
        }
      }
    }
  }
  for (let i in assignments) {
    for (let j in assignments[i]) {
      for (let k of assignments[i][j]) {
        leaks.push(k);
      }
    }
  }
}

/**
 * @param {String} name
 */
function isDeclaredInCurrentScope(name) {
  for (let i = 0; i < currentScope; i++) {
    for (let j in vars[i]) {
      if (vars[i][j].includes(name)) return true;
    }
  }
  let last = vars[currentScope].length - 1;
  if (vars[currentScope][last].includes(name)) return true;
  return false;
}
