const fs = require('fs');

const AWS = require('aws-sdk');
const moment = require('moment');
const YAML = require('yaml');

const MySQL = require('mysql');

module.exports = (template, config) => {
    return new Promise((resolveModule, rejectModule) => {
        const RDS = new AWS.RDS({region: template.region});
        const results = [];
    
        const exportPdf = () => {
            require('../lib/pdf')(results, template, `rds-${template.region}`).then(() => {
                resolveModule(results);
            }).catch(() => {
                rejectModule(results);
            });
        }
    
        const performTest = (idx = 0, config) => {
            if (!template.actions[idx]) {
                exportPdf();
            } else {
                const action = template.actions[idx];
                switch (action.type) {
                    case 'connection':
                        let res = false;
                        switch (template.engine) {
                            case 'mysql':
                            case 'mariadb':
                                res = require('../lib/mysql')(template, config, false);
                                results.push({
                                    pass: res,
                                    stdout: `Connection ${res ? 'succeeded' : 'failed'}`,
                                    action: {...action, command: 'MySQL Connection'},
                                    instanceId: template.database_id
                                });
                                if (res == true) {
                                    console.log(`✅ Test "${action.name}" Passed\r`);
                                } else {
                                    console.log(`❌ Test "${action.name}" Failed\r`);
                                }
                                performTest(idx + 1, config);
                                break;
                            default:
                                break;
                        }
                        break;
                    case 'snapshot':
                        RDS.describeDBSnapshots({
                            DBInstanceIdentifier: template.database_id
                        }, (err, data) => {
                            if (err) {
                                console.log(err + "\r");
                                process.exit();
                            }
                            const lastSnapshot = data.DBSnapshots[data.DBSnapshots.length - 1];
                            const now = moment().format('YYYY-MM-DD');
                            const snapshotDate = moment(lastSnapshot.SnapshotCreateTime).format('YYYY-MM-DD');
                            let pass = false;
                            if (now == snapshotDate) pass = true;
                            results.push({
                                pass,
                                stdout: `Last snapshot was done on ${snapshotDate}`,
                                action: {...action, command: 'AWS RDS APIs'},
                                instanceId: template.database_id
                            });
                            if (pass == true) {
                                console.log(`✅ Test "${action.name}" Passed\r`);
                            } else {
                                console.log(`❌ Test "${action.name}" Failed\r`);
                            }
                            performTest(idx + 1, config);
                        });
                        break;
                    case 'cloudwatch':
                        template.instance_id = template.database_id;
                        require('./cloudwatch')(template, action, 'AWS/RDS').then((result) => {
                            result.instanceId = template.database_id;
                            results.push(result);
                            if (result.pass == true) {
                                console.log(`✅ Test "${action.name}" Passed\r`);
                            } else {
                                console.log(`❌ Test "${action.name}" Failed\r`);
                            }
                            performTest(idx + 1, config);
                        })
                        break;
                    default:
                        break;
                }
            }
        }
    
        performTest(0, config);
    });
}