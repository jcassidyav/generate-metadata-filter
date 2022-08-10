const path = require('path')
const test = require('ava')
process.chdir(path.dirname(test.meta.file.substring("file://".length)).replace("C:/",""));