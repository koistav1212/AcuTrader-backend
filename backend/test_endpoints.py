import requests
import json
import traceback
import random
import time

BASE_URL = "http://localhost:4000/api"
ML_API = "http://localhost:8000/api/ml"

# 1. Setup Auth
test_email = f"test_{int(time.time())}@example.com"
test_password = "password123"

report_lines = [
    "# Comprehensive API Endpoint Verification Report",
    "",
    "Testing ALL API endpoints (Auth, User, Legacy Market, New Market Data, Python ML).",
    ""
]

def add_result(desc, route, method, status, response_data, is_pass):
    report_lines.append(f"## {desc}")
    report_lines.append(f"**Route**: `{route}`")
    report_lines.append(f"**Method**: `{method}`")
    
    try:
        if isinstance(response_data, dict) or isinstance(response_data, list):
            snippet = json.dumps(response_data, indent=2)
        else:
            snippet = str(response_data)
            
        if len(snippet) > 500:
            snippet = snippet[:500] + "\n... [truncated]"
    except:
        snippet = str(response_data)[:500]

    if is_pass:
        report_lines.append(f"**Result**: ✅ PASS (Status {status})")
    else:
        report_lines.append(f"**Result**: ❌ FAIL (Status {status})")
        
    report_lines.append("```json\n" + snippet + "\n```")
    report_lines.append("---")

# Session and Token
session = requests.Session()
token = None

# --- AUTH ENDPOINTS ---
register_url = f"{BASE_URL}/auth/register"
res = session.post(register_url, json={
    "firstName": "Test",
    "lastName": "User",
    "email": test_email,
    "password": test_password
})
add_result("Register User", register_url, "POST", res.status_code, res.json() if res.status_code < 500 else res.text, res.status_code == 201)

login_url = f"{BASE_URL}/auth/login"
res = session.post(login_url, json={"email": test_email, "password": test_password})
login_data = res.json() if res.status_code < 500 else {}
token = login_data.get("token")
add_result("Login User", login_url, "POST", res.status_code, login_data if res.status_code < 500 else res.text, res.status_code == 200 and token is not None)

headers = {"Authorization": f"Bearer {token}"} if token else {}

# --- USER ENDPOINTS ---
user_endpoints = [
    {"route": f"{BASE_URL}/user/me", "method": "GET", "desc": "Get Current User Profile"},
    {"route": f"{BASE_URL}/user/portfolio", "method": "GET", "desc": "Get Full Portfolio"},
    {"route": f"{BASE_URL}/user/watchlist", "method": "GET", "desc": "Get User Watchlist"},
    {"route": f"{BASE_URL}/user/watchlist/toggle", "method": "POST", "body": {"symbol": "AAPL"}, "desc": "Toggle Watchlist"},
    {"route": f"{BASE_URL}/user/transactions", "method": "GET", "desc": "Get Transactions History"},
    # We will buy some stock to ensure portfolio/positions work
    {"route": f"{BASE_URL}/user/buy", "method": "POST", "body": {"symbol": "AAPL", "quantity": 1, "price": 150.0}, "desc": "Buy Stock (User Route)"},
    {"route": f"{BASE_URL}/user/sell", "method": "POST", "body": {"symbol": "AAPL", "quantity": 1, "price": 155.0}, "desc": "Sell Stock (User Route)"},
]

# --- LEGACY MARKET ENDPOINTS ---
legacy_market_endpoints = [
    {"route": f"{BASE_URL}/market/portfolio/summary", "method": "GET", "desc": "Legacy Portfolio Summary"},
    {"route": f"{BASE_URL}/market/portfolio/positions", "method": "GET", "desc": "Legacy Portfolio Positions"},
    {"route": f"{BASE_URL}/market/portfolio/trades", "method": "GET", "desc": "Legacy Portfolio Trades"},
    {"route": f"{BASE_URL}/market/trade", "method": "POST", "body": {"symbol": "TSLA", "side": "BUY", "quantity": 1, "price": 200.0}, "desc": "Unified Trade Endpoint"},
    {"route": f"{BASE_URL}/market/snapshot", "method": "POST", "desc": "Trigger Daily Snapshot"},
    {"route": f"{BASE_URL}/market/buy", "method": "POST", "body": {"symbol": "MSFT", "quantity": 1, "price": 300.0}, "desc": "Legacy Buy Stock"},
    {"route": f"{BASE_URL}/market/sell", "method": "POST", "body": {"symbol": "MSFT", "quantity": 1, "price": 310.0}, "desc": "Legacy Sell Stock"},
]

# --- NEW MARKET DATA ENDPOINTS ---
new_market_endpoints = [
    {"route": f"{BASE_URL}/market/quote/AAPL", "method": "GET", "desc": "Get Real-time Quote"},
    {"route": f"{BASE_URL}/market/history/AAPL?range=1M&interval=1d", "method": "GET", "desc": "Get Historical Data"},
    {"route": f"{BASE_URL}/market/search?q=Apple", "method": "GET", "desc": "Search Symbol"},
    {"route": f"{BASE_URL}/market/movers", "method": "GET", "desc": "Top Movers"},
    {"route": f"{BASE_URL}/market/seasonality/AAPL?period=monthly", "method": "GET", "desc": "Seasonality Data via Node (which calls ML)"},
    {"route": f"{BASE_URL}/market/overview", "method": "GET", "desc": "Dashboard Overview"},
]

# --- PYTHON ML ENDPOINTS ---
ml_endpoints = [
    {"route": f"{ML_API}/indicators?symbol=AAPL", "method": "GET", "desc": "Technical Indicators"},
    {"route": f"{ML_API}/regime?symbol=SPY", "method": "GET", "desc": "Market Regime"},
    {"route": f"{ML_API}/seasonality/AAPL?period=weekly", "method": "GET", "desc": "Weekly Seasonality"},
]

all_endpoints = user_endpoints + legacy_market_endpoints + new_market_endpoints + ml_endpoints

for ep in all_endpoints:
    try:
        if ep['method'] == "GET":
            res = session.get(ep['route'], headers=headers, timeout=15)
        elif ep['method'] == "POST":
            res = session.post(ep['route'], json=ep.get('body', {}), headers=headers, timeout=15)
            
        status = res.status_code
        try:
            data = res.json()
        except:
            data = res.text
            
        # Consider 2xx as pass
        is_pass = 200 <= status < 300
        add_result(ep['desc'], ep['route'], ep['method'], status, data, is_pass)
            
    except Exception as e:
        add_result(ep['desc'], ep['route'], ep['method'], 500, traceback.format_exc(), False)

with open("/Users/koustavsarkar/Documents/mba_projects/AcuTrader-backend/backend/API_TEST_REPORT.md", "w") as f:
    f.write("\n".join(report_lines))

print("Comprehensive report generated successfully.")
