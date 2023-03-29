const estraverse = require("estraverse");
const syntax = require("espree").Syntax;
const helper = require("./utils/helpers");
const utils = require("./utils");
const Scope = require("./Scope");
const attack = require("./attack.json");
const ModuleBuilder = require("./models/ModuleBuilder");

// FIXME: maximum call stack exceeded
/**
 * @param {ModuleBuilder} modul
 */
async function stat(modul) {
  await initialPass(modul);
  await secondPass(modul);
}

/**
 * initialPass calculates basic statistics and initializes modul's fields
 * @param {ModuleBuilder} modul
 */
async function initialPass(modul) {
  let scope = new Scope();
  let tracker = [];
  let modules = [];
  let self = [];
  estraverse.traverse(modul.ast, {
    enter: function (node, parent) {
      node["xParent"] = parent;
      if (scope.isNew(node)) {
        scope.create();
      }
      switch (node.type) {
        case syntax.CallExpression:
          let callee = node.callee.name;
          if (callee === "eval") {
            modul.eval += 1;
            if (node.arguments.length > 0) {
              let arg = node.arguments[0];
              if (arg.type !== syntax.Literal) {
                modul.evalWithVariable += 1;
              }
            }
          } else if (callee === "Function") {
            modul.functionNew += 1;
            modul.functions += 1;
          } else if (callee === "require" && node.arguments.length > 0) {
            //console.log(`require() in CallExpression: modul name: ${modul.name}`);
            let arg = node.arguments[0];
            if (arg.type !== syntax.Literal) {
              modul.dynamicRequire += 1;
              // TODO: detect what is value
              if (arg.type === syntax.BinaryExpression) {
                let isDynamicBinaryExpression =
                  utils.BinaryExpression.isDynamic(arg);
                if (isDynamicBinaryExpression) modul.complexDynamicRequire += 1;
              } else if (
                arg.type === syntax.Identifier &&
                (!modul.identifiers.hasIdentifier(arg.name) ||
                  (modul.identifiers.hasIdentifier(arg.name) &&
                    modul.identifiers.isComplex(arg.name)))
              ) {
                modul.complexDynamicRequire += 1;
              }
            } else {
              modul.staticRequire += 1;
              if (utils.hasKey(attack, arg.value)) {
                helper.VariableAssignmentName(parent, (name) => {
                  if (name) {
                    if (Array.isArray(name)) {
                      console.log(name);
                    }
                    tracker.push(name);
                    let vector = { name: name, value: arg.value, members: [] };
                    modul.attackVectors.push(vector);
                    if (parent.type === syntax.MemberExpression) {
                      vector.members.push(parent.property.name);
                    }
                  }
                });
              }
              let vardeclarator = helper.closests(
                node,
                syntax.VariableDeclarator
              );
              if (vardeclarator) {
                modules.push(vardeclarator.id.name);
              }
              let assignment = helper.closests(
                node,
                syntax.AssignmentExpression
              );
              if (assignment && assignment.left.type === syntax.Identifier) {
                modules.push(assignment.left.name);
              }
            }
          } else if (callee === "match" && node.arguments.length === 1) {
            modul.stringMatch += 1;
          } else if (callee === "replace" && node.arguments.length === 2) {
            modul.stringReplace += 1;
          } else if (callee === "search" && node.arguments.length === 1) {
            modul.stringSearch += 1;
          } else if (
            modul.requires.includes(callee) &&
            node.arguments.length === 1
          ) {
            modul.dynamicRequire += 1;
          }
          break;
        case syntax.MemberExpression:
          // TODO-Hui: this branch only tracks "exports". 
          // We will see whether we need to handle case #3 in syntax.ImportExpression
          if (node.object.type === syntax.Identifier) {
            if (
              node.object.name === "Object" &&
              node.property.name === "defineProperty"
            ) {
              if (parent.type === syntax.CallExpression) {
                let firstArg = parent.arguments[0];
                let secondArg = parent.arguments[1];
                if (firstArg && secondArg) {
                  if (
                    firstArg.type === syntax.Identifier &&
                    firstArg.name === "exports"
                  ) {
                    if (secondArg.type !== syntax.Literal)
                      modul.dynamicExport += 1;
                    else modul.staticExport += 1;
                  } else if (
                    firstArg.type === syntax.MemberExpression &&
                    helper.getObjectName(firstArg) === "module"
                  ) {
                    if (secondArg.type !== syntax.Literal)
                      modul.dynamicExport += 1;
                    else modul.staticExport += 1;
                  }
                }
              }
            } else if (
              node.object.name === "JSON" &&
              node.property.name === "parse"
            ) {
              if (parent.type === syntax.CallExpression) {
                modul.jsonParse += 1;
              }
            } else if (
              node.object.name === "exports" ||
              (node.object.name === "module" &&
                node.property.name === "exports")
            ) {
              if (helper.isComputed(node)) {
                modul.dynamicExport += 1;
              } else {
                modul.staticExport += 1;
              }
              let assignment = helper.closests(
                node,
                syntax.AssignmentExpression
              );
              if (assignment && assignment.left.type === syntax.Identifier) {
                self.push(assignment.right.name);
              }
              let vardeclarator = helper.closests(
                node,
                syntax.VariableDeclarator
              );
              if (vardeclarator) {
                if (vardeclarator.id.type === syntax.Identifier) {
                  self.push(vardeclarator.id.name);
                } else if (vardeclarator.id.type === syntax.ObjectPattern) {
                  // TODO: what is going to be here?
                }
              }
            }
            if (tracker.includes(node.object.name)) {
              modul.attackVectors.forEach((item) => {
                if (item.name === node.object.name) {
                  item.members.push(node.property.name);
                }
              });
            }
            if (modules.includes(node.object.name)) {
              let assignment = helper.closests(
                node,
                syntax.AssignmentExpression
              );
              if (
                assignment &&
                assignment.left.type === syntax.MemberExpression
              ) {
                if (
                  helper.getObjectName(assignment.left) === node.object.name
                ) {
                  modul.monkeyPatching += 1;
                }
              }
              if (helper.isComputed(node)) {
                modul.dynamicUsage += 1;
              }
            }
            if (self.includes(node.object.name)) {
              if (helper.isComputed(node)) {
                modul.dynamicUsage += 1;
              }
            }
          }
          break;
        case syntax.AssignmentExpression:
          if (node.left.type === syntax.Identifier) {
            if (node.right.type === syntax.Identifier) {
              switch (node.right.name) {
                case "eval":
                  modul.obfuscated += 1;
                  break;
                case "require":
                  modul.requires.push(node.left.name);
                  break;
                case "exports":
                  modul.exporters.push(node.left.name);
                  break;
              }
            } else if ( (node.right.type === syntax.ImportExpression) || 
                        ( (node.right.type === syntax.AwaitExpression ) && (node.right.argument.type === syntax.ImportExpression) )
                      ) {
              // TODO-Hui: do we need this? 
              // add the support of Case 4 (see case syntax.ImportExpression) here
              modul.requires.push(node.left.name);
            } else if (node.right.type === syntax.MemberExpression) {
              let meta = helper.getMemberExpressionMeta(node.right);
              if (
                meta &&
                meta.object === "module" &&
                meta.property === "exports"
              ) {
                modul.exporters.push(node.left.name);
              }
            }
            // TODO: calculate the possible values of identifier
            // storing the modul.identifiers for simple dynamic resolution.
            let id = node.left.name;

            modul.identifiers.addIdentifier(id);
            if (node.right.type === syntax.Identifier) {
              modul.identifiers.addLink(id, node.right.name);
            } else if (
              node.right.type === syntax.BinaryExpression &&
              utils.BinaryExpression.isDynamic(node.right)
            ) {
              let idens = utils.BinaryExpression.getIdentifiers(node.right);
              if (idens) {
                for (const i of idens) {
                  modul.identifiers.addDependency(id, i);
                }
              }
            }
          }
          break;
        case syntax.VariableDeclarator:
          if (node.init && node.id.type === syntax.Identifier) {
            modul.variables += 1;
            if (node.init.type === syntax.Identifier) {
              if (node.init.name === "require") {
                modul.requires.push(node.id.name);
              } else if (node.init.name === "exports") {
                modul.exporters.push(node.id.name);
              }
            } else if (node.init.type === syntax.MemberExpression) {
              let meta = helper.getMemberExpressionMeta(node.init);
              if (
                meta &&
                meta.exported &&
                meta.object === "module" &&
                meta.property === "exports"
              ) {
                modul.exporters.push(node.id.name);
              }
            } else if (node.init.type === syntax.ImportExpression) {
              // TODO-Hui: do we need this? 
              // add the support of Case 5 (see case syntax.ImportExpression) here
              modul.requires.push(node.id.name);
            }

            // TODO: calculate the possible values of identifier
            // storing the modul.identifiers for simple dynamic resolution.
            let id = node.id.name;
            modul.identifiers.addIdentifier(id);
            if (node.init.type === syntax.Identifier) {
              modul.identifiers.addLink(id, node.init.name);
            } else if (
              node.init.type === syntax.BinaryExpression &&
              utils.BinaryExpression.isDynamic(node.init)
            ) {
              let idens = utils.BinaryExpression.getIdentifiers(node.init);
              if (idens) {
                for (const i of idens) {
                  modul.identifiers.addDependency(id, i);
                }
              }
            }
          }
          break;
        case syntax.Literal:
          if (node.regex) {
            modul.regex += 1;
            if (helper.isDangerousRegex(node.name)) {
              modul.regexDos += 1;
            }
          }
          break;
        case syntax.FunctionDeclaration:
          if (parent.type === syntax.ExportNamedDeclaration ||
              parent.type === syntax.ExportDefaultDeclaration) {
                console.debug(`modul name: ${modul.name}`);
              }
          modul.functions += 1;
          break;
        case syntax.ImportDeclaration:
          // ImportDeclaration: static import in ES6. 
          //     type: "ImportDeclaration"
          //     specifiers: [ ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier ]
          //     source: Literal
          const modulePath = node.source.value;
          node.specifiers.forEach(specifier => {
            const alias = specifier.local.name;
            let name;
            switch (specifier.type) {
              case 'ImportSpecifier':
                //     type: "ImportSpecifier"
                //     imported: Identifier
                // example: {foo} in import {foo} from "mode", or {foo as bar} in import {foo as bar} from "mode"
                // In the first example, imported and local are equivalent Identifier node. 
                // In the second example, imported represents foo while local represents bar
                name = specifier.imported.name;
                modul.staticRequire += 1;
                modules.push(alias);
                //modul.identifiers.addIdentifier(modulePath); // should we add identifier here?
                //modul.requires.push(name); // we do not push requires at this stage
                break;
              case 'ImportDefaultSpecifier':
                //     type: "ImportDefaultSpecifier"
                // example: foo in import foo from "mod.js"
                name = 'default';
                modul.staticRequire += 1;
                modules.push(alias);
                //modul.identifiers.addIdentifier(modulePath); // should we add identifier here?
                //modul.requires.push(modulePath); // we do not push requires at this stage
                break;
              case 'ImportNamespaceSpecifier':
                //     type: "ImportNamespaceSpecifier"
                // example: * as foo in import * as foo from "mod.js"
                // TODO-Hui: document all functions in modulePath?
                name = '*';
                modul.staticRequire += 1;
                modules.push(alias);
                //modul.identifiers.addIdentifier(modulePath); // should we add identifier here?
                //modul.requires.push(modulePath); // we do not push requires at this stage
                break;
            }

            // attack surface marking. TODO-Hui: check the logic
            if (utils.hasKey(attack, modulePath)) {
            helper.VariableAssignmentName(parent, (name) => {
              if (name) {
                if (Array.isArray(name)) {
                  console.log(name);
                }
                tracker.push(name);
                let vector = { name: name, value: arg.value, members: [] };
                modul.attackVectors.push(vector);
                //if (parent.type === syntax.MemberExpression) {
                //  vector.members.push(parent.property.name);
                //}
              }
              });
            }
            
            // console.log below is for debugging only. They will be removed after the processing is done in the above three cases
            if (name) {
              console.debug(`Static Import: modul name: ${modul.name}, alias: ${alias}, name: ${name}, modulePath: ${modulePath}`);
            }
            else {
              console.debug(`Static Import: NOT supported. modul name: ${modul.name}, modulePath: ${modulePath}`);
            }
          })
          break;
        case syntax.ImportExpression:
          // This is for import() which is a import from an ESM module to a commonjs module. 
          // It can be either static import or dynamic import, depending on the argument

          // five cases to support as of 03/22/2023:
          // 1: import("/my-module.mjs"); await import("/my-module.mjs");
          // 2: import(1>0 ? "./mod1.js" : "./mod2.js"); await import(1>0 ? "./mod1.js" : "./mod2.js");
          // 3: import("/my-module.mjs").init; await import("/my-module.mjs").init;
          // 4: exs = import("/my-module.mjs"); exs = await import("/my-module.mjs");
          // 5: const exs = import("/my-module.mjs");
          // Note: 
          // Case 1 & 2: these imports are not used by themselves in the application
          // The processing of 3, 4 and 5 is in syntax.MemberExpression, syntax.AssignmentExpression and syntax.VariableDeclarator, respectively
          // The ConditionalExpression is not supported yet: import(someCondition ? "./mod1.js" : "./mod2.js"); await import(someCondition ? "./mod1.js" : "./mod2.js");
          
          // The following is for debugging only
          if ( (parent.type === syntax.ExpressionStatement) || 
                ( (parent.type === syntax.AwaitExpression) && (parent.xParent.type === syntax.ExpressionStatement) ) 
          ) {
            if (node.source.type === syntax.Literal) {
              // case 1 - either a standalone statement, or part of a IfStatement or BlockStatement
              console.debug(`Import() case 1. modul name: ${modul.name}, modulePath: ${node.source.value}, parent type: ${parent.type}, ${parent.xParent.type}`);
            } else if (node.source.type === syntax.BinaryExpression) {
              // case 2 - either a standalone statement, or part of a IfStatement or BlockStatement
              console.debug(`Import() case 2. modul name: ${modul.name}, modulePath: ${node.source.type}, parent type: ${parent.type}, ${parent.xParent.type}`);
            } else {
              // general case 2
              console.debug(`Import() general case 2. modul name: ${modul.name}, modulePath: ${node.source.type}, parent type: ${parent.type}, ${parent.xParent.type}`);
            }
          } else if (parent.type === syntax.MemberExpression) {
            // case 3
            console.debug(`Import() case 3. modul name: ${modul.name}, modulePath: ${node.source.type}, parent type: ${parent.type}, ${parent.xParent.type}`);
          } else if ( (parent.type === syntax.AssignmentExpression) ||
                      ( (parent.type === syntax.AwaitExpression) && (parent.xParent.type === syntax.AssignmentExpression) )
          ) {
            // case 4
            console.debug(`Import() case 4. modul name: ${modul.name}, modulePath: ${node.source.type}, parent type: ${parent.type}, ${parent.xParent.type}`);
          } else if ( (parent.type === syntax.VariableDeclarator) ||
          ( (parent.type === syntax.AwaitExpression) && (parent.xParent.type === syntax.VariableDeclarator) )
          ) {
            // case 5
            console.debug(`Import() case 5. modul name: ${modul.name}, modulePath: ${node.source.type}, parent type: ${parent.type}, ${parent.xParent.type}`);
          } else {
            console.debug(`Import() case unknown. modul name: ${modul.name}, modulePath: ${node.source.type}, parent type: ${parent.type}, ${parent.xParent.type}`);
          }
          // end of the debugging block

          // Basic markings for each import(). Note this will be triggered once and only once for each import()
          let arg = node.source;
          if (arg.type !== syntax.Literal) {
            modul.dynamicRequire += 1;
            if (arg.type === syntax.BinaryExpression) {
              let isDynamicBinaryExpression = utils.BinaryExpression.isDynamic(arg);
              if (isDynamicBinaryExpression) modul.complexDynamicRequire += 1;
            } else if (
              arg.type === syntax.Identifier &&
              (!modul.identifiers.hasIdentifier(arg.value) ||
                (modul.identifiers.hasIdentifier(arg.value) &&
                  modul.identifiers.isComplex(arg.value)))
            ) {
              modul.complexDynamicRequire += 1;
            }
          } else {
            modul.staticRequire += 1;
            if (utils.hasKey(attack, arg.value)) {
              helper.VariableAssignmentName(parent, (name) => {
                if (name) {
                  if (Array.isArray(name)) {
                    console.log(name);
                  }
                  tracker.push(name);
                  let vector = { name: name, value: arg.value, members: [] };
                  modul.attackVectors.push(vector);
                  if (parent.type === syntax.MemberExpression) {
                    vector.members.push(parent.property.name);
                  }
                }
              });
            }
            let vardeclarator = helper.closests(
              node,
              syntax.VariableDeclarator
            );
            if (vardeclarator) {
              modules.push(vardeclarator.id.name);
            }
            let assignment = helper.closests(
              node,
              syntax.AssignmentExpression
            );
            if (assignment && assignment.left.type === syntax.Identifier) {
              modules.push(assignment.left.name);
            }
          }
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
          //     export const copy = _copy.copy, copySync = _copy.copySync
          //     export const move = _move.move

          modul.staticExport += 1;
          console.log(`ExportNamedDeclaration: modul name: ${modul.name}, source: ${node.source}`);
          if (node.declaration) {
            // for now I only see the following types in the declaration of ExportNamedDeclaration
            console.log(`    declaration type: ${node.declaration.type}`);
            if (node.declaration.type === syntax.VariableDeclaration) {
              // this supports multiple VariableDeclarator in declaration.declarations
              for (const declaElem of node.declaration.declarations) {
                if ( (declaElem.type === syntax.VariableDeclarator) ) {
                  if (declaElem.id.type === syntax.Identifier) {
                    self.push(declaElem.id.name); // TODO-Hui: we may not need to use self to store this
                    if (!modul.exporters.includes(declaElem.id.name)) { // TODO-Hui: do we need to check this?
                      modul.exporters.push(declaElem.id.name);
                    }
                  } 

                  // TODO-Hui: do we need to consider the init (e.g., MemberExpression)? perhaps not since the detail is only needed in Analyzer.js?
                  // also, do we need to update attackVectors if tracker.includes(node.object.name) when syntax.MemberExpression? example: module.exports = _copy
                  // perhaps attackVectors are already covered when processing imports?
                  // Third, will there be dynamicExport in ES6? my answer is no. The same answer for dynamicUsage and monkeyPatching.
                }
                console.log(`    declaration.id.name: ${declaElem.id.name}`);
              }
            } else if ( (node.declaration.type === syntax.FunctionDeclaration) || 
                        (node.declaration.type === syntax.ClassDeclaration)
              ) {
              // there is no declarations in the function or class declaration. Use declaration directly
              // follow the same to-dos in syntax.VariableDeclaration
              if (node.declaration.id.type === syntax.Identifier) {
                self.push(node.declaration.id.name);
                if (!modul.exporters.includes(node.declaration.id.name)) {
                  modul.exporters.push(node.declaration.id.name);
                }
              }
            } else {
              // TODO-Hui: will there be MemberExpression or AssignmentExpression? The answer is no for now.
              console.log(`    warning: this declaration.id.type ${node.declaration.type} is not supported!`);
            }
          }
          
          if (node.specifiers) {
            // follow the same to-dos in syntax.VariableDeclaration
            node.specifiers.forEach(specifier => {
              console.log(`    specifier: Exported: ${specifier.exported.name}, Local: ${specifier.local.name}`);
              self.push(specifier.local.name); 
              if (!modul.exporters.includes(specifier.local.name)) {
                modul.exporters.push(specifier.local.name);
              }
            })
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
          // Note: export default Literal is not considered here. I believe it does not have impact on our debloating.
          
          // TODO-Hui: follow the same to-dos in syntax.ExportNamedDeclaration
          modul.staticExport += 1;
          console.log(`ExportDefaultDeclaration: modul name: ${modul.name}, declaration type: ${node.declaration.type}`);
          switch (node.declaration.type) {
            case syntax.Identifier:
              self.push(node.declaration.name);
              if (!modul.exporters.includes(node.declaration.name)) {
                modul.exporters.push(node.declaration.name);
              }
              console.log(`    declaration.name: ${node.declaration.name}`);
              break;
            case syntax.ClassDeclaration:
              if (node.declaration.id && (node.declaration.id.type === syntax.Identifier) ) {
                self.push(node.declaration.id.name);
                if (!modul.exporters.includes(node.declaration.id.name)) {
                  modul.exporters.push(node.declaration.id.name);
                }
                console.log(`    declaration.id.name: ${node.declaration.id.name}`);
              }
              break;
            case syntax.FunctionDeclaration:
              if (node.declaration.id && (node.declaration.id.type === syntax.Identifier) ) {
                self.push(node.declaration.id.name);
                if (!modul.exporters.includes(node.declaration.id.name)) {
                  modul.exporters.push(node.declaration.id.name);
                }
                console.log(`    declaration.id.name: ${node.declaration.id.name}`);
              }
              break;
            case syntax.ObjectExpression:
              // I only see ObjectExpression from the specification/examples. 
              // The peroperties of ObjectExpression include SpreadElements. The argument of each SpreadElement is an identifier
              if (node.declaration.properties) {
                for (const spreadElem of node.declaration.properties) {
                  if ( spreadElem.argument && (spreadElem.argument.type === syntax.Identifier) ) {
                    self.push(spreadElem.argument.name); 
                    if (!modul.exporters.includes(spreadElem.argument.name)) {
                      modul.exporters.push(spreadElem.argument.name);
                    }
                  } 
                  console.log(`    declaration.properties.element.argument: ${spreadElem.argument.name}`);
                }
              }
              break;
            default:
              // in case there is other Expression type
              console.log(`Warning: Not supported node.declaration.type ${node.declaration.type} in ExportDefaultDeclaration.`);
          }
          break;
        case syntax.ExportAllDeclaration:
          // example: export * as a from 'mymodule'
          // ExportAllDeclaration: ['source']
          // TODO-Hui: This is also called re-exporting since the exported is from another file. Does this make our analysis task easier?
          // To get the detail, this may need to go to 'source' to retrieve all related identifiers
          // Note: in commonjs modules, to support the same function, we need module.exports = {a function to loop all items in the source and then require(item)}
          console.log(`ExportAllDeclaration: modul name: ${modul.name}, source: ${node.source}`);
          break;       
      }
    },
    leave: function (node, parent) {
      if (scope.isNew(node)) scope.exit();
      if (node.type === syntax.CallExpression) {
        if (
          (node.callee.name === "require" ||
            modul.requires.includes(node.callee.name)) &&
          node.arguments.length > 0
        ) {
          //console.log(`leave function for require: modul name: ${modul.name}`);
          let first = node.arguments[0];
          if (
            first.type === syntax.Identifier &&
            modul.identifiers.hasIdentifier(first.name)
          ) {
            // marking the identifier as a module
            modul.identifiers.setIsModule(first.name, true);
          }
        }
      }
      // do the same thing for dynamic import (from ESM to CommonJS module)
      // TODO-Hui: after the implementation of ImportExpression, check whether this is duplicate
      if (node.type === syntax.ImportExpression) {
        console.log(`leave function for dynamic import: modul name: ${modul.name}`);
        if (
          node.source.type === syntax.Identifier && 
          modul.identifiers.hasIdentifier(node.source.value)
        ) {
          // marking the identifier as a module
          modul.identifiers.setIsModule(node.source.value, true);
        }
      }
    },
  });
}

/**
 * @param {ModuleBuilder} modul
 */
async function secondPass(modul) {
  let scope = new Scope();
  estraverse.traverse(modul.ast, {
    enter: function (node, parent) {
      if (scope.isNew(node)) scope.create();
      if (node.type === syntax.VariableDeclarator) {
        if (node.init && node.id.type === syntax.Identifier) {
          let id = node.id.name;
          if (
            modul.identifiers.hasIdentifier(id) &&
            modul.identifiers.isModule(id)
          ) {
            if (node.init.type === syntax.Literal) {
              modul.identifiers.addValue(id, node.init.value);
            } else if (node.init.type === syntax.Identifier) {
              modul.identifiers.addLink(id, node.init.name);
            } else if (node.init.type === syntax.BinaryExpression) {
              if (utils.BinaryExpression.isDynamic(node.init)) {
                let values = utils.BinaryExpression.getValues(
                  node.init,
                  modul.identifiers
                );
                if (!values) modul.identifiers.setComplex(id, true);
                else {
                  modul.identifiers.addValue(id, values);
                }
              } else {
                let binaryExpressionValue = utils.BinaryExpression.getValue(
                  node.init
                );
                modul.identifiers.addValue(id, binaryExpressionValue);
              }
            } else {
              modul.identifiers.setComplex(id, true);
            }
          }
        }
      } else if (node.type === syntax.AssignmentExpression) {
        if (node.left.type === syntax.Identifier) {
          let id = node.left.name;
          if (
            modul.identifiers.hasIdentifier(id) &&
            modul.identifiers.isModule(id)
          ) {
            if (node.right.type === syntax.Literal) {
              modul.identifiers.addValue(id, node.right.value);
            } else if (node.right.type === syntax.Identifier) {
              modul.identifiers.addLink(id, node.right.name);
            } else if (node.right.type === syntax.BinaryExpression) {
              if (utils.BinaryExpression.isDynamic(node.right)) {
                let values = utils.BinaryExpression.getValues(
                  node.right,
                  modul.identifiers
                );
                if (!values) modul.identifiers.setComplex(id, true);
                else {
                  modul.identifiers.addValue(id, values);
                }
              } else {
                let binaryExpressionValue = utils.BinaryExpression.getValue(
                  node.right
                );
                modul.identifiers.addValue(id, binaryExpressionValue);
              }
            } else {
              modul.identifiers.setComplex(id, true);
            }
          }
        }
      }
    },
    leave: function (node, parent) {
      if (scope.isNew(node)) scope.exit();
    },
  });
}

module.exports = stat;
