const syntax = require("esprima").Syntax;
const IdentifierTable = require("../models/IdentifierTable");
/**
 * @param {syntax.BinaryExpression} node
 */
function isDynamicBinaryExpression(node) {
  if (node.type === syntax.BinaryExpression) {
    if (node.left.type !== syntax.BinaryExpression) {
      return (
        node.left.type !== syntax.Literal || node.right.type !== syntax.Literal
      );
    }
    let copy = node;
    while (copy.type === syntax.BinaryExpression) {
      if (copy.right.type !== syntax.Literal) {
        return true;
      } else if (
        copy.right.type === syntax.Literal &&
        copy.left.type === syntax.Literal
      ) {
        return false;
      }
      copy = copy.left;
    }
  }
  return false;
}

/**
 * Returns the value of NOT dynamic binary expression. Will fail if the binary expression is dynamic
 * @param {syntax.BinaryExpression} node
 */
function getValue(node) {
  let right = node.right.value;
  let left =
    node.left.type === syntax.Literal ? node.left.value : getValue(node.left);
  return left + right;
}

/**
 * @param {syntax.BinaryExpression} node
 * @param {IdentifierTable} identifiers
 */
function getValues(node, identifiers) {
  let result = new Set(),
    rights = new Set(),
    lefts = new Set();
  if (
    (node.left.type !== syntax.Literal &&
      node.left.type !== syntax.Identifier &&
      node.left.type !== syntax.BinaryExpression) ||
    (node.right.type !== syntax.Literal &&
      node.right.type !== syntax.Identifier)
  ) {
    return null;
  }

  if (node.right.type === syntax.Literal) {
    if (
      typeof node.right.value === "string" ||
      typeof node.right.value === "number"
    )
      rights.add(node.right.value);
  } else if (node.right.type === syntax.Identifier) {
    let values = identifiers.getValues(node.right.name);
    for (const val of values) {
      rights.add(val);
    }
  }

  if (node.left.type === syntax.Literal) {
    if (
      typeof node.left.value === "string" ||
      typeof node.right.value === "number"
    )
      lefts.add(node.left.value);
  } else if (node.left.type === syntax.Identifier) {
    let values = identifiers.getValues(node.left.name);
    for (const val of values) {
      lefts.add(val);
    }
  } else if (node.left.type === syntax.BinaryExpression) {
    let deep = getValues(node.left, identifiers);
    if (!deep) {
      return null;
    }

    for (const val of deep) {
      lefts.add(val);
    }
  }

  for (const left of lefts) {
    for (const right of rights) {
      let val = left + right;
      result.add(val);
    }
  }
  return result;
}

function getIdentifiers(node) {
  let result = new Set();
  let rtype = node.right.type,
    ltype = node.left.type;
  if (rtype !== syntax.Literal && rtype !== syntax.Identifier) return null;
  if (
    ltype !== syntax.Literal &&
    ltype !== syntax.Identifier &&
    ltype !== syntax.BinaryExpression
  )
    return null;

  let copy = node;

  while (copy.type === syntax.BinaryExpression) {
    if (copy.right.type === syntax.Identifier) {
      result.add(copy.right.name);
    }
    if (copy.left.type === syntax.Identifier) {
      result.add(copy.left.name);
    } else if (
      copy.left.type !== syntax.Literal &&
      copy.left.type !== syntax.BinaryExpression
    ) {
      return null;
    }
    copy = copy.left;
  }

  return result;
}

module.exports.isDynamic = isDynamicBinaryExpression;

module.exports.getValue = getValue;

module.exports.getValues = getValues;

module.exports.getIdentifiers = getIdentifiers;
