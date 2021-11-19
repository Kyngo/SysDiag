const fs = require('fs');

    const logsPath = `${__dirname}/../../logs/latest.log`;

    function santitizeKeyPath(keyPath) {
        return keyPath.replace('~', process.env.HOME).replace('$HOME', process.env.HOME);
    }

    function consoleLog() {
        for (let idx = 0; idx < arguments.length; idx++) {
            process.stdout.write(arguments[idx] + "\r\n");
        }
        log(...arguments);
    }

    function consoleError() {
        for (let idx = 0; idx < arguments.length; idx++) {
            process.stderr.write(arguments[idx] + "\r\n");
        }
        log(...arguments);
    }

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
    santitizeKeyPath,
    consoleError,
    consoleLog
};