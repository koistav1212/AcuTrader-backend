# Comprehensive API Endpoint Verification Report

Testing ALL API endpoints (Auth, User, Legacy Market, New Market Data, Python ML).

## Register User
**Route**: `http://localhost:4000/api/auth/register`
**Method**: `POST`
**Result**: ✅ PASS (Status 201)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhODM3YWEyYTdjMzRkM2ZlNzc4ODIwOCIsImVtYWlsIjoidGVzdF8xNzg3MDAxNTA2QGV4YW1wbGUuY29tIiwiaWF0IjoxNzg3MDAxNTA2LCJleHAiOjE3ODc2MDYzMDZ9.x_VPl57MyJZWeJAtINmJDhTZJQlptSlaU7qbYivLsZU",
  "user": {
    "id": "6a837aa2a7c34d3fe7788208",
    "email": "test_1787001506@example.com",
    "firstName": "Test",
    "lastName": "User"
  }
}
```
---
## Login User
**Route**: `http://localhost:4000/api/auth/login`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhODM3YWEyYTdjMzRkM2ZlNzc4ODIwOCIsImVtYWlsIjoidGVzdF8xNzg3MDAxNTA2QGV4YW1wbGUuY29tIiwiaWF0IjoxNzg3MDAxNTA2LCJleHAiOjE3ODc2MDYzMDZ9.x_VPl57MyJZWeJAtINmJDhTZJQlptSlaU7qbYivLsZU",
  "user": {
    "id": "6a837aa2a7c34d3fe7788208",
    "email": "test_1787001506@example.com",
    "firstName": "Test",
    "lastName": "User"
  }
}
```
---
## Get Current User Profile
**Route**: `http://localhost:4000/api/user/me`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "_id": "6a837aa2a7c34d3fe7788208",
  "firstName": "Test",
  "lastName": "User",
  "email": "test_1787001506@example.com",
  "accountBalance": 100000,
  "initialCapital": 100000,
  "createdAt": "2026-08-17T21:18:26.257Z",
  "updatedAt": "2026-08-17T21:18:26.257Z",
  "__v": 0
}
```
---
## Get Full Portfolio
**Route**: `http://localhost:4000/api/user/portfolio`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "summary": {
    "balance": 100000,
    "equity": 100000,
    "totalUnrealizedPnl": 0,
    "details": []
  },
  "holdings": [],
  "transactions": [],
  "watchlist": []
}
```
---
## Get User Watchlist
**Route**: `http://localhost:4000/api/user/watchlist`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
[]
```
---
## Toggle Watchlist
**Route**: `http://localhost:4000/api/user/watchlist/toggle`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "inWatchlist": true
}
```
---
## Get Transactions History
**Route**: `http://localhost:4000/api/user/transactions`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
[]
```
---
## Buy Stock (User Route)
**Route**: `http://localhost:4000/api/user/buy`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "transaction": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "AAPL",
    "type": "BUY",
    "quantity": 1,
    "price": 150,
    "totalCost": 150,
    "status": "COMPLETED",
    "_id": "6a837aa3a7c34d3fe778821a",
    "date": "2026-08-17T21:18:27.506Z",
    "createdAt": "2026-08-17T21:18:27.506Z",
    "updatedAt": "2026-08-17T21:18:27.506Z",
    "__v": 0
  },
  "position": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "AAPL",
    "side": "LONG",
    "quantity": 1,
    "avg
