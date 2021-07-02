const AWS = require('aws-sdk');
const moment = require('moment');

const AWSCredentialsHandler = require('../lib/aws_credentials');

module.exports = (template, config) => {
    return new Promise((resolveModule, rejectModule) => {
        const RDS = new AWS.RDS({region: template.region, credentials: AWSCredentialsHandler(template.profile)});
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
                                res = require('../lib/mysql')(template, false);
                                results.push({
                                    pass: res,
                                    stdout: `Connection ${res ? 'succeeded' : 'failed'}`,
                                    action: {...action, command: 'MySQL Connection'},
                                    instanceId: template.database_id
                                });
                                if (res == true) {
                                    console.log(`✅ Test "${action.name}" Passed`);
                                } else {
                                    console.log(`❌ Test "${action.name}" Failed`);
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
                                console.log(err + "");
                                process.exit();
                            }
                            let lastSnapshot = data.DBSnapshots[0];
                            for (let idx in data) {
                                let snap = data[idx];
                                if (moment(lastSnapshot.SnapshotCreateTime).unix() < moment(snap.SnapshotCreateTime).unix()) {
                                    lastSnapshot = snap;
                                }
                            }
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
                                console.log(`✅ Test "${action.name}" Passed`);
                            } else {
                                console.log(`❌ Test "${action.name}" Failed`);
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
                                console.log(`✅ Test "${action.name}" Passed`);
                            } else {
                                console.log(`❌ Test "${action.name}" Failed`);
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