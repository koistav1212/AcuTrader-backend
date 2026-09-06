import axios from "axios";
import * as cheerio from "cheerio";
import crypto from "crypto";

class NewsService {
  /**
   * Generates a deterministic hash for deduplication
   */
  _generateId(text) {
    return crypto.createHash("sha256").update(text || "").digest("hex");
  }

  async getNewsForSymbol(symbol, days = 30, options = {}) {
    const { audit = false } = options;
    const analysis_cutoff = new Date().toISOString();
    const window_end_date = new Date(analysis_cutoff);
    const window_start_date = new Date(window_end_date.getTime() - days * 24 * 60 * 60 * 1000);
    const window_start = window_start_date.toISOString();
    const window_end = analysis_cutoff;

    const [finnhubNews, googleNews, tavilyNews] = await Promise.allSettled([
      this.fetchFinnhub(symbol, days, window_start_date, window_end_date),
      this.fetchGoogleNews(symbol, days),
      this.fetchTavily(symbol, days)
    ]);

    let combined = [];
    if (finnhubNews.status === "fulfilled") combined.push(...finnhubNews.value);
    if (googleNews.status === "fulfilled") combined.push(...googleNews.value);
    if (tavilyNews.status === "fulfilled") combined.push(...tavilyNews.value);

    let raw_articles = combined.length;
    let date_valid_articles = 0;
    let within_window = 0;
    let duplicates_removed = 0;
    let irrelevant_removed = 0;

    const noisyDomains = [
      'finance.yahoo.com/quote', 'sec.gov', 'kaggle.com', 'stocktwits.com',
      'zacks.com', 'investopedia.com', 'macrotrends.net', 'seekingalpha.com/symbol'
    ];

    const seenSignatures = new Set();
    const finalArticles = [];
    
    // Dump Raw News if audit
    if (audit) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const auditDir = path.resolve(process.cwd(), '..', 'ml_service', 'news_audit_artifacts', symbol.toUpperCase(), analysis_cutoff.split('T')[0]);
      await fs.mkdir(auditDir, { recursive: true }).catch(() => {});
      
      const rawDump = {
        symbol,
        analysisCutoff: analysis_cutoff,
        windowStart: window_start,
        windowEnd: window_end,
        providerCounts: {
          finnhub: finnhubNews.status === "fulfilled" ? finnhubNews.value.length : 0,
          google: googleNews.status === "fulfilled" ? googleNews.value.length : 0,
          tavily: tavilyNews.status === "fulfilled" ? tavilyNews.value.length : 0,
        },
        articles: combined
      };
      await fs.writeFile(path.join(auditDir, '01_raw_news.json'), JSON.stringify(rawDump, null, 2)).catch(() => {});
    }

    for (const article of combined) {
      // 1. Date Validation
      if (!article.published_at) {
        continue;
      }
      const pubDate = new Date(article.published_at);
      if (isNaN(pubDate.getTime())) {
        continue;
      }
      date_valid_articles++;

      // 2. Window Filtering (No future dates, no older than 30 days)
      if (pubDate > window_end_date || pubDate < window_start_date) {
        continue;
      }
      within_window++;

      // 3. Relevance Filtering
      const url = (article.url || "").toLowerCase();
      const isNoisy = noisyDomains.some(domain => url.includes(domain));
      
      const titleLower = (article.title || "").toLowerCase();
      const summaryLower = (article.summary || "").toLowerCase();
      const symbolLower = symbol.toLowerCase();
      const hasEntity = titleLower.includes(symbolLower) || summaryLower.includes(symbolLower);
      
      article.isRelevant = !isNoisy && hasEntity;
      
      if (!article.isRelevant) {
        irrelevant_removed++;
      }

      // 4. Deduplication
      // Use headline + source + YYYY-MM-DD to deduplicate
      const dateStr = pubDate.toISOString().split("T")[0];
      const headlineSig = (article.title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const sig = `${headlineSig}_${dateStr}`;
      
      article.eventClusterId = crypto.createHash("sha256").update(sig).digest("hex").substring(0, 16);
      article.articleId = article.article_id;
      
      if (!headlineSig || seenSignatures.has(sig)) {
        duplicates_removed++;
        article.isDuplicate = true;
        article.duplicateOf = article.eventClusterId;
      } else {
        seenSignatures.add(sig);
        article.isDuplicate = false;
        article.duplicateOf = null;
      }

      finalArticles.push(article);
    }

    // Sort by date descending
    finalArticles.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

    const metadata = {
      symbol,
      analysis_cutoff,
      window_start,
      window_end,
      calendar_days: days,
      raw_articles,
      date_valid_articles,
      within_window,
      duplicates_removed,
      irrelevant_removed,
      final_articles: finalArticles.length
    };
    
    // Dump Validated News if audit
    if (audit) {
      const fs = await import('fs/promises');
      const path = await import('path');
      const auditDir = path.resolve(process.cwd(), '..', 'ml_service', 'news_audit_artifacts', symbol.toUpperCase(), analysis_cutoff.split('T')[0]);
      
      const validDump = {
        rawCount: raw_articles,
        dateValidCount: date_valid_articles,
        withinWindowCount: within_window,
        irrelevantCount: irrelevant_removed,
        duplicateCount: duplicates_removed,
        validCount: finalArticles.length,
        articles: finalArticles
      };
      await fs.writeFile(path.join(auditDir, '02_validated_news.json'), JSON.stringify(validDump, null, 2)).catch(() => {});
    }

    return {
      metadata,
      articles: finalArticles
    };
  }

