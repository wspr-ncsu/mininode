/**
 * @author Igibek Koishybayev
 * @abstract Marks AST nodes as used/unused depending on:
 *  - if exports is used/unused
 *  - variable is used/unused
 *  - function is used/unsed
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
