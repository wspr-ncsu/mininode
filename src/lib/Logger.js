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

module.exports = function(level = 'info', filename = 'mininode.log') {
    transports.console.level = level;
    transports.file.level = level;
    transports.file.filename = filename;
    return logger;
}