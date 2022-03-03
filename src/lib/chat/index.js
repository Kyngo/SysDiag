const googlechat = require("./googlechat");
const slack = require("./slack")

module.exports = (basicMessage, msgArray, templateName) => Promise.all([
    slack(basicMessage, msgArray, templateName),
    googlechat(basicMessage, msgArray, templateName)
]);