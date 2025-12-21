
import yahooFinance from "yahoo-finance2";

const yf = new yahooFinance({ suppressNotices: ['yahooSurvey'] });

(async () => {
    console.log("Testing batch quote...");
    try {
        const symbols = ["AAPL", "NVDA", "INVALID_SYMBOL_XYZ"];
        console.log("Symbols:", symbols);
        // Try passing array directly
        const results = await yf.quote(symbols);
        console.log("Is array?", Array.isArray(results));
        console.log("Length:", results.length);
        results.forEach(r => console.log("Got:", r.symbol));
    } catch (e) {
        console.error("Batch fetch failed/not supported as array input:", e.message);
    }
})();
