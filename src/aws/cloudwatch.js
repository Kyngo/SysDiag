const moment = require('moment');
const AWS = require('aws-sdk');


module.exports = (template, action, namespace) => {
    return new Promise((resolve, reject) => {
        let dimensionName = '';
        switch (namespace) {
            case 'AWS/EC2':
                dimensionName = 'InstanceId';
                break;
            case 'AWS/RDS':
                dimensionName = 'DBInstanceIdentifier';
                break;
            default:
                break;
        }
        const CloudWatch = new AWS.CloudWatch({region: template.region});
        CloudWatch.getMetricData({
            StartTime: moment().subtract(1, 'week').toDate(),
            EndTime: moment().toDate(),
            MetricDataQueries: [{
                Id: 'metric',
                MetricStat: {
                    Stat: 'Average',
                    Period: 300,
                    Metric: {
                        Dimensions: [{
                            Name: dimensionName,
                            Value: template.instance_id
                        }],
                        MetricName: action.metric,
                        Namespace: namespace
                    }
                }
            }]
        }, (err, data) => {
            if (err) {
                resolve(null);
            } else {
                const result = data.MetricDataResults[0];
                if (result == null) {
                    resolve({ pass: false, action, stdout: 'no data' });
                } else {
                    let maxVal = 0;
                    let minVal = Infinity;
                    let avg = 0;
                    // console.log(result.Values);process.exit();
                    for (let idx in result.Values) {
                        const val = result.Values[idx];
                        avg += val;
                        if (maxVal < val) maxVal = val;
                        if (minVal > val) minVal = val;
                    }
                    avg /= result.Values.length;
                    let pass = false
                    let finalVal = 0;
                    switch (action.expected_output.type) {
                        case 'below':
                            if (maxVal < action.expected_output.value) {
                                pass = true;
                                finalVal = maxVal;
                            }
                            break;
                            case 'above':
                            if (minVal > action.expected_output.value) {
                                pass = true;
                                finalVal = minVal;
                            }
                            break;
                        default:
                            finalVal = maxVal;
                            break;
                    }
                    let output = '';
                    switch (action.expected_output.measure) {
                        case 'percent':
                            output = `Max: ${parseFloat(maxVal).toFixed(2)}% - Average: ${parseFloat(avg).toFixed(2)}%`;
                            break;
                        case 'gb':
                            output = `${parseFloat(finalVal / 1024 / 1024 / 1024).toFixed(2)} GB`;
                            break;
                        default:
                            output = `${finalVal} units available`;
                            break;
                    }
                    const final = {
                        pass, finalVal, avg, 
                        instanceId: template.instance_id,
                        stdout: output,
                        action: {...action, command: 'AWS CloudWatch APIs'}
                    };
                    resolve(final);
                }
            }
        });
    })
};
