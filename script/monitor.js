const request = require("request-promise");
const Emitter = require("events").EventEmitter;
const debug = require('debug');


const system = {
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
};

const monitorOptions = {
	url: 'https://itemko.jd.com/itemShowBtn',
	timeout: 2000,
	method: 'get',
	params: context => ({
		'skuId': context.target.skuId,
		'from': 'pc',
		'_': new Date().getTime()
	})
};

const jsonpToJson = rawRes => JSON.parse(rawRes.replace(/^\s*\w*\(|\)\s*$/g, ''))

class Monitor extends Emitter {

	constructor({target, deadlineTime, sleepTime}){
		super();
		this.jar = request.jar();
		this.request = request.defaults({
			jar: this.jar,
		 	headers: {
		    	'User-Agent': system.userAgent
		  	}
		});
		this.context = {
			target,
			deadlineTime,
			sleepTime
		};
		this.debug = debug(`monitor:${this.context.target.product}`);
		this.debug.enabled = true;
		this.options = {};
		for(let key in monitorOptions){
			let value = monitorOptions[key];
			this.options[key] = value instanceof Function ? value.call(this, this.context): value;
		}

		this.signal = "stop";
		this.isOnLine = false;
		
	}

	async start(){
		this.emit("start");
		if(this.isOnLine) {
			this.emit("online");
			return "online";
		}

		this.signal = "start";
		while(this.signal === "start") {
			try{
				if(this.isOverDeadLine()){
					this.emit("deadline");
					this.stop();
					return "deadline";
				}
				this.debug(`\n\n\n ============fetching===========\n`);
				const res = await this.fetchStatus();
				if(res === "online") {
					this.isOnLine = true;
					this.emit("online");
					this.stop();
					return "online";
				} else if (res === 'error') {
					this.debug(`fetch status response is not ok, try again`);
					this.emit("error");
					continue;
				}	
			}catch(e){
				this.debug(`fetch status error:`, e);
				this.emit("error");
				continue;
			}
			await this.sleep();
		}
		this.stop();
		return null;;
	}
	async fetchStatus(){
		this.debug(`fetch status `, this.options);

		const {url, method, headers, params, timeout} = this.options;

		const rawRes = await this.request({
			url, method, headers,
			[method == "post" ? "form": "qs"]: params
		});
		this.debug('rawRes:',rawRes);
		const res = jsonpToJson(rawRes);
		// jQuery5045109({"type":"3","state":"12","st":1508868188,"en":1509465350,"url":"//divide.jd.com/user_routing?skuId=3133857&sn=96ecf4104399de0c865ce3d554983686&from=pc"})
		if(res && res.state) {

			if(res.state == 12) {
				// bingo
				return "online";
			} else {
				// 暂未发售
				return "offline";
			}
		} else {
			// error 
			return "error";
		}

	}
	async sleep(){
		this.debug(`sleep for ${this.context.sleepTime} ms`);
		return new Promise( resolve => {
			setTimeout(resolve, this.context.sleepTime || 0);
		});
	}

	stop(){
		this.emit("stop");
		this.signal = "stop";
	}
	
	isOverDeadLine() {
		if(!this.context.deadlineTime) {
			debug(`this is no deadlineTime`);
			return false;
		}
		const now = new Date().getTime();
		this.debug(`now: ${now}, deadline: ${this.context.deadlineTime}`);
		return now >= this.context.deadlineTime;
	}

}
/*
async function  test(){
	const  monitor = new Monitor({
		target: {
			product: 'MNFQ2CH/A'
		},
		deadlineTime: new Date().getTime() + 10000,
		sleepTime: 1000
	});
	monitor.on("online", e => console.log("[ONLINE]"));
	monitor.on("start", e => console.log("[START]"));
	monitor.on("error", e => console.log("[ERROR]"));
	monitor.on("deadline", e => console.log("[DEADLINE]"));

	const res = await monitor.start();

	console.log(`finnal result is:`, res);
}
test();

*/
module.exports = Monitor;