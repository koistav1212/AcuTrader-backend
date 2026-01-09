
import { searchSymbol } from './src/services/twelveDataService.js';

async function test() {
    console.log("Testing searchSymbol with NVDA...");
    try {
        const result = await searchSymbol("NVDA");
        // console.log("Result:", JSON.stringify(result, null, 2));
        
        if (!result.Stocks || result.Stocks.length === 0) {
            console.error("FAIL: No stocks returned");
            process.exit(1);
        }
        const stock = result.Stocks[0];
        console.log(`Symbol: ${stock.symbol} Name: ${stock.name}`);
        
        // Check for essential fields
        const checks = [
            // Core
            { key: 'current_price', name: "Current Price" },
            { key: 'market_cap', name: "Market Cap" },
            
            // Valuation
            { key: 'enterprise_value', name: "Enterprise Value" },
            { key: 'trailing_pe', name: "Trailing P/E" },
            { key: 'peg_ratio', name: "PEG Ratio" },
            { key: 'price_to_sales', name: "Price/Sales" },
            
            // Financials
            { key: 'profit_margin', name: "Profit Margin" },
            { key: 'return_on_equity', name: "Return on Equity" },
            { key: 'revenue', name: "Revenue" },
            { key: 'total_cash', name: "Total Cash" },
            
            // Analyst
            { key: 'analyst_rating', name: "Analyst Rating" }
        ];

        let fail = false;
        checks.forEach(check => {
            const val = stock[check.key];
            if (val === undefined || val === null || val === "" || val === 0) {
                 // 0 might be valid for some, but unlikely for these giants
                 // Allow 0 for some if really low? No, expected non-zero.
                 // Actually some might be strings "53.01%"
                 console.error(`FAIL: Missing or empty ${check.name} (${check.key})`);
                 fail = true;
            } else {
                 console.log(`OK: ${check.name} = ${val}`);
            }
        });

        if (!fail) {
            console.log("\nSUCCESS: All critical data points found.");
        } else {
            console.log("\nPARTIAL SUCCESS: Some data found, some missing.");
        }
        
    } catch (e) {
        console.error("Test failed with error:", e);
    }
}

test();