  async fetchFinnhub(symbol, days, window_start_date, window_end_date) {
    if (!process.env.FINNHUB_API_KEY) return [];
    try {
      const toDate = window_end_date.toISOString().split("T")[0];
      const fromDate = window_start_date.toISOString().split("T")[0];
      const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${process.env.FINNHUB_API_KEY}`;
      const response = await axios.get(url);
      
      return response.data.map(item => {
        const pubDate = new Date(item.datetime * 1000);
        return {
          article_id: this._generateId(item.url || item.headline),
          symbol,
          title: item.headline,
          summary: item.summary,
          clean_text: item.summary,
          source: item.source,
          publisher: item.source,
          url: item.url,
          canonical_url: item.url,
          published_at: isNaN(pubDate.getTime()) ? null : pubDate.toISOString(),
          ingested_at: new Date().toISOString(),
          date: isNaN(pubDate.getTime()) ? null : pubDate.toISOString().split("T")[0],
          retrieval_source: "Finnhub"
        };
      });
    } catch (err) {
      console.warn(`Finnhub fetch failed for ${symbol}`);
      return [];
    }
  }

  async fetchGoogleNews(symbol, days) {
    try {
      const url = `https://news.google.com/rss/search?q=${symbol}+when:${days}d`;
      const response = await axios.get(url, { timeout: 8000 });
      const $ = cheerio.load(response.data, { xmlMode: true });
      
      const articles = [];
      $('item').each((i, el) => {
        // Removed artificial limit of 10
        const headline = $(el).find('title').text();
        const url = $(el).find('link').text();
        const pubDateRaw = $(el).find('pubDate').text();
        const pubDate = new Date(pubDateRaw);
        
        articles.push({
          article_id: this._generateId(url || headline),
          symbol,
          title: headline,
          summary: "",
          clean_text: "",
          source: "Google News",
          publisher: $(el).find('source').text() || "Google News",
          url,
          canonical_url: url,
          published_at: isNaN(pubDate.getTime()) ? null : pubDate.toISOString(),
          ingested_at: new Date().toISOString(),
          date: isNaN(pubDate.getTime()) ? null : pubDate.toISOString().split("T")[0],
          retrieval_source: "GoogleNews"
        });
      });
      return articles;
    } catch (err) {
      console.warn(`Google News fetch failed for ${symbol}`);
      return [];
    }
  }

  async fetchTavily(symbol, days) {
    if (!process.env.TAVILY_API_KEY) return [];
    try {
      const categories = [
        "news", "earnings", "analyst", "guidance", 
        "regulation", "product", "partnership", "management"
      ];
      
      const requests = categories.map(async (cat) => {
        try {
          const response = await axios.post("https://api.tavily.com/search", {
            api_key: process.env.TAVILY_API_KEY,
            query: `${symbol} ${cat} last ${days} days`,
            search_depth: "basic",
            max_results: 15 // Increased from 3
          });
          
          if (!response.data || !response.data.results) return [];
          
          return response.data.results.map(item => {
            // NEVER fabricate publishedAt. If Tavily doesn't provide a valid date, it's null.
            const pubDate = item.published_date ? new Date(item.published_date) : new Date(NaN);
            
            return {
              article_id: this._generateId(item.url || item.title),
              symbol,
              title: item.title,
              summary: item.content,
              clean_text: item.content,
              source: "Tavily",
              publisher: "Tavily",
              url: item.url,
              canonical_url: item.url,
              published_at: isNaN(pubDate.getTime()) ? null : pubDate.toISOString(),
              ingested_at: new Date().toISOString(),
              date: isNaN(pubDate.getTime()) ? null : pubDate.toISOString().split("T")[0],
              retrieval_source: "Tavily"
            };
          });
        } catch (innerErr) {
          console.warn(`Tavily fetch failed for ${symbol} category: ${cat}`);
          return [];
        }
      });
      
      const resultsArray = await Promise.all(requests);
      return resultsArray.flat();
    } catch (err) {
      console.warn(`Tavily fetch failed for ${symbol}`);
      return [];
    }
  }
}

export default new NewsService();
