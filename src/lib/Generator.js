/**
 * @author Igibek Koishybayev
 * @abstract Generates a code from given AST
 */
const helper = require('./utils/helpers');
const estraverse = require('estraverse');
const escodegen = require('escodegen');
const es = require('esprima');
const fse = require('fs-extra');
const chalk = require('chalk');
const ModuleBuilder = require('./models/ModuleBuilder');
const sloc = require('sloc');

module.exports = function (source, destination) {
  try {
    console.log(chalk.bold('> COPYING:'), source, '->', destination);
    fse.copySync(source, destination);
  } catch (err) {
    console.log(chalk.red(err));
  }
};

/**
 *
 * @param {ModuleBuilder} modul
 */
module.exports.generate = async function (modul, dryRun = false) {
  let currentScope = 0;
  let removedExports = 0, removedFunctions = 0, removedVariables = 0;
  try {
    estraverse.replace(modul.ast, {
      enter: function (node, parent) {
        if (helper.createsNewScope(node)) {
          currentScope += 1;
        }
        switch (node.type) {
          case es.Syntax.FunctionDeclaration:
            if (node.xUsed === false) {
              removedFunctions += 1;
              this.remove();
            }
            break;
          case es.Syntax.VariableDeclarator:
            if (parent && parent.xParent && (parent.xParent.type === es.Syntax.ForInStatement || parent.xParent.type === es.Syntax.ForOfStatement)){
              this.skip();
            } else {
              if (node.xUsed === false) {
                // modul.removedVariables += 1;
                // this.remove();
              }
            }
            break;
          case es.Syntax.Property:
            if (node.xUsed === false) {
              // modul.removedVariables += 1;
              // this.remove();
            }
            break;
        }
      },
      leave: function (node, parent) {
        if (helper.createsNewScope(node)) {
          currentScope -= 1;
          // todo remove scoped 
        }
        switch (node.type) {
          case es.Syntax.ObjectPattern:
            if (node.properties.length < 1) {
              // this.remove();
            }
            break;
          case es.Syntax.VariableDeclarator:
            if (!node.id) {
              // this.remove();
            }
            break;
          case es.Syntax.VariableDeclaration:
            if (node.declarations.length < 1) {
              this.remove();
            }
            break;
          case es.Syntax.ExpressionStatement:
            if (!node.expression) {
              this.remove();
            } else if (node.expression.xUsed === false) {
              removedExports += 1;
              this.remove();
            } 
            // else if (node.expression.xUsed === true) {
            //   let assignment = helper.closests(node, es.Syntax.AssignmentExpression);
            //   if (assignment && assignment.xUsed === false) {
            //     assignment.hasUsed = true;
            //     console.log('>>> HAS USED', modul.name, assignment.left);
            //   }
            // }
            break;
          case es.Syntax.AssignmentExpression:
            if (node.right.type === es.Syntax.AssignmentExpression) {
              if (node.xUsed === false) {
                removedExports += 1;
                return node.right;
              } else {
                if (node.right.xUsed === false) {
                  node.right = node.right.right;
                  removedExports += 1;
                  return node;
                }
              }
            }
            break;
        }
      }
    });
    
    // need to generate potential final source code to calculate reduced LOC
    modul.ast = escodegen.attachComments(modul.ast, modul.ast.comments, modul.ast.tokens);
    let gen = escodegen.generate(modul.ast, {comment: true});
    modul.finalSloc = sloc(gen, 'js').source;
    modul.removedExports = removedExports;
    modul.removedFunctions = removedFunctions;
    modul.removedVariables = removedVariables;
    
    if(!dryRun) {
      if (modul.hashbang) {
        gen = modul.hashbang + '\n' + gen;
      }
      await fse.writeFile(modul.path, gen);
    }
  } catch (error) {
    console.error(chalk.bgRed.bold('ERROR:'), 'generation', modul.path, error);
  }
};
