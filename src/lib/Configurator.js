/**
 *  @author Igibek Koishybayev
 *  @abstract Responsible for parsing the given arguments and generating the configuration object 
 */
const settings = require('./.settings.json');
const argv = require('yargs').argv;

settings.dryRun = argv.dryRun;
settings.skipReduction = argv.skipReduction;
settings.skipStat = argv.skipStat;
settings.verbose = argv.verbose;
settings.skipRemove = argv.skipRemove;
settings.silent = argv.silent;
settings.compressLog = argv.compressLog;
settings.logOutput = argv.logOutput ? argv.logOutput : settings.logOutput;

if (argv.seeds) {
  let seeds = argv.seeds.split(',');
  console.log('> seeds:', seeds);
  Array.prototype.push.apply(settings.seeds, seeds);
  settings.seeds = [...new Set(settings.seeds)];
}
if (argv.destination) settings.destination = argv.destination;
if (argv.defaultAttackSurface) settings.default_attack_surface = argv.defaultAttackSurface;
if (argv.mode) {
  settings.mode = argv.mode;
}
module.exports = settings;
