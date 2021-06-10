const fs = require('fs');

const AWS = require('aws-sdk');
const { NodeSSH } = require('node-ssh');
const moment = require('moment');
const YAML = require('yaml');


module.exports = (template, config) => new Promise((resolveModule, rejectModule) => {const connections = [];
    const instances = [];
    const results = [];
    const actions = template.actions;

    const exportPdf = () => {
        require('../lib/pdf')(results, template,`ec2-${template.region}`).then(() => {
            resolveModule(results);
        }).catch(() => {
            rejectModule(results);
        });
    }

    const parseCommand = (command) => {
        return command.replace('%TODAY%', moment().format('YYYY-MM-DD'));
    }

    const runCommand = (instanceId, config) => new Promise((resolve, reject) => {
        const command = parseCommand(config.command);
        connections[instanceId].execCommand(command, { cwd: '/' }).then((result) => {
            result.stdout = result.stdout.replace(/\\n/g, '\r');
            result.stderr = result.stderr.replace(/\\n/g, '\r');
            // code, signal, stdout, stderr
            if (config.expected_output) {
                switch (config.expected_output.type) {
                    case 'max_value':
                        if (parseInt(result.stdout) <= config.expected_output.limit) {
                            result.pass = true;
                        } else {
                            result.pass = false;
                        }
                        break;
                    case 'match':
                        if (result.stdout == config.expected_output.value) {
                            result.pass = true;
                        } else {
                            result.pass = false;
                        }
                        break;
                    case 'pattern':
                        if (result.stdout.includes(config.expected_output.value)) {
                            result.pass = true;
                        } else {
                            result.pass = false;
                        }
                        break;
                    case 'empty':
                        if (result.stdout == '' && result.stderr == '') {
                            result.pass = true;
                            result.stdout = '* output is empty, as expected *'
                        } else {
                            result.pass = false;
                        }
                        break;
                    default:
                        result.pass = true;
                        break;
                }
            } else {
                result.pass = true;
            }

            if (result.pass == false && config.fix_for_error) {
                runCommand(instanceId, {command: `${config.command} ; ${config.fix_for_error.command}; sleep 5; ${config.command}`, type: 'command', name: `${config.name} - Retry`})
                .then((result) => resolve(result))
                .catch((result) => resolve(result));
            } else {
                resolve(result);
            }
        })
    });

    const scheduleCommands = (instanceId, actionId) => {
        if (!actions[actionId]) {
            connections[instanceId].dispose();
            workOnInstance(instanceId + 1);
        } else {
            const action = actions[actionId];

    
            switch(action.type) {
                case 'command':
                case 's3-exists':
                    if (action.type == 's3-exists') {
                        action.command = `aws s3 ls ${action.path} | tr -s " " | cut -f4 -d" "`;
                        action.expected_output = {type: 'match', value: action.path.split('/')[action.path.split('/').length-1]}
                    }
                    runCommand(instanceId, action).then((result) => {
                        result.action = action;
                        result.instanceId = instances[instanceId].InstanceId;
                        results.push(result);
                        if (result.pass == true) {
                            console.log(`✅ Test "${action.name}" Passed\r`);
                        } else {
                            console.log(`❌ Test "${action.name}" Failed\r`);
                        }
                        scheduleCommands(instanceId, actionId + 1);
                    });
                    break;
                case 'cloudwatch':
                    template.instance_id = instances[instanceId].InstanceId;
                    require('./cloudwatch')(template, action, 'AWS/EC2').then((result) => {
                        results.push(result);
                        if (result.pass == true) {
                            console.log(`✅ Test "${action.name}" Passed\r`);
                        } else {
                            console.log(`❌ Test "${action.name}" Failed\r`);
                        }
                        scheduleCommands(instanceId, actionId + 1);
                    });
                    break;
                default:
                    break;
            }
        }

    }

    const workOnInstance = (id) => {
        if (!instances[id]) {
            exportPdf();
        } else {
            const instance = instances[id];
            
            const instanceIp = instance.PublicIpAddress;
            const username = template.auth.user;
            const key = config.config.security.certificates_path.replace('~', process.env.HOME) + template.auth.key;
            const instanceId = instance.InstanceId;
            connections[id] = new NodeSSH();
            connections[id].connect({
                host: instanceIp,
                username: username,
                privateKey: key,
                port: config.config.security.port || 22
            }).then(() => {
                console.log(`🖥  Connected to ${instanceId} via SSH\r`);
                scheduleCommands(id, 0);
            }).catch((err) => {
                console.log(`Failed to connect to ${instanceId} via SSH\r`);
                console.log(err);
                workOnInstance(id + 1);
            });
        }
    }

    const instanceTags = [];
    
    for (let idx in template.tags) {
        instanceTags.push({ Name: `tag:${template.tags[idx].name}`, Values: [template.tags[idx].value]});
    }

    const region = template.region || 'us-east-1';

    const EC2 = new AWS.EC2({region});
    EC2.describeInstances({Filters: instanceTags}, (err, data) => {
        for (let res in data.Reservations) {
            const reservation = data.Reservations[res];
            for (let ins in reservation.Instances) {
                const instance = reservation.Instances[ins];
                if (instance.PublicIpAddress) {
                    instances.push(instance);
                }
            }
        }

        workOnInstance(0);
    });
});
