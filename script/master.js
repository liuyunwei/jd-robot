const orders = require("../orders.json").orders;
const debug = require('debug')('index');
const _ = require("underscore");
const {fs} = require("mz");
const {sendMail} = require("./mail.js");
const child_process = require("child_process");
debug.enabled = true;

let seed = Math.random() * 10000 >> 0;

const save = async function(filename, content){
	return await fs.writeFile(`./orders/${filename}`, content).catch(e => debug(`save error:`, e));
}

const render = async function (data){
	if(!render.tpl) {
		render.tpl = await fs.readFile("./order.tpl");
	}
	if(!render.compile) {
		render.compile = _.template(render.tpl.toString());
	}
	try{
		return render.compile(data);

	}catch(e){
		return `template Error, ${JSON.stringify(e)}`;
	}
}

const work = function(order){
	return new Promise((resolve, reject)=>{
		debug(`create a slave for order `, order);
		let slaveStatus = "none";
		const slave = child_process.fork(`${__dirname}/slave.js`);

		slave.send({cmd: "create", args: order}, null, {}, res => {
			slaveStatus = "created";
			debug("slave created:", res);

		});
		slave.on("message", ({cmd, args}) => {
			if(cmd == "done") {
				slaveStatus = "done";
				debug("slave done", args);
				resolve(args);
				slave.kill();
			}
		});
		slave.on("close", (code, signal) => {
			debug("slave close:", code, signal);

			if(slaveStatus !== "done") {
				reject("slave closed but didn't finish the work!!!");
			}
		});


	})
}

const monitor = function(iphone){
	return new Promise((resolve, reject) => {
		debug(`create a slave for monitor `, iphone);
		let slaveStatus = "none";
		const slave = child_process.fork(`${__dirname}/slave.js`);

		slave.send({
			cmd: "monitor", 
			args: {
				target: iphone,
				deadlineTime: 1509087660000,
				sleepTime: 300
			}
		}, 
		null, 
		{}, 
		res => {
			slaveStatus = "created";
			debug("slave created:", res);

		});


		slave.on("message", ({cmd, args}) => {
			if(cmd == "stop") {
				slaveStatus = "done";
				debug("slave done", args);
				resolve(args);
				//slave.kill();
			}
		});
		slave.on("close", (code, signal) => {
			debug("slave close:", code, signal);

			if(slaveStatus !== "done") {
				reject("slave closed but didn't finish the moniting!!!");
			}
		});
	});
}

const start = async function(){

	let promises =  orders.map( async (order, index) =>  {
		let res = null;
		try{
			res = await work(order);
			if(res.status === "SUCCESS") {
					/*
					let content = await render(res);
					
					save(`${seed}.${index}.${res.context.uid}.html`, content);
					sendMail({
						to: `<${order.user.emailAddress}>`,
						subject: `David为您自动抢购的Apple订单信息 ${res.data.orderNumber}，请尽快支付(迟一秒可能晚收货一天)`,
						html: content
					}).catch(e => debug(`email fail:`, order.user.emailAddress));
					*/
					debug(`finnal res:`, res);
			} else {
				debug(`fail in order`, order, res);
			}
		} catch(e) {
			debug(`fail in order`, order, e);
		}

		return res;

	});

	debug(`promises`, promises);
	await Promise.all(promises);
	debug("========== ALL DONE! ===========");
	
}

const bootstrap = async function(useMonitor){
	if(useMonitor) {
		await monitor(orders[0].iphone).catch(e => debug(`Monitor Error`, e));
	}
	await start();
}

module.exports = {
	bootstrap
};

