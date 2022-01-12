const fs = require('fs');
const ini = require('ini');
const YAML = require('yaml');
const { santitizePath } = require('./core');

module.exports = (profile) => {
    // get and parse the configuration file
    const rawConfig = fs.readFileSync(`${__dirname}/../../configs/config.yml`, 'utf-8');
    const config = YAML.parse(rawConfig);

    // do we have any aws credentials thing in the configurations?
    if (config && config.config && config.config.awsCredentialsFile) {
        // we shall look for the credentials file in the file system
        const credentialsFilePath = santitizePath(config.config.awsCredentialsFile);
        if (!fs.existsSync(credentialsFilePath)) {
            throw new Error('File does not exist!');
        }
    
        // the file is in ini format, so we have to parse it
        const rawAwsConfig = fs.readFileSync(credentialsFilePath, 'utf-8');
        const awsConfig = ini.parse(rawAwsConfig);

        // does the profile exist?
        if (!awsConfig[profile]) {
            throw new Error('Profile does not exist!');
        }
    
        // if the profile exists, we will return its credentials
        return {
            accessKeyId: awsConfig[profile].aws_access_key_id,
            secretAccessKey: awsConfig[profile].aws_secret_access_key
        };
    // if there is no credentials in this file, or the file cannot be parsed...
    } else {
        throw new Error('SysDiag Config file corrupted or empty!');
    }
}