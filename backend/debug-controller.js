
import { getTrendingStocks } from "./src/services/twelveDataService.js";

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
    try {
        console.log("Simulating controller call...");
        const start = Date.now();
        const result = await getTrendingStocks();
        // Simulate the controller's wait
        await sleep(10000);
        const duration = (Date.now() - start) / 1000;
        
        console.log(`Call finished in ${duration}s`);
        console.log("Result length:", result ? result.length : "null");
        if (result && result.length > 0) {
            console.log("Sample:", result[0].symbol, result[0].current_price);
        } else {
            console.error("Result is empty or null!");
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
})();
