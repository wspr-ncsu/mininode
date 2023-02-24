/**
 * @author Igibek Koishybayev
 * @abstract Generates a code from given AST
 */
const helper = require("./utils/helpers");
const estraverse = require("estraverse");
const escodegen = require("escodegen");
const es = require("espree");
const fse = require("fs-extra");
const chalk = require("chalk");
const ModuleBuilder = require("./models/ModuleBuilder");
const sloc = require("sloc");

module.exports = function (source, destination) {
  try {
    console.log(`[Generator.js] Copying "${source}" into "${destination}"`);
    fse.copySync(source, destination);
  } catch (err) {
    console.log(chalk.red(err));
  }
};

/**
 * @param {ModuleBuilder} modul
 */
module.exports.generate = async function (modul, dryRun = false) {
  console.log(
    `[Generator.js] Traversing the AST to generator code for "${modul.path}"`
  );
  let removedExports = 0,
    removedFunctions = 0,
    removedVariables = 0;
  try {
    estraverse.replace(modul.ast, {
      enter: function (node, parent) {
        switch (node.type) {
          case es.Syntax.FunctionDeclaration:
            if (node.xUsed === false) {
              console.debug(
                `[Generator.js] removing the FunctionDeclaration "${node}"`
              );
              removedFunctions += 1;
              this.remove();
            }
            break;
          case es.Syntax.VariableDeclarator:
            if (
              parent &&
              parent.xParent &&
              (parent.xParent.type === es.Syntax.ForInStatement ||
                parent.xParent.type === es.Syntax.ForOfStatement)
            ) {
              this.skip();
            }
            break;
          case es.Syntax.Property:
            break;
        }
      },
      leave: function (node, parent) {
        switch (node.type) {
          case es.Syntax.ObjectPattern:
            break;
          case es.Syntax.VariableDeclarator:
            break;
          case es.Syntax.VariableDeclaration:
            if (node.declarations.length < 1) {
              console.debug(
                `[Generator.js] removing VariableDeclaration ${node}`
              );
              this.remove();
            }
            break;
          case es.Syntax.ExpressionStatement:
            if (!node.expression) {
              this.remove();
            } else if (node.expression.xUsed === false) {
              removedExports += 1;
              console.debug(
                `[Generator.js] removing ExpressionStatement ${node}`
              );
              this.remove();
            }

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
      },
    });

    // need to generate potential final source code to calculate reduced LOC
    console.debug(`[Generator.js] Attaching comments`);
    modul.ast = escodegen.attachComments(
      modul.ast,
      modul.ast.comments,
      modul.ast.tokens
    );
    console.debug(`[Generator.js] Generating final code for "${modul.path}"`);
    let gen = escodegen.generate(modul.ast, { comment: true });
    modul.finalSloc = sloc(gen, "js").source;
    modul.removedExports = removedExports;
    modul.removedFunctions = removedFunctions;
    modul.removedVariables = removedVariables;

    if (!dryRun) {
      if (modul.hashbang) {
        gen = modul.hashbang + "\n" + gen;
      }
      let changeCount = removedExports + removedFunctions + removedVariables;
      console.debug(
        `[Generator.js] Overwriting "${modul.path}" with new code if there are changes. Total change count: ${changeCount}`
      );
      if (changeCount > 0) {
        await fse.writeFile(modul.path, gen);
      }
    }
  } catch (error) {
    console.error(
      `[Generator.js] Error during code generation for "${modul.path}"`,
      error
    );
  }
};
