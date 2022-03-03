const fs = require('fs');
const path = require('path');

const YAML = require('yaml');
const moment = require('moment');

const chat = require('./lib/chat');

const pkgData = require('../package.json');
const { consoleLog, consoleError } = require('./lib/core');

console.log = consoleLog;

console.error = consoleError;

process.on('exit', (code) => {
    if (code != 0) {
        console.error("[!!] Process finished with code " + code);
    }
    if (fs.existsSync(`${__dirname}/../logs/latest.log`)) {
        fs.renameSync(`${__dirname}/../logs/latest.log`, `${__dirname}/../logs/${moment().format('YYYY-MM-DD-HH-mm-ss')}.log`)
    }
});

const coreConfig = fs.readFileSync(`${__dirname}/../configs/config.yml`, 'utf-8');
if (!coreConfig) {
    console.error(`Missing core configuration file.`);
    process.exit();
}
const config = YAML.parse(coreConfig);

const getConfigFiles = (dir, done) => {
    let results = [];
    // lists the recipes directory to look for yaml files
    fs.readdir(dir, (err, list) => {
        if (err) return done(err);
        let pending = list.length;
        if (!pending) return done(null, results);
        list.forEach((file) => {
            // let's make a route of the current path and the folder item
            file = path.resolve(dir, file);
            fs.stat(file, (err, stat) => {
                // is the current folder item a folder too?
                if (stat && stat.isDirectory()) {
                    // let's get the files from that folder as well
                    getConfigFiles(file, (err, res) => {
                        // let's merge the results
                        results = results.concat(res);
                        // if this was the last item to check, let's move on
                        if (!--pending) done(null, results);
                    });
                // or is the current folder item a file?
                } else {
                    // we're looking for yaml files exclusively
                    if (file.match(/\.yml$/)) {
                        results.push(file);
                    }
                    // if this was the last item to check, let's move on
                    if (!--pending) done(null, results);
                }
            });
        });
    });
};

const parseResults = (results, templateName, callback) => {
    const failedTests = [];
    // let's check all the results
    for (let idx in results) {
        const result = results[idx];
        // if the test has failed, we shall add it to the faled tests list
        if (result.pass == 'NO') {
            failedTests.push(`❌ Test \`${result.action.name}\` failed.`);
        }
    }
    // if we have any failed test listed, we will report them on slack
    if (failedTests.length > 0) {
        chat(`Problems emerged when running the "${templateName}" template`, failedTests, templateName).then(() => callback());
    } else {
        callback();
    }
}

const parseFiles = (files, idx = 0) => {
    // does the file exist?
    if (!files[idx]) process.exit(0);
    const templateConfig = fs.readFileSync(files[idx], 'utf-8');
    // if the file has loaded properly, we will proceed
    if (templateConfig) {
        // let's parse this into a proper object we can read
        const rawTemplate = YAML.parse(templateConfig);
        if (rawTemplate.template) {
            const { template } = rawTemplate;
            // some templates can be skipped, this has to be checked prior to their execution
            if (!template.skip) {
                console.log(`📚 Running template "${template.name}" ...`);
                // each template has its own type, depending on what they check
                switch (template.type) {
                    case 'ec2':
                    case 'ssh':
                        // instance type template
                        require('./aws/ec2')(template, config).then((results) => {
                            console.log(`Template "${template.name}" executed`);
                            parseResults(results, template.name, () => {
                                parseFiles(files, idx + 1);
                            });
                        });
                        break;
                    case 'rds':
                        // database type template
                        require('./aws/rds')(template, config).then((results) => {
                            console.log(`Template "${template.name}" executed`);
                            parseResults(results, template.name, () => {
                                parseFiles(files, idx + 1);
                            });
                        });
                        break;
                    default:
                        // unknown template, let's skip it
                        console.log(`Unknown type ${template.type}`);
                        process.exit();
                }
            // if the template has the skip flag enabled, we shall report it on the terminal and attempt reading the next one
            } else {
                console.log(`⏭  Skipped platform ${template.name} - Reason: as specified in template file.`);
                parseFiles(files, idx + 1);
            }
        // if the file cannot be parsed into a proper object, it probably means that the yaml file has a typo, or it's not even a yaml file
        } else {
            console.log(`Corrupted template ${files[idx]}`);
            process.exit();
        }
    }
}

const sortFiles = (err, files) => {
    // if there was any error sorting the files, we will report it and halt
    if (err) {
        console.error(err);
        process.exit(1);
    }
    // we will sort the files alphabetically by the file name itself
    const sortedFiles = files;
    sortedFiles.sort((a, b) => {
        const x = a.split('/')[a.split('/').length - 1];
        const y = b.split('/')[b.split('/').length - 1];
        if (x > y) return 1;
        if (y > x) return -1;
        return 0;
    });
    // finally, we will execute the templates, beginning by the first one
    console.log(`Found ${sortedFiles.length} templates. Loading...`);
    setTimeout(() => {
        parseFiles(sortedFiles, 0);
    }, 1000);
}

const initialize = () => {
    // create the logs folder and make the latest logfile
    if (!fs.existsSync(`${__dirname}/../logs`)) {
        fs.mkdirSync(`${__dirname}/../logs`);
    } else {
        if (fs.existsSync(`${__dirname}/../logs/latest.log`)) {
            fs.rmSync(`${__dirname}/../logs/latest.log`);
        }
    }
    console.log(``);
    console.log(`███████╗██╗   ██╗███████╗██████╗ ██╗ █████╗  ██████╗ `);
    console.log(`██╔════╝╚██╗ ██╔╝██╔════╝██╔══██╗██║██╔══██╗██╔════╝ `);
    console.log(`███████╗ ╚████╔╝ ███████╗██║  ██║██║███████║██║  ███╗`);
    console.log(`╚════██║  ╚██╔╝  ╚════██║██║  ██║██║██╔══██║██║   ██║`);
    console.log(`███████║   ██║   ███████║██████╔╝██║██║  ██║╚██████╔╝`);
    console.log(`╚══════╝   ╚═╝   ╚══════╝╚═════╝ ╚═╝╚═╝  ╚═╝ ╚═════╝ `);
    console.log(``);
    console.log(`   - Systems Diagnostics tool - Version ${pkgData.version} -`);
    console.log(``);
    getConfigFiles(`${__dirname}/../configs/templates`, sortFiles);
}

// logic init handler
initialize();
