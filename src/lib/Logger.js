const winston = require("winston");
const transports = {
    console: new winston.transports.Console({ level: 'info'}),
    file: new winston.transports.File({level: 'info', filename: 'mininode.log'})

}
const logger = winston.createLogger({
    format: winston.format.simple(),
    level: 'info',
    transports: [
        transports.console, 
        transports.file
    ]
});

/**
 * Overrides the Global console variables functions. 
 * This will ensure that everytime when console is used it log into a file
 */
console.log = (...args) => logger.info.call(logger, ...args);
console.info = (...args) => logger.info.call(logger, ...args);
console.warn = (...args) => logger.warn.call(logger, ...args);
console.error = (...args) => logger.error.call(logger, ...args);
console.debug = (...args) => logger.debug.call(logger, ...args);

module.exports = function(level = 'info', filename = 'mininode.log') {
    transports.console.level = level;
    transports.file.level = level;
    transports.file.filename = filename;
    return logger;
}