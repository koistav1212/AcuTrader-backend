import { config } from "./config/env.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";
import { initDailyForecastJob } from "./jobs/dailyForecastJob.js";

// Connect to Database
connectDB();

// Initialize scheduled background jobs
initDailyForecastJob();

const server = app.listen(config.port, () => {
  console.log(`AcuTrader API running on http://localhost:${config.port}`);
});

// Handle graceful shutdown for nodemon/pm2
process.on('SIGTERM', () => {
  server.close(() => {
    console.log('HTTP server closed');
  });
});
