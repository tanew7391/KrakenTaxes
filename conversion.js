require('dotenv').config();
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key
const exchangeApiKey = process.env.EXCHANGEKEY;
const KrakenClient = require('kraken-api');
const kraken = new KrakenClient(key, secret);
const request = require("request-promise");
const fs = require('fs');

function timeConverter(UNIX_timestamp){
	var a = new Date(UNIX_timestamp * 1000);
	var year = a.getFullYear();
	var month = a.getMonth()+1;
	var date = a.getDate();
	var hour = a.getHours();
	var min = a.getMinutes();
	var sec = a.getSeconds();
	return a;
  }

async function getUserLedger() {
	// Display user's balance
	try {
		let offset = 0;
		let legers;
		//console.log('"txid","refid","time","type","subtype","aclass","asset","amount","fee","balance"');
        let historicalData = {};
 		do {
			legers = await kraken.api('Ledgers', {
				ofs:offset
			});
            let result;
			offset += 50;
			for(let leger in legers.result.ledger){
				legerObj = legers.result.ledger[leger];
                let date = new Date(legerObj.time * 1000);
                date.setHours(0);
                date.setMinutes(0);
                date.setSeconds(0);
                date.setMilliseconds(0);
                //console.log(`https://v6.exchangerate-api.com/v6/${exchangeApiKey}/history/USD/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`);
                //console.log(date.getTime() /1000);
                result = JSON.parse(await request.get(`https://v6.exchangerate-api.com/v6/${exchangeApiKey}/history/USD/${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`));
                console.log(result.conversion_rates.CAD);
                historicalData[date.getTime()/1000] = result.conversion_rates.CAD;
            }
		} while(Object.keys(legers.result.ledger).length > 0);
        const data = JSON.stringify(historicalData);

        fs.writeFile('usdData.json', data, (err) => {
            if (err) {
                throw err;
            }
            console.log("JSON data is saved.");
        });
	} catch (error) {
		console.log(error);
	}
}

getUserLedger();