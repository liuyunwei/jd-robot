const {bootstrap} = require("./master.js");
const program = require('commander');

program
  .version('0.0.1')
  .option('-m, --monitor', `use a monitor, start when the first iphone online or it's deadline time`)
  .parse(process.argv);

console.log(`monitor mode:`, program.monitor);

bootstrap(!!program.monitor);