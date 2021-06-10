# SystemsTest

Utility to diagnose systems and run recipe-like actions

## Requirements

- Node.js > 10

## Compatibility

- AWS EC2
- AWS RDS (MySQL/MariaDB)

## Features

- Runs commands on servers and expects a possible output
- Reports on PDF
- Sends Slack messages if a channel is configured

## Configuration

Inside the `configs` folder you will be able to add a `config.yml` file with the following format:

```yml
config:
  security:
    certificates_path: /Users/kyngo/Documents/Certificates/
    rds_credentials_path: /Users/kyngo/Documents/Private/rds_credentials/
  slack:
    webhook: https://hooks.slack.com/services/ABCDEF123/ABCDEF123/ABCDEF123
```

You can entirely skip the `slack` section if you do not intend to send reports via this channel. More chat integrations will be coming soon. The `credentials_path` is required as long as you need a certificate to enter a machine via SSH to perform tests (EC2). You can also entirely skip the `rds_credentials_path` if no RDS test is in place.

Within the `configs` folder, you must create a `templates` folder, where you can place all of your recipes. These can be created in YML, just like the configuration file. More formats will be available in the future.

Commands and files can have patterns that can be used to introduce specific strings, like today's date. More details below.

An example template is below:

```yml
template:
  name: My Super EC2 machine cluster
  type: ec2
  region: ap-northeast-1
  tags:
    - name: My Awesome Tag
      value: Some value you place
  auth:
    user: ubuntu
    key: SuperSecretKey.pem
  actions:
    - name: root storage under 80%
      type: command
      command: df -h / | tail -n1 | tr -s " " | cut -f5 -d" " | tr -d "%"
      expected_output:
        type: max_value
        limit: 80
    - name: update os
      type: command
      command: sudo apt update && sudo apt upgrade -y
    - name: cpu usage below 80%
      type: cloudwatch
      metric: CPUUtilization
      expected_output:
        type: below
        value: 80
        measure: percent
    - name: cpu credits above 80 units
      type: cloudwatch
      metric: CPUCreditBalance
      expected_output:
        type: above
        value: 80
        measure: units
    - name: mysql is running
      type: command
      command: sudo systemctl status mysql
      expected_output:
        type: pattern
        value: running
    - name: apache syntax
      type: command
      command: sudo apachectl configtest 2>&1
      expected_output:
        type: match
        value: Syntax OK
    - name: web directories owners
      type: command
      command: ls -l /var/www/ | grep -v apache
      expected_output:
        type: empty
    - name: website code backup
      type: s3-exists
      path: s3://my-awesome-s3-backups-bucket/www/%TODAY%/website.tar.gz
    - name: website database backup
      type: s3-exists
      path: s3://my-awesome-s3-backups-bucket/www/%TODAY%/database.sql
```

## EC2 action types

- name: name of the test
- type: specified the type of test to be run, can be "command", "s3-exists" or "cloudwatch"
  - command: runs an EC2 command
    - expected_output: the kind of output that the system should expect from running this
      - type: can be "empty", "pattern" or "match" or "max_value".
        - empty: nothing is emitted
        - pattern: the system will look for the string you enter in the output, if it exists the test passes
        - match: the system will expect the same thing in the output and in this value, if it does not match, the test fails
        - max_value: numeric values only, if the number exceeds the one given in the config file, the test fails
      - value: the value that the system should expect, can be skipped if type is empty
  - s3-exists: checks if the given file exists
    - path: the path to check
  - cloudwatch: checks a graph in cloudwatch since 7 days ago to the execution moment
    - metric: the CloudWatch metric name to retrieve
    - expected_output: the kind of output that the system should expect from running this
      - type: can be "below" or "above"
      - value: the number to which the system will trigger the error
      - measure: it can be "percent", "gb" or "units" depending on what you would like to check