... [truncated]
```
---
## Sell Stock (User Route)
**Route**: `http://localhost:4000/api/user/sell`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "transaction": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "AAPL",
    "type": "SELL",
    "quantity": 1,
    "price": 155,
    "totalCost": 155,
    "status": "COMPLETED",
    "entryPrice": 150,
    "realizedPnl": 5,
    "_id": "6a837aa3a7c34d3fe7788220",
    "date": "2026-08-17T21:18:27.900Z",
    "createdAt": "2026-08-17T21:18:27.901Z",
    "updatedAt": "2026-08-17T21:18:27.901Z",
    "__v": 0
  },
  "position": null,
  "newBalance": 100005
}
```
---
## Legacy Portfolio Summary
**Route**: `http://localhost:4000/api/market/portfolio/summary`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "balance": 100005,
  "equity": 100005,
  "unrealizedPnl": 0,
  "dayPnl": 0,
  "cash": 100005
}
```
---
## Legacy Portfolio Positions
**Route**: `http://localhost:4000/api/market/portfolio/positions`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
[]
```
---
## Legacy Portfolio Trades
**Route**: `http://localhost:4000/api/market/portfolio/trades`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
[
  {
    "_id": "6a837aa3a7c34d3fe7788220",
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "AAPL",
    "type": "SELL",
    "quantity": 1,
    "price": 155,
    "totalCost": 155,
    "status": "COMPLETED",
    "entryPrice": 150,
    "realizedPnl": 5,
    "date": "2026-08-17T21:18:27.900Z",
    "createdAt": "2026-08-17T21:18:27.901Z",
    "updatedAt": "2026-08-17T21:18:27.901Z",
    "__v": 0
  },
  {
    "_id": "6a837aa3a7c34d3fe778821a",
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol
... [truncated]
```
---
## Unified Trade Endpoint
**Route**: `http://localhost:4000/api/market/trade`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "transaction": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "TSLA",
    "type": "BUY",
    "quantity": 1,
    "price": 200,
    "totalCost": 200,
    "status": "COMPLETED",
    "_id": "6a837aa4a7c34d3fe778822f",
    "date": "2026-08-17T21:18:28.871Z",
    "createdAt": "2026-08-17T21:18:28.871Z",
    "updatedAt": "2026-08-17T21:18:28.871Z",
    "__v": 0
  },
  "position": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "TSLA",
    "side": "LONG",
    "quantity": 1,
    "avg
... [truncated]
```
---
## Trigger Daily Snapshot
**Route**: `http://localhost:4000/api/market/snapshot`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "_id": "6a837aa6d630f16c2f68f58c",
  "date": "2026-08-17T18:30:00.000Z",
  "user": "6a837aa2a7c34d3fe7788208",
  "__v": 0,
  "balance": 99805,
  "createdAt": "2026-08-17T21:18:30.294Z",
  "equity": 99805,
  "realizedPnl": 0,
  "unrealizedPnl": 0,
  "updatedAt": "2026-08-17T21:18:30.294Z"
}
```
---
## Legacy Buy Stock
**Route**: `http://localhost:4000/api/market/buy`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "transaction": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "MSFT",
    "type": "BUY",
    "quantity": 1,
    "price": 300,
    "totalCost": 300,
    "status": "COMPLETED",
    "_id": "6a837aa6a7c34d3fe778823b",
    "date": "2026-08-17T21:18:30.627Z",
    "createdAt": "2026-08-17T21:18:30.627Z",
    "updatedAt": "2026-08-17T21:18:30.627Z",
    "__v": 0
  },
  "position": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "MSFT",
    "side": "LONG",
    "quantity": 1,
    "avg
