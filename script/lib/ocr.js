var ApiOcr = require("baidu-ai").ocr;




var PORT = 3000;
var APP_ID = '10140339';
var API_KEY = 'neoTgURPEEc2hxqWV00Tvq2S'
var SECRET_KEY = 'Ohd8XkHm9yy8TVDz9LLRd32sDiwj7pGj'



var apiOcr = new ApiOcr(APP_ID, API_KEY, SECRET_KEY);



exports.apiOcr = apiOcr;


/*
   var image = fs.readFileSync('img.jpeg');

   var base64Img = new Buffer(image).toString('base64');

   apiOcr.generalBasic(base64Img).then(function(result){

   console.log( JSON.stringify(result) );
   });

 */
