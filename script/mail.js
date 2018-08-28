const nodemailer = require("nodemailer");

const mailTransport = nodemailer.createTransport({
    host : 'smtp.qq.com',
    secureConnection: true, // 使用SSL方式（安全方式，防止被窃取信息）
    auth : {
        user : '827600210@qq.com',
        pass : '*******'
    },
});

const sendMail = async function(options){
	options = Object.assign({
		from: `"刘大卫" <827600210@qq.com>`
	}, options);
	return new Promise((resolve, reject) => {

		mailTransport.sendMail(options, function(err, msg){
	        if(err){
	            console.log(err);
	            reject(err);
	        }
	        else {
	        	console.log(msg);
	            resolve(msg);

	        }
	    });


	});
};
exports.sendMail = sendMail;

