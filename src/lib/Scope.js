const syntax = require('esprima').Syntax;
class Scope {
  constructor() {
    this.vars = [];
    this.current = -1;
  }

  create() {
    this.current++;
    if (this.vars[this.current]) {
      this.vars[this.current].push([]);
    } else {
      this.vars.push([[]]);
    }
  }

  exit() {
    this.current--;
  }

  push(name) {
    this.vars[this.current][this.vars[this.current].length - 1].push(name);
  }

  isNew(node) {
    if (!node) throw new Error('SCOPE_NODE_IS_NULL');
    return node.type === syntax.Program ||
          node.type === syntax.FunctionDeclaration ||
          node.type === syntax.FunctionExpression;
  }
}

module.exports = Scope;