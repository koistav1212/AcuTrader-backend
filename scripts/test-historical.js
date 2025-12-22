// scripts/test-historical.js
import { getHistoricalData } from "../src/services/twelveDataService.js";

async function test() {
    console.log("Fetching historical data for AAPL...");
    const data = await getHistoricalData("AAPL");
    
    if (!data) {
        console.error("No data returned!");
        return;
    }
    
    const intervals = ["1d", "1wk", "1mo"];
    intervals.forEach(interval => {
        console.log(`\n--- Interval: ${interval} ---\n`);
        const candles = data[interval];
        if (!candles || candles.length === 0) {
            console.log("No candles found.");
        } else {
            console.log(`Total candles: ${candles.length}`);
            const lastCandle = candles[candles.length - 1];
            console.log("Last candle:", JSON.stringify(lastCandle, null, 2));
            
            // Check indicators
            if (lastCandle.indicators) {
                console.log("Indicators present ✅");
            } else {
                console.error("Indicators missing ❌");
            }
        }
    });
}

test();
