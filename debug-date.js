
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance({ suppressNotices: ['yahooSurvey'] });

(async () => {
    try {
        const q = await yf.quote("AAPL");
        console.log("regularMarketTime type:", typeof q.regularMarketTime);
        console.log("regularMarketTime value:", q.regularMarketTime);
        if (q.regularMarketTime instanceof Date) console.log("It is a Date object");
    } catch (e) {
        console.error(e);
    }
})();
