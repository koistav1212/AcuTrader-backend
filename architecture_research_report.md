# AcuTrader Technical Architecture & Research Report

This document provides a comprehensive analysis of the AcuTrader backend platform, detailing the API structures, Machine Learning layers, database relationships, data specifications, and the technical impact of the synthesized models.

---

## 🏗️ System Architecture & Layer Separation

The application is built on a high-performance **hybrid architecture**, decoupling transactional operations from compute-intensive analytical processing:

1. **API & Transactional Layer (Node.js / Express)**
   - Acts as the primary gateway designed for low-latency operations.
   - **Endpoints:**
     - `/api/auth` & `/api/user` for authentication and user management.
     - `/api/market` for market data feeds (proxying `yahoo-finance2` and Finnhub).
     - Portfolio & Orders (`/buy`, `/sell`), and watchlists management.
2. **Data Persistence Layer (PostgreSQL & Prisma ORM)**
   - Ensures ACID compliance and type safety for financial transactions.
3. **Machine Learning & Analytics Engine (Python)**
   - The heavy-lifting engine responsible for NLP on news feeds, technical indicator crunching, probabilistic forecasting, and automated strategy generation.

---

## 🗄️ Database Relationships & Entity Modeling

The database relies on PostgreSQL mapped via Prisma (`backend/prisma/schema.prisma`). It enforces strict relational constraints:

- **Users (`users`)**: The core entity storing credentials and profile data. It has a **1-to-many** relationship with Holdings, Orders, and Watchlists.
- **Holdings (`holdings`)**: Tracks active portfolio positions. Uses a composite primary key (`[id, user_id]`) linked back to the user. Tracks `symbol`, `quantity`, and `avg_cost`.
- **Orders (`orders`)**: A ledger for all historical trades. Uses composite primary key `[id, user_id]`. Tracks `symbol`, `type` (buy/sell), `quantity`, `price`, and `status`.
- **Watchlists (`watchlists`)**: Tracks stocks monitored by the user.
- **Symbol Catalog (`symbol_catalog`)**: An independent lookup table for stock symbols containing metadata like `exchange`, `type`, and `country`.

---

## 🧠 Machine Learning Layers & Models

The intelligence of the platform is powered by several dedicated ML pipelines, notably the **Forecasting Engine** and the **Credit Card Fraud Detection Engine**.

### 1. Market Forecasting Architecture (Multi-Modal Fusion)
This is an ensemble architecture leveraging 4 distinct models operating in parallel layers:
- **Local Dynamics Layer (XGBoost):** Captures short-to-medium term patterns and numerical technical indicators.
- **Global Context Layer (Ridge Regression):** Acts as a global stabilizer for macro market trends.
- **Temporal News Encoder Layer (LSTM):** 
  - A PyTorch `nn.LSTM` module (`TemporalNewsLSTM`) designed to process sequences of news embeddings.
  - Takes time-series text embeddings and outputs a hidden state representation of the "narrative".
- **Fusion Layer (Logistic Regression):** A meta-learner that fuses the outputs of XGBoost, Ridge, and LSTM to yield final calibrated probabilities.

### 2. Narrative & Sentiment Momentum (Hawkes Transformers)
An institutional-grade NLP pipeline (`acu_hawk.md` & `news_ingest.md`) used for quantifying news impact:
1. **Semantic Similarity & Embeddings:** Uses `all-MiniLM-L6-v2` and **FinBERT** to vectorize raw news and filter out non-financial noise.
2. **Hawkes Process Decay Engine:** Models news arrival intensity. High-impact news creates a "self-exciting shock" that decays exponentially over a half-life, translating text into a mathematical velocity.
3. **Feature Attribution:** Uses **SHAP** (SHapley Additive exPlanations) to calculate the marginal probability shift (e.g., how much exactly did a news article shift the bull/bear case).

### 3. Fraud Detection Dataset & Training (Credit Card Transactions)
The repository contains specialized research (`credit_card_fraud_detection.ipynb`) for transaction monitoring:
- **Dataset Size:** Trained on exactly **284,807 real transactions** executed over two days in September 2013 by European cardholders.
- **Data Shape:** The dataset contains 31 columns: 28 PCA-transformed anonymous features (`V1` to `V28`) + `Time` + `Amount` + `Class`.
- **Class Imbalance:** Highly skewed, with only **0.172% (492)** of transactions being actual fraud.
- **Best Model:** **XGBoost** emerged as the optimal model for this layer.
  - **Performance:** Correctly identified 56,853 legitimate transactions with only 11 false positives (Precision: 88%), while successfully detecting 82 out of 98 actual frauds (Recall: 84%, F1-Score: 86%).

---

## 🚀 Final Output & Technical Impact

### The Output Payload
Instead of serving static chronological news links, the system's final output (the "Engine Synthesis") produces a highly structured JSON intelligence object. It includes:
- **Market Regime Analysis:** Evaluates the state (e.g., `SIDEWAYS_CONSOLIDATION`) and volatility.
- **News Intelligence:** A composite sentiment score with calculated half-life decay hours for dominant catalysts.
- **Signal Attribution:** Explicit marginal contributions (e.g., Technicals: -0.08, Fundamentals: +0.12, News Sentiment: +0.18).
- **Probabilistic Scenarios:** Conformal calibrated confidence outputs for Bull, Base, and Bear scenarios alongside price targets.

### Technical Impact & Paradigm Shift
This architecture represents a massive shift from traditional FinTech backend patterns:
1. **Resilience vs Limits:** It uses clever scraping techniques (`pandas.read_html`) coupled with RSS feeds to bypass expensive API rate limits, while maintaining high signal-to-noise ratio via local Sentence Transformers.
2. **From Heuristics to Probabilities:** It replaces "manual trader eye-balling" and simple moving averages with a **Probabilistic Conformal Scenario Synthesizer**.
3. **Quantified Causality:** By implementing Hawkes processes and SHAP, the system answers *why* a stock is moving, directly attributing a specific % probability shift to an exact real-world event, rather than just showing a generic "positive/negative" badge.
