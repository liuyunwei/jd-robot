const orders = require('../orders.json').orders;
const Client = require('./lib/client.js');
(async function(){
	const client = new Client(orders[0]);
	await client.lazyLogin();
	await client.buy();

})();
