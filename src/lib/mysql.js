const fs = require('fs');

const YAML = require('yaml');
const MySQL = require('mysql');

module.exports = (template, config, returnDriver = false) => {
    if (!config.config.security.rds_credentials_path) {
        return null;
    }
    const coreCredentials = fs.readFileSync(
        `${config.config.security.rds_credentials_path}/${template.database_id}.yml`,
        'utf-8'
    );
    const credentialsHandler = YAML.parse(coreCredentials);
    const con = MySQL.createConnection({
        host: credentialsHandler.credentials.host,
        user: credentialsHandler.credentials.user,
        password: credentialsHandler.credentials.pass,
        database: credentialsHandler.credentials.db
    });

    if (!con) {
        return null;
    } else {
        if (returnDriver) return con;
        return true;
    }
}