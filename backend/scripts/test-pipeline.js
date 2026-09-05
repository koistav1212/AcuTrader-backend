import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:4000/api/market/quote';
const SYMBOLS = ['NVDA', 'AAPL', 'MSFT', 'AMZN', 'JPM'];

async function testPipeline() {
  console.log('=== AcuTrader Market Data Pipeline Test ===\\n');
  
  for (const sym of SYMBOLS) {
    try {
      console.log(`\\nFetching ${sym}...`);
      const startTime = Date.now();
      const res = await fetch(`${BASE_URL}/${sym}?debug=true`);
      const json = await res.json();
      const elapsed = Date.now() - startTime;
      
      if (!res.ok || !json.success) {
         console.error(`❌ Failed to fetch ${sym}:`, json.error || res.statusText);
         continue;
      }
      
      const { data, diagnostic } = json;
      const dq = data.dataQuality;
      
      console.log(`✅ ${sym} | Completeness: ${dq.completeness}% | Time: ${elapsed}ms`);
      console.log(`   Market: ${dq.marketDataCompleteness}% | Fundamentals: ${dq.fundamentalCompleteness}% | Tech: ${dq.technicalCompleteness}%`);
      console.log(`   Source: ${data.source}`);
      console.log(`   Provider Status:`, diagnostic?.providerStatus);
      
      // Verification rules
      const rules = [
        { name: 'Has basic quote', check: () => data.price > 0 && data.volume > 0 },
        { name: 'Has exchange', check: () => !!data.exchange },
        { name: 'Has valid fundamentals (MarketCap)', check: () => data.marketCap > 0 },
        { name: 'Field Sources tracked', check: () => Object.keys(data.fieldSources).length > 10 },
        { name: 'Field As Of tracked', check: () => Object.keys(data.fieldAsOf).length > 10 },
        { name: 'SEC provided fundamentals', check: () => data.fieldSources.revenue === 'sec' || data.fieldSources.netIncome === 'sec' }
      ];
      
      for (const r of rules) {
         const pass = r.check();
         console.log(`   ${pass ? '✅' : '❌'} Check: ${r.name}`);
      }
      
      console.log(`   Missing: ${dq.missingFields.length} fields. Examples:`, dq.missingFields.slice(0, 5).join(', '));
      
      if (diagnostic?.sourceDiscrepancies && Object.keys(diagnostic.sourceDiscrepancies).length > 0) {
         console.log(`   ⚠️ Discrepancies detected:`, Object.keys(diagnostic.sourceDiscrepancies).join(', '));
      }
      
    } catch (e) {
      console.error(`❌ Error fetching ${sym}:`, e.message);
    }
  }
}

testPipeline();
