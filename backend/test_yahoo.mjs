import axios from 'axios';
import * as cheerio from 'cheerio';

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/json,xml;q=0.9,*/*;q=0.8',
};

try {
  const { data } = await axios.get('https://finance.yahoo.com/quote/NVDA/', { headers: HEADERS, timeout: 10000 });
  const $ = cheerio.load(data);

  // List ALL fin-streamer elements with their attributes
  console.log('=== ALL FIN-STREAMERS ===');
  $('fin-streamer').each((i, el) => {
    const field = $(el).attr('data-field') || 'none';
    const sym = $(el).attr('data-symbol') || 'none';
    const val = $(el).attr('value') || 'none';
    const text = $(el).text().trim().substring(0, 40);
    // Filter out market bar items (^GSPC etc)
    if (!sym.startsWith('^') && sym !== 'GC=F' && sym !== 'CL=F' && !sym.includes('-USD') && sym !== 'BE' && sym !== 'NFLX' && sym !== 'FICO') {
      console.log(`  [${i}] field=${field} sym=${sym} val=${val} text="${text}"`);
    }
  });

  // Check for data attributes on the page that might have NVDA data
  console.log('\n=== LOOKING FOR NVDA SPECIFIC DATA ===');
  // Check for data-reactid or similar attributes
  $('[data-symbol="NVDA"]').each((i, el) => {
    console.log(`  Found [data-symbol=NVDA] tag=${el.tagName} attrs=`, $(el).attr());
  });

  // Check if there's a <script> tag with JSON data for NVDA
  $('script').each((_, script) => {
    const text = $(script).html() || '';
    if (text.includes('NVDA') && text.includes('previousClose')) {
      console.log('\n=== FOUND SCRIPT WITH NVDA + previousClose ===');
      // Find JSON-like data
      const idx = text.indexOf('NVDA');
      const start = Math.max(0, idx - 200);
      const end = Math.min(text.length, idx + 300);
      console.log('Context:', text.substring(start, end));
    }
  });

  // Look specifically at the quote summary section's li span structure
  console.log('\n=== DETAILED LI INSPECTION ===');
  let liIndex = 0;
  $('li').each((_, li) => {
    const spans = $(li).find('span');
    if (spans.length >= 2) {
      const label = $(spans[0]).text().trim();
      // Check if second span contains a fin-streamer
      const secondSpanHtml = $(spans[1]).html() || '';
      if (label === 'Previous Close' || label === 'Market Cap (intraday)' || label === 'PE Ratio (TTM)' || label === 'Beta (5Y Monthly)') {
        console.log(`\n  Label: "${label}"`);
        console.log(`  Second span HTML: ${secondSpanHtml.substring(0, 200)}`);
        console.log(`  Second span text: "${$(spans[1]).text().trim()}"`);
        
        // Look at ALL children of the li
        console.log(`  Li children count: ${$(li).children().length}`);
        $(li).children().each((ci, child) => {
          console.log(`    child[${ci}] tag=${child.tagName} text="${$(child).text().trim().substring(0, 60)}"`);
        });
      }
    }
  });

} catch (err) {
  console.error('ERROR:', err.message);
}
