const fs = require("fs");
const resolve = require("resolve-from");
const esprima = require("esprima");
const syntax = esprima.Syntax;
const estraverse = require("estraverse");

module.exports = function allRequires(base, ast) {
  let resolveFrom = resolve.bind(base, null);
  let result = [];
  estraverse.traverse(ast, {
    enter: function (node, parent) {
      // todo: add renamed requires
      if (
        node.type === syntax.CallExpression &&
        node.callee.name === "require"
      ) {
      }
    },
    leave: function (node, parent) {},
  });
  return result;
};
