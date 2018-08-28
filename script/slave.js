const Client = require("./lib/client.js");
const Monitor = require("./monitor.js");


process.on("message", async ({cmd, args}) => {
	switch(cmd){
		/**
		 * create a instance of Client
		 * start to work in this process
		 * send the result to master
		 */
		case "create":
			let client = new Client(args);
			
			try{
				await client.lazyLogin();
				const result = await client.buy();
				process.send({ cmd: "done", args: result});
			} catch(e) {
				process.send({cmd: "done", args: {
					status: "FAIL",
					data: e
				}});
			}
			return result;
			break;
		case "monitor":
			let monitor = new Monitor(args);
			try{
				const result = await monitor.start();
				process.send({ 
					cmd: "stop",
					args: result
				});
			} catch(e) {
				process.send({
					cmd: "stop",
					args: "error"
				});
			}
			return result;
			break;
		default:
			// do nothing
			break;
	}
});