
import { getTrendingStocks } from "./src/services/twelveDataService.js";

(async () => {
    console.log("Fetching trending stocks...");
    const stocks = await getTrendingStocks();
    console.log("Stocks fetched:", stocks.length);
    if (stocks.length > 0) {
        console.log("First stock sample:", JSON.stringify(stocks[0], null, 2));
        console.log("Last stock sample:", JSON.stringify(stocks[stocks.length - 1], null, 2));
    } else {
        console.log("No stocks returned.");
    }
})();
