const MySQL = require('mysql');

module.exports = (template, returnDriver = false) => {
    if (!template.credentials) {
        return null;
    }
    const con = MySQL.createConnection({
        host: template.credentials.host,
        user: template.credentials.user,
        password: template.credentials.pass,
        database: template.credentials.db
    });

    if (!con) {
        return null;
    } else {
        if (returnDriver) return con;
        return true;
    }
}