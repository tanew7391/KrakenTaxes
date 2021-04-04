require('dotenv').config();
let request = require("request-promise");
const cookieJar = request.jar();
request = request.defaults({ jar: true, simple: false });
const key = process.env.KEY; // API Key
const secret = process.env.SECRET; // API Private Key
const KrakenClient = require('kraken-api');
const kraken = new KrakenClient(key, secret);
const fs = require('fs');

const usdConversion = JSON.parse(fs.readFileSync('usdData.json'));

function timeConverter(UNIX_timestamp){
	var a = new Date(UNIX_timestamp * 1000);
	var year = a.getFullYear();
	var month = a.getMonth()+1;
	var date = a.getDate();
	var hour = a.getHours();
	var min = a.getMinutes();
	var sec = a.getSeconds();
	var time = year + '-' + month + '-' + date + ' ' + hour + ':' + min + ':' + sec ;
	return time;
  }


function getUsdAtDate(time){
    let date = new Date(time * 1000);
    date.setHours(0);
    date.setMinutes(0);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return usdConversion[date.getTime() / 1000];
}

let callCounter = 0;
let countDown = setInterval(() => {
    if(callCounter > 0){
        callCounter -= 1;
    }
}, 2000);

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getMostRecentPrice(ticker, time){
    let tradesPrice = null;
    try {
        let prevtime = (time - (1 * 60)) * 1e9;
        do{
            while(callCounter >= 15){
                await sleep(1000);
            }
            let trades = await kraken.api('Trades', {pair:ticker, since:prevtime});
            callCounter++;
            let mostRecentPrice = null;
            //console.log(`Looking for: ${ticker} at time ${time}, prevtime: ${prevtime}`);
            for(let trade of trades.result[Object.keys(trades.result)[0]]){
                //console.log(trade);
                if(trade[2] > time)
                {
                    if(mostRecentPrice){ //if this fails, no most recent price found, must adjust prevTime and run again
                        tradesPrice = mostRecentPrice;
                        //console.log(`Most recent price: ${mostRecentPrice}`);
                    }
                    break;
                }
                mostRecentPrice = trade[0];
            }
            prevtime -= (5*60*1e9);
        } while(tradesPrice === null);
    } catch (error) {
        clearInterval(countDown);
        throw error;
    }
    return tradesPrice;
}

async function timeToPriceCad(ticker, time, price){
    if(ticker === 'ZCAD') return price;
    let tickerMap = new Map();
    tickerMap.set('XXBT', 'XBTCAD');
    tickerMap.set('ZUSD', 'USDCAD');
    tickerMap.set('QTUM', 'QTUMUSD'); //have to convert from usd to cad at same date
    tickerMap.set('XLTC', 'LTCUSD');
    tickerMap.set('ADA', 'ADAUSD');
    tickerMap.set('XETH', 'ETHCAD');
    tickerMap.set('XXDG', 'XDGUSD');
    tickerMap.set('XXRP', 'XRPCAD');
    //TODO: make sure that time is based on OHLC data and not one specific trade, because a whale movement could seriously bias the results
    let newPrice;
    try {
        if(ticker === 'ZUSD'){
            tradesPrice = getUsdAtDate(time);
        } else {
            tradesPrice = await getMostRecentPrice(tickerMap.get(ticker), time);
        }
        newPrice = price * tradesPrice;
        if(ticker === 'QTUM' || ticker === 'XLTC' || ticker === 'ADA' || ticker === 'XXDG'){
            tradesPrice = getUsdAtDate(time);
            newPrice = newPrice/tradesPrice;
        }
    } catch (error) {
        console.log(tickerMap.get(ticker) + ' ' + ticker);
        throw error;
    }
    return newPrice;
}

