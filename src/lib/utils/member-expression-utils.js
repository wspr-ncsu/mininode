const astutils = require("./ast-utils");
const es = require("esprima");

/**
 * Finds object name of the member expression.
 * @returns {String}
 * @param {MemberExpression} node
 */
function getObjectName(node) {
  if (node.type === es.Syntax.CallExpression) {
    return getObjectName(node.callee);
  } else if (node.type === es.Syntax.Identifier) {
    return node.name;
  }
  // should I add Literal???
  if (node.type !== es.Syntax.MemberExpression) {
    return null;
  } else if (node.object.type === es.Syntax.Identifier) {
    return node.object.name;
  } else if (node.object.type === es.Syntax.ThisExpression) {
    return "this";
  }
  return getObjectName(node.object);
}

/**
 * Contruct property name of the member expression.
 * If member expression has nested properties returned string will contain
 * all properties joined by .
 * @returns {String}
 * @param {MemberExpression} node
 */
function getPropertyName(node) {
  if (node) {
    if (node.type === es.Syntax.MemberExpression) {
      let propertyName = "";
      if (node.property.type === es.Syntax.Identifier) {
        propertyName = node.property.name;
      } else if (node.property.type === es.Syntax.Literal) {
        propertyName = node.property.value;
      }
      let parentProperty = getPropertyName(node["xParent"]);
      if (parentProperty) {
        return propertyName + "." + parentProperty;
      }
      return propertyName;
    } else if (node.type === es.Syntax.CallExpression) {
      return getPropertyName(node["xParent"]);
    }
  }

  return null;
}

function getMemberExpressionString(node) {
  if (node.type !== es.Syntax.MemberExpression) return null;
  if (
    node.object.type === es.Syntax.Identifier ||
    node.object.type === es.Syntax.ThisExpression
  ) {
    let objectName = getObjectName(node);
    let propertyName = getPropertyName(node);
    return { object: objectName, property: propertyName };
  } else {
    return getMemberExpressionString(node.object);
  }
}

/**
 * @returns {String}
 * @param {String} str
 */
function getExportedProperty(str) {
  if (str.startsWith("exports.")) {
    return str.replace("exports.", "");
  } else if (str.startsWith("module.exports.")) {
    return str.replace("module.exports.", "");
  } else if (str === "module.exports") {
    // how to detect exports
    return str;
  }
  return null;
}
/**
 * @returns {Boolean} Returns true if MemberExpression itself or its object is computed, false otherwise
 * @param {Node} node
 */
function isComputedMemberExpressionChild(node) {
  if (node.type === es.Syntax.CallExpression) {
    return isComputedMemberExpressionChild(node.callee);
  } else if (node.type === es.Syntax.MemberExpression) {
    if (node.computed && node.property.type !== es.Syntax.Literal) {
      return true;
    }
    if (node.object) {
      return isComputedMemberExpressionChild(node.object);
    }
  }
  return false;
}
/**
 * @returns {Boolean} Returns true if MemberExpression itself or its xParent is computed, false otherwise
 * @param {Node} node
 */
function isComputedMemberExpressionParent(node) {
  if (node.type === es.Syntax.CallExpression && node.xParent) {
    return isComputedMemberExpressionParent(node.xParent);
  } else if (node.type === es.Syntax.MemberExpression) {
    if (node.computed && node.property.type !== es.Syntax.Literal) {
      return true;
    }
    if (node.xParent) {
      return isComputedMemberExpressionParent(node.xParent);
    }
  }
  return false;
}

/**
 * @returns {Boolean} Returns true if any part of nested MemberExpression is computed, or false otherwise.
 * @param {Node} node
 */
function isComputed(node) {
  return (
    isComputedMemberExpressionChild(node) ||
    isComputedMemberExpressionParent(node)
  );
}

/**
 * @returns {Boolean} returns true if MemberExpression is exporting, and false otherwise.
 * @param {*} node
 */
function isExport(node) {
  let object = getObjectName(node);
  if (object === "exports" || object === "module") {
    let assignment = astutils.closests(node, es.Syntax.AssignmentExpression);
    if (assignment && assignment.left.type === es.Syntax.MemberExpression) {
      if (object === getObjectName(assignment.left)) {
        return true;
      }
    }
  }
  return false;
}
/**
 * @param {*} node
 */
function getMemberExpressionMeta(node) {
  if (node.type === es.Syntax.CallExpression) {
    if (node.callee.type === es.Syntax.Identifier) {
      let property = getPropertyName(node);
      let computed = isComputed(node);

      return {
        object: node.callee.name,
        property: property,
        computed: computed,
        exported: false,
      };
    }

    return getMemberExpressionMeta(node.callee);
  } else if (node.type === es.Syntax.MemberExpression) {
    if (node.object.type === es.Syntax.Identifier) {
      let property = getPropertyName(node);
      let computed = isComputed(node);
      let exported = false;

      if (
        node.object.name === "exports" ||
        (node.object.name === "module" &&
          node.property.type === es.Syntax.Identifier &&
          node.property.name === "exports")
      ) {
        let assignment = astutils.closests(
          node,
          es.Syntax.AssignmentExpression
        );
        if (assignment && assignment.left.type === es.Syntax.MemberExpression) {
          exported = getObjectName(assignment.left) === node.object.name;
        }
      }

      return {
        object: node.object.name,
        property: property,
        computed: computed,
        exported: exported,
      };
    }
    return getMemberExpressionMeta(node.object);
  }
  return null;
}

exports.getMemberExpressionMeta = getMemberExpressionMeta;
exports.isComputed = isComputed;
exports.isExport = isExport;
exports.getExportedProperty = getExportedProperty;
exports.getMemberExpressionString = getMemberExpressionString;
exports.getObjectName = getObjectName;
exports.getPropertyName = getPropertyName;
