import { config } from "./config/env.js";
import app from "./app.js";
import { connectDB } from "./config/db.js";

// Connect to Database
connectDB();

app.listen(config.port, () => {
  console.log(`AcuTrader API running on http://localhost:${config.port}`);
});
