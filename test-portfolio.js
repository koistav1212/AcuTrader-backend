import mongoose from "mongoose";
import dotenv from "dotenv";
import dns from "dns";
import User from "./src/models/user.model.js";
import * as transactionService from "./src/services/transactionService.js";
import * as portfolioService from "./src/services/portfolioService.js";

dns.setDefaultResultOrder("ipv4first");

dotenv.config();

// Hardcoded Standard Connection String to bypass failed SRV lookup
// Retrieved via manual nslookup
const MONGO_URI = "mongodb://localhost:27017"

async function runTests() {
  console.log("Connecting to MongoDB (Standard String)...");
  // console.log(`URI: ${MONGO_URI.replace(/:([^:@]+)@/, ":****@")}`); 
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log("Connected.");
  } catch (err) {
    console.error("Connection Failed Initial Attempt:", err.message);
    // Retry logic or just fail
    throw err;
  }

  try {
    // 1. Create a Test User
    const email = `test_portfolio_${Date.now()}@test.com`;
    const user = await User.create({
      firstName: "Test",
      lastName: "Portfolio",
      email,
      password: "hashedpassword123"
    });
    console.log(`\nCreated Test User: ${user.email} (${user._id})`);

    // 2. Buy Stock (AAPL)
    console.log("\n--- Buying 10 AAPL at $150 ---");
    await transactionService.buyStock(user._id, "AAPL", 10, 150);
    let portfolio = await portfolioService.getUserPortfolio(user._id);
    let aaplHolding = portfolio.holdings.find(h => h.symbol === "AAPL");
    console.log("AAPL Holding:", aaplHolding ? `${aaplHolding.quantity} shares @ $${aaplHolding.avgCost}` : "Not Found");
    if (!aaplHolding || aaplHolding.quantity !== 10) throw new Error("Buy Validation Failed");

    // 3. Buy More Stock (AAPL) - Cost Averaging
    console.log("\n--- Buying 10 AAPL at $200 ---");
    await transactionService.buyStock(user._id, "AAPL", 10, 200);
    portfolio = await portfolioService.getUserPortfolio(user._id);
    aaplHolding = portfolio.holdings.find(h => h.symbol === "AAPL");
    console.log("AAPL Holding:", aaplHolding ? `${aaplHolding.quantity} shares @ $${aaplHolding.avgCost}` : "Not Found");
    // Avg Cost should be (1500 + 2000) / 20 = 175
    if (aaplHolding.avgCost !== 175) throw new Error(`Avg Cost Validation Failed. Expected 175, got ${aaplHolding.avgCost}`);

    // 4. Watchlist Toggle
    console.log("\n--- Toggling Watchlist (TSLA) ---");
    let result = await portfolioService.toggleWatchlist(user._id, "TSLA");
    console.log("Added to Watchlist:", result.inWatchlist);
    if (!result.inWatchlist) throw new Error("Watchlist Add Failed");
    
    result = await portfolioService.toggleWatchlist(user._id, "TSLA");
    console.log("Removed from Watchlist:", result.inWatchlist);
    if (result.inWatchlist) throw new Error("Watchlist Remove Failed");

    // 5. Sell Stock
    console.log("\n--- Selling 5 AAPL at $180 ---");
    await transactionService.sellStock(user._id, "AAPL", 5, 180);
    portfolio = await portfolioService.getUserPortfolio(user._id);
    aaplHolding = portfolio.holdings.find(h => h.symbol === "AAPL");
    console.log("AAPL Holding:", aaplHolding ? `${aaplHolding.quantity} shares` : "Not Found");
    if (aaplHolding.quantity !== 15) throw new Error("Sell Validation Failed");

    // 6. Sell All Remaining
    console.log("\n--- Selling Remaining 15 AAPL ---");
    await transactionService.sellStock(user._id, "AAPL", 15, 190);
    portfolio = await portfolioService.getUserPortfolio(user._id);
    aaplHolding = portfolio.holdings.find(h => h.symbol === "AAPL");
    console.log("AAPL Holding:", aaplHolding ? "Found" : "Correctly Removed");
    if (aaplHolding) throw new Error("Sell All Failed. Holding still exists.");

    // 7. Verify Transactions History (Limit Test)
    // We expect 4 transactions total (Buy 10, Buy 10, Sell 5, Sell 15)
    const transactionsAll = await portfolioService.getTransactions(user._id);
    console.log(`\nTotal Transactions: ${transactionsAll.length}`);
    if (transactionsAll.length !== 4) throw new Error(`Transaction Count Failed. Expected 4, got ${transactionsAll.length}`);

    const transactionsLimit = await portfolioService.getTransactions(user._id, 2);
    console.log(`Limited Transactions (Limit 2): ${transactionsLimit.length}`);
    if (transactionsLimit.length !== 2) throw new Error(`Transaction Limit Failed. Expected 2, got ${transactionsLimit.length}`);

    // 8. Verify Watchlist Fetch
    console.log("\n--- Verifying Watchlist Fetch ---");
    // Ensure one item is in watchlist (we toggled TSLA twice so it's gone, let's add it back)
    await portfolioService.toggleWatchlist(user._id, "TSLA");
    const watchlist = await portfolioService.getWatchlist(user._id);
    console.log("Watchlist Items:", watchlist.map(w => w.symbol));
    if (watchlist.length !== 1 || watchlist[0].symbol !== "TSLA") throw new Error("Watchlist Fetch Failed");

    console.log("\n✅ ALL TESTS PASSED");

    // Cleanup
    await User.deleteOne({ _id: user._id });
    await mongoose.connection.collection("transactions").deleteMany({ user: user._id });
    await mongoose.connection.collection("holdings").deleteMany({ user: user._id });

  } catch (err) {
    console.error("\n❌ TEST FAILED:", err);
  } finally {
    await mongoose.disconnect();
  }
}

runTests();
