const pdf = require("pdf-creator-node");
const moment = require('moment');

module.exports = (results, template, filenamePrefix) => new Promise((resolve, reject) => {
    // the raw html template for the pdf file
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
        <head>
            <mate charest="utf-8" />
            <title>Systems Test Diagnostics Report</title>
        </head>
        <body>
            <h1 style="margin:0px;">Systems Diagnostics</h1>
            <p>Template: <b>${template.name}</b></p>
            <p>Export date: ${moment().format(`YYYY-MM-DD HH:mm:ss`)}</p>
            <!--TESTSTABLE-->
            {{#each tests}}
            <table border="1" style="width:100%;">
                <tr>
                    <th colspan="100" style="background-color:#ddd">Test "{{this.action.name}}"</th>
                </tr>
                <tr>
                    <td style="width:15%;background-color:#ddd;">Instance ID</td>
                    <td>{{this.instanceId}}</td>
                </tr>
                <tr>
                    <td style="width:15%;background-color:#ddd;">Type</td>
                    <td>{{this.action.type}}</td>
                </tr>
                <tr>
                    <td style="width:15%;background-color:#ddd;">Passed</td>
                    <td style="background-color:{{this.resultcolor}};">{{this.pass}}</td>
                </tr>
                <tr>
                    <td style="width:15%;background-color:#ddd;">Command</td>
                    <td>{{this.action.command}}</td>
                </tr>
                <tr>
                    <td style="width:15%;background-color:#ddd;">Result</td>
                    <td><pre style="font-family:monospace">{{this.stdout}}</pre></td>
                </tr>
            </table>
            <br/>
            {{/each}}
        </body>
    </html>
    `;

    // color formatting for the result cells
    for (let idx in results) {
        if (results[idx].pass == true) {
            results[idx].pass = 'YES';
            results[idx].resultcolor = '#c7ffc7';
        } else {
            results[idx].pass = 'NO';
            results[idx].resultcolor = '#ffc7c7';
        }
    }

    // sorting the tests alphabetically
    results.sort((a,b) => {
        const x = a.action.name.toUpperCase();
        const y = b.action.name.toUpperCase();
        return (x < y) ? -1 : (x > y) ? 1 : 0;
    });

    // document config variables
    const document = {
        html: htmlTemplate,
        data: {
            tests: results
        },
        path: `./results/${template.name.replace(/\s/g, '-').replace(/\//g, '-').replace(/\-\-*/, '-').toLowerCase()}.${filenamePrefix}.pdf`
    };

    const options = {
        format: "A3",
        orientation: "portrait",
        border: "10mm",
        header: {
            height: "10mm",
            contents: '<div style="text-align: center;"><span style="float:right">Page {{page}} of {{pages}}</span></div>'
        }
    };

    // pdf export
    pdf.create(document, options)
    .then(res => {
        console.log(`PDF successfully exported`);
        resolve();
    })
    .catch(error => {
        console.error(error)
        resolve();
    });
});