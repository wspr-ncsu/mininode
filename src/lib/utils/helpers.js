const es = require('esprima');
const saferegex = require('safe-regex');

/**
 * @returns {String} closest variable_declarator/assignment_expression identifier
 * @param {*} node
 * @param {Function} cb
 */
function VariableAssignmentName (node, cb) {
  if (!node) return cb(null);
  if (node.type === es.Syntax.Program) {
    return cb(null);
  } else if (node.type === es.Syntax.VariableDeclarator) {
    if (node.id.type === es.Syntax.Identifier) {
      return cb(node.id.name);
    }
    if (node.id.type === es.Syntax.ObjectPattern) {
      // todo: detect let {a, b} = require('something')
      let arr = [];
      for (const prop of node.id.properties) {
        if (prop.type === es.Syntax.Property) {
          arr.push(prop.key.name);
        }
      }
      return arr;
    }
  } else if (node.type === es.Syntax.AssignmentExpression) {
    if (node.left.type === es.Syntax.Identifier) {
      return cb(node.left.name);
    } else if (node.left.type === es.Syntax.MemberExpression) {
      // todo: detect object.property = require('something')
      let mexpr = getMemberExpressionString(node.left);
      if (mexpr) return mexpr.object + '.' + mexpr.property;
      else return null;
    }
  }
  if (node.xParent) VariableAssignmentName(node.xParent, cb);
  else return cb(null);
}

/**
 * Detects if AST node creates new scope or not.
 * @returns {Boolean}
 * @param {*} node
 */
function createsNewScope (node) {
  if (!node) console.log(chalk.red(node));
  return node.type === es.Syntax.Program ||
        node.type === es.Syntax.FunctionDeclaration ||
        node.type === es.Syntax.FunctionExpression;
  // || node.type === syntax.ArrowFunctionExpression
}

/**
 * Finds object name of the member expression.
 * @returns {String}
 * @param {MemberExpression} node
 */
function getObjectName (node) {
  if (node.type === es.Syntax.CallExpression) {
    return getObjectName(node.callee);
  } else if (node.type === es.Syntax.Identifier) {
    return node.name;
  } 
  // should I add Literal???
  // else if (node.type === es.Syntax.Literal) {
  //   return node.value;
  // }
  if (node.type !== es.Syntax.MemberExpression) {
    return null;
  } else if (node.object.type === es.Syntax.Identifier) {
    return node.object.name;
  } else if (node.object.type === es.Syntax.ThisExpression) {
    return 'this';
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
function getPropertyName (node) {
  if (node) {
    if (node.type === es.Syntax.MemberExpression) {
      let propertyName = '';
      if (node.property.type === es.Syntax.Identifier) {
        propertyName = node.property.name;
      } else if (node.property.type === es.Syntax.Literal) {
        propertyName = node.property.value;
      }
      let parentProperty = getPropertyName(node['xParent']);
      if (parentProperty) {
        return propertyName + '.' + parentProperty;
      }
      return propertyName;
    } else if (node.type === es.Syntax.CallExpression) {
      return getPropertyName(node['xParent']);
    }
  }
  
  return null;
}

function getMemberExpressionString (node) {
  if (node.type !== es.Syntax.MemberExpression) return null;
  if (node.object.type === es.Syntax.Identifier || node.object.type === es.Syntax.ThisExpression) {
    let objectName = getObjectName(node);
    let propertyName = getPropertyName(node);
    return {object: objectName, property: propertyName};
  } else {
    return getMemberExpressionString(node.object);
  }
}

function closests (node, type) {
  if (!node || node.type === es.Syntax.Program) {
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
 * @returns {String}
 * @param {String} str
 */
function getExportedProperty (str) {
  if (str.startsWith('exports.')) {
    return str.replace('exports.', '');
  } else if (str.startsWith('module.exports.')) {
    return str.replace('module.exports.', '');
  } else if (str === 'module.exports') { // how to detect exports
    return str;
  }
  return null;
}
/**
 * @returns {Boolean} Returns true if MemberExpression itself or its object is computed, false otherwise
 * @param {Node} node 
 */
function isComputedMemberExpressionChild(node) {
  if(node.type === es.Syntax.CallExpression) {
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
  } else if(node.type === es.Syntax.MemberExpression) {
    if (node.computed && node.property.type !== es.Syntax.Literal) {
      return true;
    } else if (node.xParent) {
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
  return isComputedMemberExpressionChild(node) || isComputedMemberExpressionParent(node);
}

/**
 * @returns {Boolean} returns true if regex introduces backtracking
 * @param {String} regex 
 */
function isDangerousRegex(regex) {
  return !saferegex(regex);
}
/**
 * @returns {Boolean} returns true if MemberExpression is exporting, and false otherwise. 
 * @param {*} node 
 */
function isExport(node) {
  let object = getObjectName(node);
  if (object === 'exports' || object === 'module') {
    let assignment = closests(node, es.Syntax.AssignmentExpression);
    if (assignment && assignment.left === node) {
      return true;
    }
  }
  return false;
}
/**
 * 
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
        exported: false
      }
    }
    
    return getMemberExpressionMeta(node.callee);
    
  } else if (node.type === es.Syntax.MemberExpression) {
    if (node.object.type === es.Syntax.Identifier) {
      let property = getPropertyName(node);
      let computed = isComputed(node);
      let exported = false;

      if (node.object.name === 'exports' || (node.object.name === 'module' && node.property.type === es.Syntax.Identifier && node.property.name === 'exports')) {
        let assignment = closests(node, es.Syntax.AssignmentExpression);
        if (assignment && assignment.left.type === es.Syntax.MemberExpression) {
          exported = getObjectName(assignment.left) === node.object.name;
        }
      }
      
      return {
        object: node.object.name, 
        property: property,
        computed: computed,
        exported: exported
      };
    }
    return getMemberExpressionMeta(node.object);
  }
  return null;
}

module.exports.VariableAssignmentName = VariableAssignmentName;
module.exports.createsNewScope = createsNewScope;
module.exports.getObjectName = getObjectName;
module.exports.getPropertyName = getPropertyName;
module.exports.getMemberExpressionString = getMemberExpressionString;
module.exports.closests = closests;
module.exports.closestsNot = closestsNot;
module.exports.getExportedProperty = getExportedProperty;
module.exports.isComputed = isComputed;
module.exports.isDangerousRegex = isDangerousRegex;
module.exports.isExport = isExport;
module.exports.getMemberExpressionMeta = getMemberExpressionMeta;