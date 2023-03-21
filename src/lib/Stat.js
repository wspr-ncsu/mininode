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
            console.log(`Line 48: modul name: ${modul.name}`);
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
          modul.functions += 1;
          break;
        case syntax.ImportDeclaration:
          // ImportDeclaration: static import in ES6. 
          //     type: "ImportDeclaration"
          //     specifiers: [ ImportSpecifier | ImportDefaultSpecifier | ImportNamespaceSpecifier ]
          //     source: Literal
          // TODO: update the information for the next step analysis
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
                break;
              case 'ImportDefaultSpecifier':
                //     type: "ImportDefaultSpecifier"
                // example: foo in import foo from "mod.js"
                name = 'default';
                modul.staticRequire += 1;
                // attack surface marking. TODO: check the logic. 
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
                modules.push(alias);
                // ?? modul.requires?
                break;
              case 'ImportNamespaceSpecifier':
                //     type: "ImportNamespaceSpecifier"
                // example: * as foo in import * as foo from "mod.js"
                name = '*';
                break;
            }
            // console.log below is for debugging only. They will be removed after the processing is done in the above three cases
            if (name) {
              console.log(`Static Import: modul name: ${modul.name}, alias: ${alias}, name: ${name}, modulePath: ${modulePath}`);
            }
            else {
              console.log(`Static Import: NOT supported. modul name: ${modul.name}, modulePath: ${modulePath}`);
            }
          })
          break;
        case syntax.ImportExpression:
          // for import() which is a dynamic import from an ESM module to a commonjs module. 
          // TODO: update the information for the next step analysis
          console.log(`Dynamic Import. modul name: ${modul.name}, modulePath: ${node.source.value}`);
          break;
        case syntax.ExportNamedDeclaration:
          // example: export function a {} or export a
          // ExportNamedDeclaration: ['declaration', 'specifiers', 'source']
          //     declaration: Declaration | null
          //     specifiers: [ ExportSpecifier ]. where ExportSpecifier: ['exported', 'local']
          //     source: Literal | null
          console.log(`ExportNamedDeclaration: modul name: ${modul.name}, declaration: ${node.declaration.kind}, ${node.declaration.type}, specifier: ...`);
          node.specifiers.forEach(specifier => {
            console.log(`Exported: ${specifier.exported}, Local: ${specifier.exported}`);
          })
          console.log(`..., source: ${node.source}`);
          break;
        case syntax.ExportDefaultDeclaration:
          // example: export default function () {}; or export default 1; 
          // ExportDefaultDeclaration: ['declaration']
          //     declaration: OptFunctionDeclaration | OptClassDeclaration | Expression
          console.log(`ExportDefaultDeclaration: modul name: ${modul.name}, declaration type: ${node.declaration.type}`);
          break;
        case syntax.ExportAllDeclaration:
          // example: export * as a from 'mymodule'
          // ExportAllDeclaration: ['source']
          // TODO: to support alias?
          console.log(`ExportAllDeclaration: modul name: ${modul.name}, source: ${node.source}`);
          // TODO: this may need to go to 'source' to retrieve all related identifiers
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
          console.log(`Line 364: modul name: ${modul.name}`);
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
