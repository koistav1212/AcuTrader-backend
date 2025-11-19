import { config } from "./config/env.js";
import app from "./app.js";

app.listen(config.port, () => {
  console.log(`AcuTrader API running on http://localhost:${config.port}`);
});