async function getUserLedger() {
	// Display user's balance
	try {
        await initializeConnection();
		let offset = 0;
		let legers;
		//console.log('"txid","refid","time","type","subtype","aclass","asset","amount","fee","balance"');
        let ledgerArray = [];
 		do {
			legers = await kraken.api('Ledgers', {
				ofs:offset
			});
			offset += 50;
            for(let leger in legers.result.ledger){
                let ledgerObj = legers.result.ledger[leger];
                ledgerArray.push([ledgerObj.time, legers.result.ledger[leger]]);
            }
		} while(Object.keys(legers.result.ledger).length > 0);

        let previousData = null;
        let ledgerObj;

        ledgerArray.sort((a,b) => {
            return a[0] - b[0];
        });
        //console.log(ledgerArray);
        for(let leger of ledgerArray){
            ledgerObj = leger[1];
            console.log(ledgerObj.type);
            let date = timeConverter(ledgerObj.time);
            let feePrice
            if(ledgerObj.fee == 0 && previousData){
                feePrice = await timeToPriceCad(previousData.asset, previousData.time, previousData.fee);
            } else {
                feePrice = await timeToPriceCad(ledgerObj.asset, ledgerObj.time, ledgerObj.fee);
            }
            if(ledgerObj.type === 'transfer'){
                /* let currentPrice = await timeToPriceCad(ledgerObj.asset, ledgerObj.time, ledgerObj.amount);
                if(subtype === 'spottofutures'){
                    await placeTransaction(previousData.asset, ledgerObj.time, 0, previousData.amount, currentPrice, ledgerObj.redid);
                } else if (subtype === 'spotfromfutures'){

                } */
            } else if (ledgerObj.type === 'deposit') {
                console.log('Deposit');
                let currentPrice = await timeToPriceCad(ledgerObj.asset, ledgerObj.time, ledgerObj.amount);
                currentPrice = Math.abs(currentPrice);
                await placeTransaction(ledgerObj.asset, ledgerObj.time, 0, ledgerObj.amount, currentPrice, ledgerObj.redid);
            } else if (ledgerObj.type === 'withdrawal'){

            }else if (previousData && ledgerObj.refid === previousData.refid){
                if(previousData.asset !== 'ZCAD' && ledgerObj.asset !== 'ZCAD'){
                    let currentPrice = await timeToPriceCad(ledgerObj.asset, ledgerObj.time, ledgerObj.amount);
                    currentPrice = Math.abs(currentPrice);
                    await placeTransaction(previousData.asset, ledgerObj.time, feePrice, previousData.amount, currentPrice, ledgerObj.redid);
                    await placeTransaction(ledgerObj.asset, ledgerObj.time, feePrice, ledgerObj.amount, currentPrice, ledgerObj.redid);
                } else if(previousData.asset !== 'ZCAD'){
                    await placeTransaction(previousData.asset, ledgerObj.time, feePrice, previousData.amount, ledgerObj.amount, ledgerObj.redid);
                } else if(ledgerObj.asset !== 'ZCAD'){
                    await placeTransaction(ledgerObj.asset, ledgerObj.time, feePrice, ledgerObj.amount, previousData.amount, ledgerObj.redid);
                }
            }

/*                     console.log(`"${previousData.asset}",${previousData.amount},${feePrice},${currentPrice}`);
                console.log(`"${ledgerObj.asset}",${ledgerObj.amount},${feePrice},${currentPrice}`); */

            previousData = ledgerObj;

            let string = `"${leger}","${ledgerObj.refid}","${date}","${ledgerObj.type}","${ledgerObj.subtype}","${ledgerObj.aclass}","${ledgerObj.asset}",${ledgerObj.amount},${ledgerObj.fee},${ledgerObj.balance}`;
            //console.log(string);
        }
        clearInterval(countDown);
	} catch (error) {
		console.log(error);
	}
}

async function initializeConnection() {
    const resultGet = await request.get("https://www.adjustedcostbase.ca/index.cgi");
    console.log(cookieJar.getCookieString("https://www.adjustedcostbase.ca/index.cgi"));
    const result = await request.post("https://www.adjustedcostbase.ca/index.cgi", {
        jar: cookieJar,
        form: {
            action:'authenticate',
            login:process.env.LOGIN,
            password:process.env.PASSWORD
        }
    });
}

async function placeTransaction(securityType, unixtime, fee, coinAmt, dollarAmt, memo){
    let date = new Date(unixtime * 1000);
    let month = date.getMonth() + 1;
    let year = date.getFullYear();
    let day = date.getDate();
    fee = 0;
    let transactionType = (coinAmt < 0 ? 2 : 1); //2 for selling 1 for buying
    coinAmt = Math.abs(coinAmt);
    let newTransaction = await request.post("https://www.adjustedcostbase.ca/index.cgi", 
        {
            action:"new_transaction",
            security:securityType,
            jar: cookieJar,
            form:
            {
                "submitted": "1",
                "action": "new_transaction",
                "mode": "",
                "transaction_id": "",
                "security": securityType,
                "transaction_type": transactionType,
                "cal_popup": `${month}/${day}/${year}`,
                "year": year,
                "month": month,
                "day": day,
                "memo": memo,
                "amount": dollarAmt,
                "total_pershare": "total",
                "shares": coinAmt,
                "strike": "",
                "commission": fee,
                "option_status": "1",
                "cal_popup_options": `${month}/${day}/${year}`,
                "year_options": year,
                "month_options": month,
                "day_options": day,
                "closing_options_amount": "",
                "closing_options_total_pershare": "total",
                "closing_commission": "",
                "return_redirect": "Add+Transaction+and+Return+to+New+Transaction+Form"
            }
        }, (err, response, body) => {if(err) console.log(err);}
    );
}


//main();
getUserLedger();
//timeToPriceCad('XXBT', 1552745031, 0.03740318);


