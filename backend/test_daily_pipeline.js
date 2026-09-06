import { runDailyResearchBatch } from './src/jobs/dailyForecastJob.js';

console.log("============================================================");
console.log("    ACUTRADER DAILY PIPELINE BATCH TEST                     ");
console.log("============================================================");
console.log("This will invoke the cron job logic manually to process all");
console.log("configured tickers. Results will be saved to the database");
console.log("and audit artifacts will be created in ml_service.");
console.log("============================================================\n");

import { connectDB } from './src/config/db.js';
import mongoose from 'mongoose';

await connectDB();

runDailyResearchBatch()
  .then(async () => {
    console.log("\n[TEST COMPLETED] Check ml_service/news_audit_artifacts for the batch_summary.json");
    await mongoose.disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error("\n[TEST FAILED] Fatal error in batch:", err);
    await mongoose.disconnect();
    process.exit(1);
  });
