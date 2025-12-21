import axios from 'axios';

const API_KEY = "7bwKOSRMhSLiJkbyPq6mAdFHWOUp5As0";
// Try standard v3 base URL
const BASE_URL_V3 = "https://financialmodelingprep.com/api/v3";
// Try what was in the code
const BASE_URL_STABLE = "https://financialmodelingprep.com/stable";

async function testEndpoint(name, url) {
    try {
        console.log(`Testing ${name}: ${url}`);
        const res = await axios.get(url);
        console.log(`✅ ${name} Success:`, res.status, res.data.length > 0 ? "Data received" : "Empty array");
    } catch (err) {
        console.log(`❌ ${name} Failed:`, err.response ? err.response.status : err.message);
        if (err.response && err.response.data) console.log(err.response.data);
    }
}

async function run() {
    console.log("--- Debugging FMP API ---");

    // 1. Test Quote with Query Param (Code style)
    await testEndpoint("Quote (Query Param - Stable)", `${BASE_URL_STABLE}/quote?symbol=AAPL&apikey=${API_KEY}`);
    await testEndpoint("Quote (Query Param - V3)", `${BASE_URL_V3}/quote?symbol=AAPL&apikey=${API_KEY}`);

    // 2. Test Quote with Path Param (Standard style)
    await testEndpoint("Quote (Path Param - Stable)", `${BASE_URL_STABLE}/quote/AAPL?apikey=${API_KEY}`);
    await testEndpoint("Quote (Path Param - V3)", `${BASE_URL_V3}/quote/AAPL?apikey=${API_KEY}`);

    // 3. Test Stock Price Change
    await testEndpoint("Price Change (Query Param - Stable)", `${BASE_URL_STABLE}/stock-price-change?symbol=AAPL&apikey=${API_KEY}`);
    await testEndpoint("Price Change (Path Param - V3)", `${BASE_URL_V3}/stock-price-change/AAPL?apikey=${API_KEY}`);

    // 4. Test Profile
    await testEndpoint("Profile (Query Param - Stable)", `${BASE_URL_STABLE}/profile?symbol=AAPL&apikey=${API_KEY}`);
    await testEndpoint("Profile (Path Param - V3)", `${BASE_URL_V3}/profile/AAPL?apikey=${API_KEY}`);
}

run();
