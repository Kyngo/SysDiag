const fs = require('fs');

// latest log path
const logsPath = santitizePath(`${__dirname}/../../logs/latest.log`);

// sanitizes the path and makes sure it works for directories
function santitizePath(givenPath) {
    let parsedPath = givenPath.replace('~', process.env.HOME).replace('$HOME', process.env.HOME);
    if (fs.existsSync(parsedPath)) {
        if (fs.lstatSync(parsedPath).isDirectory()) {
            if (parsedPath[parsedPath.lenth - 1] != '/') {
                parsedPath += '/';
            }
        }
    }
    return parsedPath;
}

// override method for console.log
function consoleLog() {
    for (let idx = 0; idx < arguments.length; idx++) {
        process.stdout.write(arguments[idx] + "\r\n");
    }
    log(...arguments);
}

// override method for console.error
function consoleError() {
    for (let idx = 0; idx < arguments.length; idx++) {
        process.stderr.write(arguments[idx] + "\r\n");
    }
    log(...arguments);
}

// logs the given parameters into the log file
function log() {
    if (!fs.existsSync(logsPath)) {
        fs.writeFileSync(logsPath, '');
    }
    for (let idx = 0; idx < arguments.length; idx++) {
        fs.appendFileSync(logsPath, arguments[idx]);
    }
    fs.appendFileSync(logsPath, "\r\n");
}

module.exports = {
    santitizePath,
    consoleError,
    consoleLog
};