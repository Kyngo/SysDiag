const MySQL = require('mysql');

module.exports = (template, returnDriver = false) => {
    // if the template does not have a credentials section, we shall stop this method
    if (!template.credentials) {
        return null;
    }
    // we make the sql connection with the driver...
    const con = MySQL.createConnection({
        host: template.credentials.host,
        user: template.credentials.user,
        password: template.credentials.pass,
        database: template.credentials.db
    });

    // and return the connection if it's successful, or null if it's not
    if (!con) {
        return null;
    } else {
        if (returnDriver) return con;
        return true;
    }
}