const fs = require('fs');
const ini = require('ini');
const YAML = require('yaml');

module.exports = (profile) => {
    const rawConfig = fs.readFileSync(`${__dirname}/../../configs/config.yml`, 'utf-8');
    const config = YAML.parse(rawConfig);

    if (config.config && config.config.awsCredentialsFile) {
        if (!fs.existsSync(config.config.awsCredentialsFile)) {
            throw new Error('File does not exist!');
        }
    
        const rawAwsConfig = fs.readFileSync(config.config.awsCredentialsFile, 'utf-8');
        const awsConfig = ini.parse(rawAwsConfig);
        if (!awsConfig[profile]) {
            throw new Error('Profile does not exist!');
        }
    
        return {
            accessKeyId: awsConfig[profile].aws_access_key_id,
            secretAccessKey: awsConfig[profile].aws_secret_access_key
        };
    } else {
        throw new Error('SysDiag Config file corrupted or empty!');
    }
}