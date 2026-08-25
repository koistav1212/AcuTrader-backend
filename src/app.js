// src/app.js
import express from "express";
import cors from "cors";
import morgan from "morgan";

import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import marketRoutes from "./routes/market.route.js";
import newsRoutes from "./modules/news/news.routes.js";
import forecastRoutes from "./modules/forecast/forecast.routes.js";
import researchRoutes from "./modules/research/research.routes.js";

import { errorHandler } from "./middleware/errorHandler.js";
import dns from "dns";
dns.setDefaultResultOrder("ipv4first");

const app = express();

// ------------------------------
// 🔧 Middleware
// ------------------------------
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ------------------------------
// 📌 Health Check
// ------------------------------
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "acu-trader-backend" });
});

import { config } from "./config/env.js";

// ------------------------------
// 📘 Swagger Auto Documentation
// ------------------------------
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "AcuTrader API Documentation",
      version: "1.0.0",
      description: "Professional auto-generated API docs for AcuTrader backend",
    },
    servers: [
      {
        url: config.backendUrl,
        description: "Current Environment Server",
      },
      {
        url: "http://localhost:4000",
        description: "Local Dev Server",
      },
      {
        url: "https://acutrader-backend.onrender.com",
        description: "Production Server",
      },
    ],
  },
  apis: ["./src/routes/*.js"], // Auto scan route files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI at /docs
app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ------------------------------
// 🚀 API Routes
// ------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/market", marketRoutes);
app.use("/api/news", newsRoutes);
app.use("/api/forecast", forecastRoutes);
app.use("/api/research", researchRoutes);

// ------------------------------
// ❌ Global Error Handler
// ------------------------------
app.use(errorHandler);

export default app;