... [truncated]
```
---
## Legacy Sell Stock
**Route**: `http://localhost:4000/api/market/sell`
**Method**: `POST`
**Result**: ✅ PASS (Status 200)
```json
{
  "transaction": {
    "user": "6a837aa2a7c34d3fe7788208",
    "symbol": "MSFT",
    "type": "SELL",
    "quantity": 1,
    "price": 310,
    "totalCost": 310,
    "status": "COMPLETED",
    "entryPrice": 300,
    "realizedPnl": 10,
    "_id": "6a837aa7a7c34d3fe7788241",
    "date": "2026-08-17T21:18:31.022Z",
    "createdAt": "2026-08-17T21:18:31.022Z",
    "updatedAt": "2026-08-17T21:18:31.022Z",
    "__v": 0
  },
  "position": null,
  "newBalance": 99815
}
```
---
## Get Real-time Quote
**Route**: `http://localhost:4000/api/market/quote/AAPL`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "price": 305.69,
    "change": -0.23999023,
    "changePercent": -0.078446128,
    "volume": 26836382,
    "high": 307.66,
    "low": 302.939,
    "open": 306.20999,
    "previousClose": 305.92999,
    "timestamp": "2026-08-17T13:30:00.000Z"
  },
  "source": "twelvedata",
  "cached": false,
  "updatedAt": "2026-08-17T21:18:31.720Z",
  "error": null
}
```
---
## Get Historical Data
**Route**: `http://localhost:4000/api/market/history/AAPL?range=1M&interval=1d`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "success": true,
  "data": [
    {
      "date": "2026-03-25T00:00:00.000Z",
      "open": 254.10001,
      "high": 255,
      "low": 251.60001,
      "close": 252.62,
      "adjClose": 252.62,
      "volume": 28476700
    },
    {
      "date": "2026-03-26T00:00:00.000Z",
      "open": 252.12,
      "high": 257,
      "low": 250.77,
      "close": 252.89,
      "adjClose": 252.89,
      "volume": 41796700
    },
    {
      "date": "2026-03-27T00:00:00.000Z",
      "open": 253.89999,
      
... [truncated]
```
---
## Search Symbol
**Route**: `http://localhost:4000/api/market/search?q=Apple`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "instrument_name": "Apple Inc.",
      "exchange": "NASDAQ"
    },
    {
      "symbol": "AAPL",
      "instrument_name": "Apple Inc.",
      "exchange": "BMV"
    },
    {
      "symbol": "0R2V",
      "instrument_name": "Apple Inc.",
      "exchange": "LSE"
    },
    {
      "symbol": "AAPL",
      "instrument_name": "Apple Inc.",
      "exchange": "BVC"
    },
    {
      "symbol": "AAPL",
      "instrument_name": "Apple In
... [truncated]
```
---
## Top Movers
**Route**: `http://localhost:4000/api/market/movers`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "success": true,
  "data": [
    {
      "symbol": "AAPL",
      "price": 305.69,
      "change": -0.23999023,
      "changePercent": -0.078446128,
      "volume": 26836382,
      "high": 307.66,
      "low": 302.939,
      "open": 306.20999,
      "previousClose": 305.92999,
      "timestamp": "2026-08-17T13:30:00.000Z"
    },
    {
      "symbol": "TSLA",
      "price": 339.34,
      "change": -2.92999,
      "changePercent": -0.85604721,
      "volume": 23394598,
      "high": 345.45001,

... [truncated]
```
---
## Seasonality Data via Node (which calls ML)
**Route**: `http://localhost:4000/api/market/seasonality/AAPL?period=monthly`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "success": true,
  "data": {
    "symbol": "AAPL",
    "period": "monthly",
    "data": [
      {
        "month": "Jan",
        "avgReturn": -0.04
      },
      {
        "month": "Feb",
        "avgReturn": 0.01
      },
      {
        "month": "Mar",
        "avgReturn": 0
      },
      {
        "month": "Apr",
        "avgReturn": -0.02
      },
      {
        "month": "May",
        "avgReturn": 0.21
      },
      {
        "month": "Jun",
        "avgReturn": 0.06
      },
     
... [truncated]
```
---
## Dashboard Overview
**Route**: `http://localhost:4000/api/market/overview`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "success": true,
  "data": {
    "portfolio": {
      "balance": 99815,
      "equity": 99815,
      "totalUnrealizedPnl": 0,
      "details": [
        {
          "symbol": "TSLA",
          "side": "LONG",
          "quantity": 1,
          "avgCost": 200,
          "currentPrice": 200,
          "marketValue": 200,
          "unrealizedPnl": 0,
          "returnPercent": 0
        }
      ]
    },
    "buyingPower": 99815,
    "dayPnL": 0,
    "activePositions": 1,
    "dayExposure": 998
... [truncated]
```
---
## Technical Indicators
**Route**: `http://localhost:8000/api/ml/indicators?symbol=AAPL`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "symbol": "AAPL",
  "data": {
    "current_price": 305.59,
    "RSI": 43.55,
    "MACD": -2.6,
    "MACD_Signal": -0.34,
    "SMA_20": 317.18,
    "SMA_50": 308.84,
    "SMA_200": 280.17,
    "BB_High": 342.81,
    "BB_Low": 291.56,
    "ATR": 7.62,
    "Volatility": 0.0211,
    "Volume_Spike": false
  }
}
```
---
## Market Regime
**Route**: `http://localhost:8000/api/ml/regime?symbol=SPY`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "symbol": "SPY",
  "regime": "Steady Bull",
  "confidence": 0.85
}
```
---
## Weekly Seasonality
**Route**: `http://localhost:8000/api/ml/seasonality/AAPL?period=weekly`
**Method**: `GET`
**Result**: ✅ PASS (Status 200)
```json
{
  "symbol": "AAPL",
  "period": "weekly",
  "data": [
    {
      "day": "Mon",
      "avgReturn": 0.1
    },
    {
      "day": "Tue",
      "avgReturn": 0.12
    },
    {
      "day": "Wed",
      "avgReturn": 0.17
    },
    {
      "day": "Thu",
      "avgReturn": -0.09
    },
    {
      "day": "Fri",
      "avgReturn": 0.09
    }
  ]
}
```
---