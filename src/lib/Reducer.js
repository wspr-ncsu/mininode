/**
 * @author Igibek Koishybayev
 * @abstract Marks AST nodes as used/unused depending on:
 *  - if exports is used/unused. Same with variables, functions
 */
const estraverse = require("estraverse");
const es = require("espree");
const chalk = require("chalk");
const path = require("path");
const helper = require("./utils/helpers");
const config = require("./Configurator");
const ModuleBuilder = require("./models/ModuleBuilder");
const Scope = require("./Scope");

var variables = [];
var functions = [];
var members = {};
var currentScope = 0;
let idstr = [];
let scope = new Scope();
async function init(dirname) {
  variables = []; // {scope:1, id:"", node:{}}
  functions = []; // {scope:1, id:"", node:{}}
  idstr = []; // {scope:1, id:""}
  members = {};
  currentScope = 0;
  chain = null;
}

/**
 * @param {ModuleBuilder} modul module that needs to be reduced
 * @param {Array<String>} expr exports that were used by dependents of the module
 * @returns {String} if the module is chained returns path of the chain, else returns NULL
 */
module.exports.reduce = async function (modul, extra = []) {
  console.debug(`[Reducer.js] reducing the module ${modul.path}`);
  await init(path.dirname(modul.path));
  await traverse(modul, extra);
};

/**
 * @param {ModuleBuilder} modul
 * @param {Array<String>} extra
 */
