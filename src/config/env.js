import dotenv from "dotenv";
dotenv.config();

export const config = {
  port: process.env.PORT || 4000,
  dbUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  alphaKey: process.env.ALPHA_VANTAGE_KEY,

  twelveKey: process.env.TWELVEDATA_KEY,
  mongoUri: process.env.MONGO_URI
};
