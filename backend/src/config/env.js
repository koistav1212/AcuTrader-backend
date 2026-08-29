import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  dbUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  alphaKey: process.env.ALPHA_VANTAGE_KEY,

  twelveKey: process.env.TWELVEDATA_KEY,
  mongoUri: process.env.MONGO_URI,
  
  pythonServiceUrl: process.env.PYTHON_SERVICE_URL || "http://localhost:8000",
  backendUrl: process.env.BACKEND_URL || (process.env.NODE_ENV === "production" ? "https://acutrader-backend.onrender.com" : "http://localhost:4000")
};
