const fs = require('fs');
const path = require('path');

const YAML = require('yaml');

const slackbot = require('./lib/slack');

const package = require('../package.json');

const coreConfig = fs.readFileSync(`${__dirname}/../configs/config.yml`, 'utf-8');
if (!coreConfig) {
    console.error(`Missing core configuration file.`);
    process.exit();
}
const config = YAML.parse(coreConfig);

const getConfigFiles = (dir, done) => {
    let results = [];
    fs.readdir(dir, (err, list) => {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach((file) => {
            file = path.resolve(dir, file);
            fs.stat(file, (err, stat) => {
                if (stat && stat.isDirectory()) {
                    getConfigFiles(file, (err, res) => {
                        results = results.concat(res);
                        if (!--pending) done(null, results);
                    });
                } else {
                    if (file.match(/\.yml$/)) {
                        results.push(file);
                    }
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

const parseResults = (results, templateName, callback) => {
    const failedTests = [];
    for (let idx in results) {
        const result = results[idx];
        if (result.pass == 'NO') {
            failedTests.push(`:x: Test \`${result.action.name}\` failed.`);
        }
    }
    if (failedTests.length > 0) {
        slackbot(`Problems emerged when running the "${templateName}" template`, failedTests, templateName).then(() => callback());
    } else {
        callback();
    }
}

const parseFiles = (files, idx = 0) => {
    if (!files[idx]) process.exit(0);
    const templateConfig = fs.readFileSync(files[idx], 'utf-8');
    if (templateConfig) {
        const rawTemplate = YAML.parse(templateConfig);
        if (rawTemplate.template) {
            const { template } = rawTemplate;
            console.log(`📚 Running template "${template.name}" ...\r`);
            switch (template.type) {
                case 'ec2':
                    require('./aws/ec2')(template, config).then((results) => {
                        console.log(`Template "${template.name}" executed\r`);
                        parseResults(results, template.name, () => {
                            parseFiles(files, idx + 1);
                        });
                    });
                    break;
                case 'rds':
                    require('./aws/rds')(template, config).then((results) => {
                        console.log(`Template "${template.name}" executed\r`);
                        parseResults(results, template.name, () => {
                            parseFiles(files, idx + 1);
                        });
                    });
                    break;
                default:
                    console.log(`Unknown type ${template.type}\r`);
                    process.exit();
            }
        } else {
            console.log(`Corrupted template ${files[idx]}\r`);
            process.exit();
        }
    }
}

const sortFiles = (err, files) => {
    if (err) {
        console.error(err);
        process.exit(1);
    }
    const sortedFiles = files;
    sortedFiles.sort((a, b) => {
        const x = a.split('/')[a.split('/').length - 1];
        const y = b.split('/')[b.split('/').length - 1];
        if (x > y) return 1;
        if (y > x) return -1;
        return 0;
    });
    console.log(`Found ${sortedFiles.length} templates. Loading...\r`);
    setTimeout(() => {
        parseFiles(sortedFiles, 0);
    }, 1000);
}

const initialize = () => {
    console.log(`
 ███████╗██╗   ██╗███████╗██████╗ ██╗ █████╗  ██████╗ \r
 ██╔════╝╚██╗ ██╔╝██╔════╝██╔══██╗██║██╔══██╗██╔════╝ \r
 ███████╗ ╚████╔╝ ███████╗██║  ██║██║███████║██║  ███╗\r
 ╚════██║  ╚██╔╝  ╚════██║██║  ██║██║██╔══██║██║   ██║\r
 ███████║   ██║   ███████║██████╔╝██║██║  ██║╚██████╔╝\r
 ╚══════╝   ╚═╝   ╚══════╝╚═════╝ ╚═╝╚═╝  ╚═╝ ╚═════╝ \r
 \r`);
    console.log(`
    - Systems Diagnostics tool - Version ${package.version}\r
    `);
    getConfigFiles(`${__dirname}/../configs/templates`, sortFiles);
}

initialize();