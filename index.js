require('dotenv').config();
let request = require("request-promise");
const cookieJar = request.jar();
request = request.defaults({ jar: true, simple: false });
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key
const KrakenClient = require('kraken-api');
const kraken = new KrakenClient(key, secret);
const fs = require('fs');

function timeConverter(UNIX_timestamp){
	var a = new Date(UNIX_timestamp * 1000);
	var year = a.getFullYear();
	var month = a.getMonth();
	var date = a.getDate();
	var hour = a.getHours();
	var min = a.getMinutes();
	var sec = a.getSeconds();
	var time = year + '-' + month + '-' + date + ' ' + hour + ':' + min + ':' + sec ;
	return time;
  }

(async () => {
	// Display user's balance
	try {
		let offset = 0;
		let legers;
		console.log('"txid","refid","time","type","subtype","aclass","asset","amount","fee","balance"');
		do {
			legers = await kraken.api('Ledgers', {
				ofs:offset
			});
			offset += 50;
			for(let leger in legers.result.ledger){
				legerObj = legers.result.ledger[leger];
				let date = timeConverter(legerObj.time);
				let string = `"${leger}","${legerObj.refid}","${date}","${legerObj.type}","${legerObj.subtype}","${legerObj.aclass}","${legerObj.asset}",${legerObj.amount},${legerObj.fee},${legerObj.balance}`;
				console.log(string);
			}
		} while(Object.keys(legers.result.ledger).length > 0);
	} catch (error) {
		console.log(error);
	}
})();

async function main() {
    const resultGet = await request.get("https://www.adjustedcostbase.ca/index.cgi");
    console.log(cookieJar.getCookieString("https://www.adjustedcostbase.ca/index.cgi"));
    const result = await request.post("https://www.adjustedcostbase.ca/index.cgi", {
        jar: cookieJar,
        form: {
            action:'authenticate',
            login:process.env.LOGIN,
            password:process.env.PASSWORD
        }
    }, async function(err, response, body){
        console.log(response.headers);
/*         let trans = await request.get("https://www.adjustedcostbase.ca/index.cgi", {action:"new_transaction", security:"", jar:cookieJar}, (err, response, body) =>
        {
            console.log(body);
        }) */
        let newTransaction = await request.post("https://www.adjustedcostbase.ca/index.cgi", 
        {
            action:"new_transaction",
            security:"BTC",
            jar: cookieJar,
            form:
            {
                "submitted": "1",
                "action": "new_transaction",
                "mode": "",
                "transaction_id": "",
                "security": "BTC",
                "transaction_type": "1",
                "cal_popup": "4/3/2021",
                "year": "2021",
                "month": "4",
                "day": "3",
                "memo": "AWD",
                "amount": "1",
                "total_pershare": "total",
                "shares": "1",
                "strike": "",
                "commission": "1",
                "option_status": "1",
                "cal_popup_options": "4/3/2021",
                "year_options": "2021",
                "month_options": "4",
                "day_options": "3",
                "closing_options_amount": "",
                "closing_options_total_pershare": "total",
                "closing_commission": "",
                "return_redirect": "Add+Transaction+and+Return+to+New+Transaction+Form"
            }
        }, (err, response, body) => {console.log(body);}
        );
        //console.log(trans);
    });
}


main();