async function traverse(modul, extra) {
  console.debug(`[Reducer.js] traversing AST of ${modul.path}`);
  estraverse.traverse(modul.ast, {
    enter: function (node, parent) {
      if (helper.createsNewScope(node)) {
        currentScope += 1;
        scope.create();
      }

      if (node.type === es.Syntax.FunctionDeclaration && node.xUsed === false) {
        this.skip();
      }

      node["xParent"] = parent;

      let idIndex = -1;

      switch (node.type) {
        case es.Syntax.Identifier:
          // todo: problem resides right here!
          if (
            parent &&
            (parent.type !== es.Syntax.VariableDeclarator ||
              (parent.init &&
                parent.init.type === es.Syntax.Identifier &&
                parent.init.name === node.name)) &&
            parent.type !== es.Syntax.FunctionDeclaration &&
            parent.type !== es.Syntax.ObjectPattern
          ) {
            idstr.push({ scope: currentScope, id: node.name });
            // todo: more sophisticated detection of used scoped variable
            let varElement = variables
              .filter((e) => e.scope <= currentScope && e.id === node.name)
              .pop();
            if (varElement) {
              varElement.node["xUsed"] = true;
            }

            let funcElement = functions
              .filter((e) => e.scope <= currentScope && e.id === node.name)
              .pop();
            if (funcElement) {
              funcElement.node["xUsed"] = true;
            }
          }
          break;
        case es.Syntax.VariableDeclarator:
          if (node.id.type === es.Syntax.Identifier) {
            node["xScope"] = currentScope;
            // todo: change to Array.some
            idIndex = idstr.findIndex(
              (e) => e.scope >= currentScope && e.id === node.id.name
            );
            if (idIndex > -1) {
              node["xUsed"] = true;
            } else {
              node["xUsed"] = false;
            }
            let variable = {
              scope: currentScope,
              id: node.id.name,
              node: node,
            };
            variables.push(variable);
            scope.push(node.id.name);
          } else if (node.id.type === es.Syntax.ObjectPattern) {
            for (let prop of node.id.properties) {
              prop["xScope"] = currentScope;
              idIndex = idstr.findIndex(
                (e) => e.scope >= currentScope && e.id === prop.key.name
              );
              if (idIndex > -1) {
                prop["xUsed"] = true;
              } else {
                prop["xUsed"] = false;
              }
              let variable = {
                scope: currentScope,
                id: prop.key.name,
                node: prop,
              };
              variables.push(variable);
            }
          }
          break;
        case es.Syntax.FunctionDeclaration:
          node["xScope"] = currentScope - 1;
          if (!node.xUsed) {
            idIndex = idstr.findIndex(
              (e) => e.id === node.id.name && e.scope >= currentScope - 1
            );
            if (idIndex > -1) {
              node["xUsed"] = true;
            } else {
              node["xUsed"] = false;
            }
          }

          let declaration = {
            id: node.id.name,
            scope: currentScope - 1,
            node: node,
          };

          functions.push(declaration);
          break;
        case es.Syntax.CallExpression:
          let funcElement = functions
            .filter((e) => e.id === node.callee.name && e.scope <= currentScope)
            .pop();
          if (funcElement) {
            funcElement.node["xUsed"] = true;
          }
          break;
        case es.Syntax.MemberExpression:
          if (
            parent &&
            parent.type === es.Syntax.AssignmentExpression &&
            parent.left === node
          ) {
            let meta = helper.getMemberExpressionMeta(node);
            if (
              meta &&
              !meta.computed &&
              (meta.exported || modul.exporters.includes(meta.object))
            ) {
              let full = meta.object + "." + meta.property;
              let prop = meta.exported
                ? helper.getExportedProperty(full)
                : meta.property;
              if (prop) {
                if (
                  modul.used.includes(prop) ||
                  modul.selfUsed.includes(prop) ||
                  extra.includes(prop) ||
                  full === "module.exports"
                ) {
                  if (config.verbose) console.log("-- used:", chalk.blue(full));
                  parent["xUsed"] = true;
                  if (
                    full === "module.exports" &&
                    parent.right &&
                    parent.right.type === es.Syntax.ObjectExpression
                  ) {
                    for (let property of parent.right.properties) {
                      let key = property.key;
                      let keyName =
                        key.type === es.Syntax.Identifier
                          ? key.name
                          : key.type === es.Syntax.Literal
                          ? key.value
                          : "";
                      if (
                        modul.used.includes(keyName) ||
                        modul.selfUsed.includes(keyName) ||
                        extra.includes(keyName)
                      ) {
                        property.xUsed = true;
                      } else {
                        property.xUsed = false;
                      }
                    }
                  }
                } else {
                  if (config.verbose)
                    console.log("-- not used:", chalk.yellow(full));
                  parent["xUsed"] = false;
                  // todo: mark parent.right hand side as unused if it is functionexpress
                }
              }
            }
          } else if (
            parent &&
            parent.type === es.Syntax.CallExpression &&
            node.object.name === "Object" &&
            node.property.name === "defineProperty"
          ) {
            let arg1 = parent.arguments[0];
            let arg2 = parent.arguments[1];
            if (arg2.type === es.Syntax.Literal) {
              if (
                (arg1.type === es.Syntax.Identifier &&
                  arg1.name === "exports") ||
                (arg1.type === es.Syntax.MemberExpression &&
                  arg1.object.name === "module" &&
                  arg1.property.name === "exports")
              ) {
                let prop = arg2.value;
                if (
                  modul.used.includes(prop) ||
                  modul.selfUsed.includes(prop) ||
                  extra.includes(prop)
                ) {
                  parent.xUsed = true;
                } else {
                  parent.xUsed = false;
                }
              }
            }
          }
          break;
        case es.Syntax.ExportNamedDeclaration:
          // TODO-Hui: ImportDeclaration and ExportDeclaration are all high level declarations. 
          // Perhaps we do not need to handle them in Reducer.js. Instead they have already been handled in Detector.js and Analyzer.js
          // Right now for the test cases they never came in here

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
          console.debug(`ExportNamedDeclaration: modul name: ${modul.name}, source: ${node.source}`);
          if (node.declaration) {
            // for now I only see the following types in the declaration of ExportNamedDeclaration
            if (node.declaration.type === es.Syntax.VariableDeclaration) {
              node.xUsed = true;
              // this supports multiple VariableDeclarator in declaration.declarations
              for (const declaElem of node.declaration.declarations) {
                if ( (declaElem.type === es.Syntax.VariableDeclarator) ) {
                  // TODO-Hui: does selfUsed mean "exposed and can be used internally" or "already used internally"?
                  // If the answer is the former, this node is used. 
                  node.declaration.xUsed = true;
                  // Otherwise we need to check whether this variable is used or not
                  /* if (modul.used.includes(declaElem.id.name)) {
                    node.declaration.xUsed = true;
                  }
                  else {
                    node.declaration.xUsed = false;
                  } */
                }

                console.debug(`    declaration.id.name: ${declaElem.id.name}`);
              }
            } else if ( (node.declaration.type === es.Syntax.FunctionDeclaration) || 
                        (node.declaration.type === es.Syntax.ClassDeclaration)
              ) {
                // there is no declarations in the function or class declaration. Use declaration directly
                // follow the same to-dos in syntax.VariableDeclaration

                // if this function or class is used or self used, mark this node as used
                if (modul.used.includes(node.declaration.id.name)  || 
                    modul.selfUsed.includes(node.declaration.id.name) 
                  ) {
                    node.xUsed = true;
                  } else {
                    node.xUsed = false;
                  }
                }
          }
            
          if (node.specifiers && node.specifiers.length > 0) {
            node.xUsed = true;
            // follow the same to-dos in syntax.VariableDeclaration
            node.specifiers.forEach(specifier => {
              if (modul.used.includes(specifier.exported.name) ||
                  modul.selfUsed.includes(specifier.local.name) 
                ) {
                  specifier.xUsed = true;
                } else {
                  specifier.xUsed = false;
                }
            })
          }
          break;
        case es.Syntax.ExportDefaultDeclaration:
          // TODO-Hui: ImportDeclaration and ExportDeclaration are all high level declarations. 
          // Perhaps we do not need to handle them in Reducer.js. Instead they have already been handled in Detector.js and Analyzer.js
          // Right now for the test cases they never came in here
          // Do we move the code here that marks .xUsed to Analyzer.js?

          // ExportDefaultDeclaration: ['declaration']
          //     declaration: OptFunctionDeclaration | OptClassDeclaration | Expression
          // Examples:
          //     export default {..._copy, ..._empty, ..._ensure, ..._json, ..._mkdirs, ..._move, ..._outputFile, ..._pathExists, ..._remove}
          //     export default foo
          //     export default class MyClass{}, export default class {}
          //     export default function myfunc2() {}, export default function () {}
            
          // TODO-Hui: follow the same to-dos in syntax.ExportNamedDeclaration
          console.debug(`ExportDefaultDeclaration: modul name: ${modul.name}, declaration type: ${node.declaration.type}`);
          let name = "UNDEFINED";
          switch (node.declaration.type) {
            case es.Syntax.Identifier:
              // export default foo
              if (modul.used.includes(node.declaration.name)  || 
                    modul.selfUsed.includes(node.declaration.name) 
                ) {
                  node.xUsed = true;
                } else {
                  node.xUsed = false;
                }
              break;
            case es.Syntax.AssignmentExpression:
              // export default foo = mem, export default foo = mem.me
              // left must be an Identifier
              if (modul.used.includes(node.declaration.left.name)) {
                node.xUsed = true;
              }
              // note that right can be Identifier, MemberExpression, or literal
              if (node.declaration.right.type === es.Syntax.Identifier){
                // export default foo = mem
                if(modul.selfUsed.includes(node.declaration.right.name)) {
                  node.xUsed = true;
                  node.declaration.xUsed = true;
                }
              } else if (node.declaration.right.type === es.Syntax.MemberExpression) {
                // export default foo = mem.me
                //TODO-Hui: Need to debug this to see whether it gets the string correctly
                let right = helper.getMemberExpressionString(node.declaration.right);
                if (right) {
                  right = right.object + "." + right.property;
                  if (modul.selfUsed.includes(right)) {
                    node.xUsed = true;
                    node.declaration.xUsed = true;
                    node.declaration.right.property.xUsed = true; // TODO-Hui: this might be wrong
                  }
                }
              }
              break;
            case es.Syntax.ClassDeclaration:
              if (node.declaration.id) {
                // export default class MyClass{}
                if (node.declaration.id.type === es.Syntax.Identifier) {
                  if (modul.used.includes(node.declaration.id.name) || 
                      modul.selfUsed.includes(node.declaration.id.name)
                  ) {
                    node.xUsed = true;
                    node.declaration.xUsed = true;
                  } else {
                    node.xUsed = false;
                    node.declaration.xUsed = false;
                  }
                }
              } else {
                // export default class {}
                if (modul.used.includes("default")) {
                  node.xUsed = true;
                  node.declaration.xUsed = true;
                } else {
                  node.xUsed = false;
                  node.declaration.xUsed = false;
                }
                // not exposed internally
              }
              break;
            case es.Syntax.FunctionDeclaration:
              if (node.declaration.id) {
                // export default function myfunc2() {}
                if (node.declaration.id.type === es.Syntax.Identifier) {
                  if (modul.used.includes(node.declaration.id.name) || 
                      modul.selfUsed.includes(node.declaration.id.name)
                  ) {
                    node.xUsed = true;
                    node.declaration.xUsed = true;
                  } else {
                    node.xUsed = false;
                    node.declaration.xUsed = false;
                  }
                }
              } else {
                // export default function () {}
                if (modul.used.includes("default")) {
                  node.xUsed = true;
                  node.declaration.xUsed = true;
                } else {
                  node.xUsed = false;
                  node.declaration.xUsed = false;
                }
                // not exposed internally
              }
              break;
            case es.Syntax.ObjectExpression:
              // I only see ObjectExpression from the specification/examples. 
              // The peroperties of ObjectExpression include SpreadElements. The argument of each SpreadElement is an identifier
              if (node.declaration.properties) {
                for (const spreadElem of node.declaration.properties) {
                  if ( spreadElem.argument && (spreadElem.argument.type === es.Syntax.Identifier) ) {
                    if (modul.used.includes(spreadElem.argument.name) || (modul.selfUsed(spreadElem.argument.name))) {
                      node.xUsed = true;
                    }
                  }
                }
                if(!node.xUsed) node.xUsed = false; // check whether this holds
              }            
          }
          break;
        case es.Syntax.ImportDeclaration:
          // TODO-Hui: ImportDeclaration and ExportDeclaration are all high level declarations. 
          // Perhaps we do not need to handle them in Reducer.js. Instead they have already been handled in Detector.js and Analyzer.js
          // Right now for the test cases they never came in here

          // static imports in ES6
          
          // TODO-Hui: Shall we mark all ImportDeclaration as xUsed? Or we should mark it iff its corresponding variable is used or selfUsed?
          importPath = resolve(node.source.value);
          node.specifiers.forEach(specifier => {
            const localIdName = specifier.local.name; // the name of the identifier used in current module
            // one new variable for each specifier: let variable = new VariableBuilder(localIdName, importPath, true);
            if (modul.selfUsed.includes(localIdName)) {
              node.xUsed = true;
            } else {
              node.xUsed = false;
            }
          });
          break;
        case es.Syntax.ImportExpression:
          //TODO-Hui to support in the future. Import() could be in different scopes
          console.log(`Warning in Reducer: ImportExpression not supported! modul name: ${modul.name}, modulePath: ${node.source.value}, parent type: ${parent.type}, ${parent.xParent.type}`);
          break;
      }
    },
    leave: function (node, parent) {
      if (helper.createsNewScope(node)) {
        // todo: remove idstr elements that is out of scope
        currentScope -= 1;
        scope.exit();
      }
    },
  });
}
