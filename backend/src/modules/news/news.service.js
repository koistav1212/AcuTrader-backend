import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "../../config/env.js";
import { analyzeNewsSentiment, aggregateSentiment } from "./sentiment.util.js";

class NewsService {
  async getNewsForSymbol(symbol, days = 30) {
    const [finnhubNews, googleNews, tavilyNews] = await Promise.allSettled([
      this.fetchFinnhub(symbol, days),
      this.fetchGoogleNews(symbol, days),
      this.fetchTavily(symbol, days)
    ]);

    let combined = [];
    if (finnhubNews.status === "fulfilled") combined.push(...finnhubNews.value);
    if (googleNews.status === "fulfilled") combined.push(...googleNews.value);
    if (tavilyNews.status === "fulfilled") combined.push(...tavilyNews.value);

    // Filter noisy/generic URLs
    const noisyDomains = ['finance.yahoo.com/quote', 'sec.gov', 'kaggle.com', 'stocktwits.com'];
    combined = combined.filter(article => {
      if (!article.url) return false;
      const url = article.url.toLowerCase();
      return !noisyDomains.some(domain => url.includes(domain));
    });

    // Enforce strict 30-day window
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    combined = combined.filter(article => {
      if (!article.publishedAt) return false;
      const pubDate = new Date(article.publishedAt);
      return pubDate >= cutoffDate;
    });

    // Deduplicate
    const deduped = this.deduplicateNews(combined);

    // Apply Sentiment & Intent Analysis
    const enriched = deduped.map(article => {
      const sentiment = analyzeNewsSentiment(article);
      return { ...article, ...sentiment };
    });

    // Sort by date descending
    enriched.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    const aggregate = aggregateSentiment(enriched);

    return {
      window: `${days}d`,
      articles: enriched,
      aggregate
    };
  }

  async fetchFinnhub(symbol, days) {
    if (!process.env.FINNHUB_API_KEY) return [];
    try {
      const toDate = new Date().toISOString().split("T")[0];
      const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
      const url = `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=${fromDate}&to=${toDate}&token=${process.env.FINNHUB_API_KEY}`;
      const response = await axios.get(url);
      
      return response.data.map(item => ({
        symbol,
        headline: item.headline,
        summary: item.summary,
        source: item.source,
        url: item.url,
        publishedAt: new Date(item.datetime * 1000).toISOString()
      }));
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
        if (i >= 10) return;
        const headline = $(el).find('title').text();
        const url = $(el).find('link').text();
        const pubDate = $(el).find('pubDate').text();
        
        articles.push({
          symbol,
          headline,
          summary: "",
          source: "Google News",
          url,
          publishedAt: new Date(pubDate).toISOString()
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
            max_results: 3
          });
          
          if (!response.data || !response.data.results) return [];
          
          return response.data.results.map(item => ({
            symbol,
            headline: item.title,
            summary: item.content,
            source: "Tavily",
            url: item.url,
            publishedAt: new Date().toISOString()
          }));
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

  deduplicateNews(articles) {
    const seen = new Set();
    return articles.filter(article => {
      const sig = (article.headline || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (!sig || seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }
}

export default new NewsService();
