# AcuTrader Backend - Research & Architecture Overview

This document provides a comprehensive overview of the inner workings of the AcuTrader backend. It is designed for research purposes to understand the system's architecture, data flow, layer separation, and intelligent processing modules.

## 🏗 System Architecture

The application is built on a hybrid architecture combining a high-performance **Node.js/Express** transactional layer and a heavy-lifting **Python ML** analytical layer.

### Why this architecture?
Financial platforms require two distinct types of processing:
1. **Low-latency transactional operations:** User authentication, portfolio tracking, and executing trades. Node.js excels at this due to its non-blocking, event-driven architecture.
2. **Compute-intensive analytical operations:** Natural language processing on news feeds, technical indicator crunching, and strategy generation. Python is the industry standard for these tasks, leveraging robust libraries like `pandas`, `sentence-transformers`, and `yfinance`.

---

## 🥞 Layer Breakdown

### 1. API & Transactional Layer (Node.js / Express)
Located in `src/`, this layer acts as the primary gateway for all client requests.
* **Routing & Controllers:** Structured endpoints for Auth (`/api/auth`), User management (`/api/user`), and Market data/Trading (`/api/market`).
* **Portfolio & Order Management:** Handles executing mock trades (`/buy`, `/sell`), tracking holdings, and maintaining watchlists.
* **Market Data APIs:** Acts as a proxy to fetch real-time quotes, trending stocks, and historical data, masking the complexity from the client.
* **Documentation:** Integrates `swagger-jsdoc` and `swagger-ui-express` for auto-generated OpenAPI documentation accessible at `/docs`.

### 2. Data Persistence Layer (Prisma & PostgreSQL)
Located in `prisma/schema.prisma`. It uses Prisma ORM to interact with a PostgreSQL database (often hosted on Supabase based on schema mappings).
* **`users`**: Stores user profiles and encrypted passwords.
* **`holdings`**: Tracks active positions (symbol, quantity, average cost) for each user.
* **`orders`**: Keeps a historical ledger of all trades (buy/sell, price, status).
* **`watchlists`**: Tracks stocks the user is monitoring.
* **Why PostgreSQL + Prisma?** Relational databases are essential for financial applications to ensure ACID compliance (Atomicity, Consistency, Isolation, Durability) when processing trades. Prisma provides a type-safe schema that reduces runtime errors.

### 3. Machine Learning & Analytics Engine (Python)
Located in `ml_service/`. This is the "brain" of the platform, executing complex financial workflows.

* **Intelligent News Ingestion (`news_ingest.py`)**: 
  * *Implementation*: An institutional-grade pipeline that fetches RSS feeds across various providers.
  * *Why?*: Financial news is extremely noisy. This module uses 5 upgrades to extract signal:
    1. **Financial Intent Classifier:** Categorizes articles (e.g., earnings, analyst ratings, corporate actions) and penalizes low-signal noise (like generic filing updates).
    2. **Credibility Weighting:** Ranks sources (e.g., Reuters, WSJ = 5; Benzinga = 2).
    3. **Semantic Similarity Filter:** Uses `sentence-transformers` (`all-MiniLM-L6-v2`) to compare article text embeddings against an ideal financial reference embedding, weeding out non-financial content.
    4. **Noise Blacklist:** Explicitly drops articles about weather, sports, or politics (unless market-moving).
    5. **Category Quotas:** Ensures the final output is a diverse mix of news rather than being flooded by one single event.

* **Automated Strategy Generation (`strategy.py`)**:
  * *Implementation*: Takes raw technical indicators (RSI, MACD, SMAs) and sentiment data, then outputs a structured trading plan.
  * *Why?*: Translates raw data into actionable intelligence. It calculates dynamic support/resistance (using SMA 20/200), interprets momentum (RSI/MACD crossovers), and models both **Conservative** (long-term accumulation) and **Swing** (short-term momentum) scenarios with calculated entry and stop-loss targets.

* **Market Scanning & Scraping (`market_scanner.py`)**:
  * *Implementation*: Bypasses API limits by dynamically scraping the "Most Active" stocks directly from Yahoo Finance using `pandas.read_html` and regex fallbacks.
  * *Why?*: Financial APIs are expensive. Scraping provides a resilient fallback to capture market momentum for free.

---

## 📡 Data Sources

The application relies on a combination of structured APIs and unstructured web data:

1. **Market Data & Fundamentals:**
   * **`yfinance` (Python) / `yahoo-finance2` (Node.js)**: The primary workhorses for fetching stock quotes, fundamental data (P/E ratios), and historical price data.
   * **Finnhub**: Used in the Node.js backend for supplementary market data.

2. **News & Sentiment:**
   * **RSS Feeds**: Specifically targets Google News, Yahoo Finance, Nasdaq, Stocktwits, SeekingAlpha, and Benzinga.
   * *Why RSS?* It provides a standardized, real-time stream of articles without the cost of premium news APIs. The heavy lifting is offloaded to the local ML Semantic filter to ensure quality.

3. **Database:**
   * **PostgreSQL (Supabase/Local)**: Acts as the absolute source of truth for user states, mock portfolios, and order histories.

## 🚀 Conclusion

The AcuTrader backend represents a modern approach to FinTech architecture. By keeping the transaction layer lightweight (Node.js) and decoupling the heavy data-crunching and AI filtering (Python), the platform can serve low-latency requests while still providing institutional-grade analytics and signal generation.
