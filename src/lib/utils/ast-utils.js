const syntax = require("esprima").Syntax;

function closests(node, type) {
  if (!node || node.type === syntax.Program) {
    return null;
  }
  if (node.type === type) {
    return node;
  }
  return closests(node.xParent, type);
}

function closestsNot(node, type) {
  if (node.type !== type) {
    return node;
  }
  return closestsNot(node.xParent, type);
}

/**
 * Detects if AST node creates new scope or not.
 * @returns {Boolean}
 * @param {*} node
 */
function createsNewScope(node) {
  if (!node) console.log(chalk.red(node));
  return (
    node.type === es.Syntax.Program ||
    node.type === es.Syntax.FunctionDeclaration ||
    node.type === es.Syntax.FunctionExpression
  );
}

module.exports.closests = closests;
module.exports.closestsNot = closestsNot;
module.exports.createsNewScope = createsNewScope;
