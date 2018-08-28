const request = require("request-promise");
const Emitter = require("events").EventEmitter;
const debug = require('debug');
const FileCookieStore = require('tough-cookie-filestore');
const md5 = require("md5");
const fs = require("fs");
const cheerio = require("cheerio");
const iconv = require("iconv-lite");;
const {JSEncrypt} = require('./jdencrypt.js');
const {apiOcr} = require('./ocr.js');

//request.debug = true;
const system = {
	userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.100 Safari/537.36"
};

const jsonpToJson = rawRes => JSON.parse(rawRes.replace(/^\s*\w*\(|\)\s*$/g, ''))

const actions = {
	addAddress: {
		url: 'http://easybuy.jd.com/address/addAddress.action',
		method: 'post',
		headers:{
			'Referer':'http://easybuy.jd.com/address/getEasyBuyList.action',
			'X-Requested-With':'XMLHttpRequest',
			'Host':'easybuy.jd.com',
			'Origin':'http://easybuy.jd.com',
			'Pragma':'no-cache',
			'Accept':'text/plain, */*; q=0.01',
			//'Accept-Encoding':'gzip, deflate',
			//'Accept-Language':'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4',
			'Cache-Control':'no-cache'
		},
		params: context => Object.assign({}, context.user.address),
		parser: function(rawRes){
			const result = {
				addressId: rawRes.match(/addressId=\"(\d+)\"/)[1]
			};
			this.context.session.addressId = result.addressId;
			return result;
		}

		/**
		 * 
             id="hid_upArea_336728319"
             addressId="336728319"
             isOldAddress="false"
             isMapping="false"
             newProvinceId="0"
             newCityId="0"
             newCountyId="0"
             newTownId="0" 
             newProvinceName=""
             newCityName=""
             newCountyName=""
             newTownName="" />
					             
		 */
	},
	setAddressAllDefaultById:{
		url: 'http://easybuy.jd.com/address/setAddressAllDefaultById.action',
		method: 'post',
		params: context => {
			addressId: context.session.addressId
		}
	},
	savePayment: {
		url: 'http://easybuy.jd.com/address/savePayment.action',
		method: "post",
		params: context => ({
			addressId: context.session.addressId,
			paymentId: (context.user.paymentId || 1), // 4: 在线支付  1:货到付款
			pickId:0,
			pickName:''
		})
	},


	getLoginToken: {
		url: `https://passport.jd.com/uc/login`,
		method: "get",
		parser: function(rawRes) {
			const $ = cheerio.load(rawRes);

			const result = {
	            uuid:$('#uuid').val(),
	            eid:$('#eid').val(),
	            fp:$('#sessionId').val(),
	            _t:$('#token').val(),
	            loginType:$('#loginType').val(),	           
	            pubKey:$('#pubKey').val(),
	            sa_token:$('#sa_token').val(),
	            seqSid:""
	        };
	        this.context.session.loginParams = result;
	        this.context.session.autoCodeImageUrl = `https:${decodeURIComponent($('#JD_Verification1').attr('src2'))}&yys=${new Date().getTime()}`
	        return result;
		}
		/**
		 * refer ./refers/login.html
		 */
	},
	getAuthCode:{
		url: 'https://passport.jd.com/uc/showAuthCode?r=0.17764569108996286&version=2015',
		method: 'post',
		params: context => ({
			loginName: context.user.passport.name
		}),
		parser: async function(rawRes){
			

			let authcode = '';
			
			const jsonstr = rawRes.replace(/^\(|\)$/g, "");
			const result = JSON.parse(jsonstr);
			this.debug('-------------', result);
			
			
			if(result.verifycode){
				let buffer = await this.request({
					url: this.context.session.autoCodeImageUrl,
					method: "get",
					encoding: null,
					headers: {
						'Accept':'image/webp,image/apng,image/*,*/*;q=0.8',
						'Accept-Encoding':'gzip, deflate, br',
						'Accept-Language':'en-US,en;q=0.8,zh-CN;q=0.6,zh;q=0.4',
						'Host':'authcode.jd.com',
						'Referer':'https://passport.jd.com/uc/login'
					}
				});
				
	

				const base64Img =  buffer.toString('base64');
				fs.writeFileSync(`./authcodes/${this.uid}.html`, `<img src="data:image/png;base64,${base64Img}"/>`);
				const ocrCode = await apiOcr.generalBasic(base64Img, {language_type:'ENG'});
				this.debug("ocrCode:", ocrCode);
				authcode = ocrCode.words_result.length > 0 && ocrCode.words_result[0].words.replace(/./g, function(c){
					if(c.match(/[0-9A-Za-z]/)) {
						return c;
					} else {
						return "";
					}
				}) || "";
	
			}
			this.context.session.loginParams.authcode = authcode;
			
			return {
				authcode: authcode
			}


		},
		loop: (context, lastRes) => lastRes.authcode.match(/^[a-z0-9A-Z]{4}$/)
		/**
		 * ({"verifycode":true})
		 */
	},
	doLogin: {

		url: (context, lastRes) => `https://passport.jd.com/uc/loginService?uuid=${context.session.loginParams.uuid}&r=${Math.random()}&version=2015`,
		method: "post",
		params: function(context, lastRes) {
			const getEntryptPwd = function(pwd){
				const pubKey = context.session.loginParams.pubKey;
				const encrypt = new JSEncrypt();
		        encrypt.setPublicKey(pubKey);
		        return encrypt.encrypt(pwd);
			};
			return Object.assign({}, context.session.loginParams, {
				authcode: this.context.session.loginParams.authcode,
	            chkRememberMe:"on",
		        loginname: this.context.user.passport.name,
		        nloginpwd:getEntryptPwd(this.context.user.passport.pwd),

            });
        },
        parser: jsonpToJson,
        loop: (context, res) => !res.success,
        jump: "getLoginToken"

	},
	checkLogin: {
		url: `https://passport.jd.com/loginservice.aspx?method=Login&callback=jsonpLogin&_=${new Date().getTime()}`,
		method: 'get',
		headers: {
			'Accept':'*/*',
			'Accept-Encoding':'gzip, deflate, br',
			'Accept-Language':'zh-CN,zh;q=0.8,en;q=0.6,zh-TW;q=0.4',
			'Cache-Control':'no-cache',
			'Referer':'https://www.jd.com/'
		},
		parser: rawRes => JSON.parse(rawRes.replace(/^jsonpLogin\(|\)$/g, ''))
	},

	getAddress: {
		url: context => `https://marathon.jd.com/async/getUsualAddressList.action`,
		method: 'get',
		encoding: null,
		params: context => ({
			skuId: context.iphone.skuId
		}),
		parser: function(rawRes){
			rawRes = iconv.decode(new Buffer(rawRes), "gbk");
			this.debug(`decode res:`, rawRes);
			const list = JSON.parse(rawRes);
			const address = list[0];
			this.context.session.serverAddress = address;
			return address;
		}
	},
	itemShowBtn: {
		url: context => `https://itemko.jd.com/itemShowBtn`,
		method:"get",
		params: context => ({
			skuId: context.iphone.skuId,
			from: 'pc',
			_: Date.now()
		}),
		parser: jsonpToJson,
		loop: (context, res) => res.state != 12
	},
	gotoBuy: {
		url: (context, lastRes) => `https:${lastRes.url}`,
		method: 'get',
		//followRedirect: false,
		//resolveWithFullResponse: true,
		headers: {
			'Host':'divide.jd.com',
			'Pragma':'no-cache',
			'Referer':'https://marathon.jd.com/koFail.html',
			'Upgrade-Insecure-Requests':1
		},
		parser: function(rawRes){
			const $ = cheerio.load(rawRes);
			const vid = $("#vid").val();
			this.context.session.vid = vid;
			return {
				vid
			};
		}
	},
	redirect: {
		url: (contest, lastRes) => lastRes.url,
		method: 'get',
		followRedirect: false,
		resolveWithFullResponse: true,
		parser: res => {
			console.log("~~~~~~~~~~~~~~~~~~~~~~~~",res.headers.location);
			return {
				url: res.headers.location
			}
		}
	},
	readHtml: {
		url: (contest, lastRes) => lastRes.url,
		method: 'get',
		followRedirect: false,
		parser: rawRes => {
			console.log("~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~",rawRes);
			return rawRes;
		}
	},
	submitOrder: {
		url: (context, lastRes) => `https://marathon.jd.com/seckill/submitOrder.action?skuId=${context.iphone.skuId}&vid=${context.session.vid}`,
		method: 'post',
		params: (context, lastRes) =>({
			"eid": "MYNGVGBXNVBV3B74ZDY5GY5BNYGJG7B7NCYPSKBQL5JYOCJIP5PYLSTIT44XDRWGS2ZT7RAWG3XSL23PB5D2GNVR2I",
			'fp': "54f362d87bd8db52b09b5ed2218b8bc0",
			'skuId': context.iphone.skuId,
			'num':context.iphone.quantity,
			"orderParam.name": context.session.serverAddress["name"],
			"orderParam.addressDetail": context.session.serverAddress["addressDetail"],
			"orderParam.mobile":context.session.serverAddress["mobileWithXing"],
			"orderParam.email":context.session.serverAddress["email"],
			"orderParam.provinceId":context.session.serverAddress["provinceId"],
			"orderParam.cityId":context.session.serverAddress["cityId"],
			"orderParam.countyId":context.session.serverAddress["countyId"],
			"orderParam.townId":context.session.serverAddress["townId"],
			"orderParam.paymentType": context.user.paymentId || 4,
			"orderParam.password":"",
			"orderParam.invoiceTitle":4,
			"orderParam.invoiceContent":1,
			"orderParam.invoiceCompanyName":"",
			"orderParam.invoiceTaxpayerNO":"",
			"orderParam.usualAddressId": context.session.serverAddress["id"],
			"orderParam.provinceName":context.session.serverAddress["provinceName"],
			"orderParam.cityName":context.session.serverAddress["cityName"],
			"orderParam.countyName":context.session.serverAddress["countyName"],
			"orderParam.townName":context.session.serverAddress["townName"],
			"orderParam.codTimeType":3,
			"orderParam.mobileKey":context.session.serverAddress["mobileKey"]

		})
	}



};




class Client extends Emitter {
	/**
	 * 
	 * 
	 * 
	 * 	{
			iphone: {dimensionColor, dimensionScreensize, product, dimensionCapacity, detailUrl, name, quantity },
			user:{
				lastName, firstName, invoiceHeader, 
				emailAddress, daytimePhoneAreaCode, daytimePhone,
				state, city, district, street, street2, postalCode,
			}

		}
	 */
	constructor({
		iphone, user
	}){

		super();
		this.uid = md5(JSON.stringify({user}));
		this.debug = debug(`client-${this.uid}`);
		this.debug.enabled = true;
		this.context = {
			uid: this.uid,
			iphone,
			user,
			system,
			session: {}
		};
		this.maxTryTimes = 1;

		this.actions = {
			login: ['getLoginToken', 'getAuthCode', 'doLogin'],
			address: ['addAddress', 'setAddressAllDefaultById', 'savePayment'],
			buy: [ 'itemShowBtn','gotoBuy', 'getAddress', 'submitOrder']

		};
		for(let key in this.actions) {
			this[key] = async actions => await this.start(this.actions[key]);
		}

		this.lazyLogin = async function(as) {
			const cookies = this.jar.getCookies("https://passport.jd.com");
			const isLogin = !!cookies.find(cookie => cookie.key == "thor");
			this.debug(`cookies`, cookies);
			if(!isLogin){
				return await this.login(as);
			}
			return {
				status: "SUCCESS"
			};
		}

		this.cookieFileName = `./cookies/${this.uid}.json`;
		if(!fs.existsSync(this.cookieFileName)) {
			fs.writeFileSync(this.cookieFileName, '');
		}
		this.jar = request.jar(new FileCookieStore(this.cookieFileName));
		//this.jar = request.jar();
		this.request = request.defaults({
			jar: this.jar,
			timeout: 5000,
			simple: false,
		 	headers: {
		    	'User-Agent': system.userAgent
		  	}
		});

		this.debug(`uid:${this.uid}`);
		console.log(`context:`, this.context);

	}

	async start(seqActions){
		seqActions = seqActions.concat();
		const startTime = new Date();
		let context = this.context, lastRes = null, lastStep = null;


		// apply the actions one by one
		for(let actionName of seqActions) {
			this.debug(`========================= processing the step: [${actionName}] ==================`);

			if(actionName == "delay") {
				await new Promise(resolve => {
					setTimeout(resolve, 2000);
				});
				continue;
			}

			let action = actions[actionName];
			let step = action;



			// action support both thunk function and value
			if(action instanceof Function) {
				step = action.bind(this).call(this, context, lastRes);
			}

			context.currentActionName = actionName;
			context.currentStep = step;

			// all this attr support both thunk function and value
			for(let attrName of ["url", "method", "params","headers"]) {
				let attr = step[attrName];
				if(attr instanceof Function) {
					step[attrName] = attr.bind(this).call(this, context, lastRes);
				}
			}
			step.tryTimes = 0;
			const thunkRequest = (async function(){
				// send a request
				const {url, method, params, headers, followRedirect, resolveWithFullResponse, encoding} = step;
				this.debug(`request:`, step);
				const rawRes = await this.request({
					url, method, headers,followRedirect, resolveWithFullResponse, encoding,
					[method == "post" ? "form": "qs"]: params

				});
				
				console.log(actionName, rawRes);


				// use parser to parse  rawRes
				lastRes =  step.parser? await step.parser.call(this, rawRes): rawRes;
				lastStep = step;
			}).bind(this);
			let shouldLoop = true;
			while(shouldLoop || step.tryTimes++ < this.maxTryTimes) {
				try{
					await thunkRequest();
					const {loop, jump} = step;
					 
					if(loop instanceof  Function && loop.bind(this)(context, lastRes)) {
						// loop 
						if(jump) {
							const oldActions = seqActions.concat();
							const newActions = oldActions.splice(oldActions.indexOf(jump));
							return await this.start(newActions);
						} else {
							shouldLoop = true;
						}
					} else {
						break;
					}
					
				} catch(e) {
					shouldLoop = false;
					this.debug(`>>>>>>>>>>>>>>>>> ERROR in action [${actionName}] <<<<<<<<`, e);
					if(step.tryTimes >= this.maxTryTimes - 1) {
						if(step.skipAble) {
							this.debug(">>>>>>>>>> FAIL in action [${actionName}], but skippable, SKIP it!!! <<<<<<<<", e);
						} else {
							this.debug(`>>>>>>>> FAIL in action [${actionName}] <<<<<<<<<`, e);
							throw new Error({
								e: e
							});
						}

					} else {
						this.debug(`trying again: ${step.tryTimes+1} times`);
					}
				}
			}

			context.lastRes = lastRes;
			context.lastStep = lastStep;
			this.debug(`-----------------------  the step end: [${actionName}] ----------------------\n\n\n`);
		}

		const costTime = Math.ceil((new Date() - startTime)/1000);
		this.debug(`cost: ${costTime}s`);

		return {
			status: lastRes ? "SUCCESS": "FAIL",
			data: lastRes,
			context: this.context
		};

	}
	/**
	 * @param  {string} rawRes ,the resopnse body, maybe a string or stringBuffer
	 * @return {null}
	 */
	parseCookies(rawRes){
		
		rawRes = rawRes+"";

		let matches = rawRes.match(/http-equiv="Set-Cookie" content=\"(.+)\"/);
		if(matches && matches[1]) {
			let cookieString = matches[1];
			this.debug("find a cookie:", cookieString);
			
			let cookie = this.request.cookie(cookieString);
			this.jar.setCookie(cookie, this.context.currentStep.url);
		}
		
	}

}


module.exports = Client;
