import axios from "axios";
import * as cheerio from "cheerio";
import { config } from "../../config/env.js";

class NewsService {
  async getNewsForSymbol(symbol, days = 30) {
    // 1. Fetch from multiple sources in parallel
    const [finnhubNews, googleNews, tavilyNews] = await Promise.allSettled([
      this.fetchFinnhub(symbol, days),
      this.fetchGoogleNews(symbol, days),
      this.fetchTavily(symbol, days)
    ]);

    // 2. Normalize and combine
    let combined = [];
    if (finnhubNews.status === "fulfilled") combined.push(...finnhubNews.value);
    if (googleNews.status === "fulfilled") combined.push(...googleNews.value);
    if (tavilyNews.status === "fulfilled") combined.push(...tavilyNews.value);

    // 3. Deduplicate
    const deduped = this.deduplicateNews(combined);

    // 4. Sort by date descending
    deduped.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));

    return {
      window: `${days}d`,
      articles: deduped
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
        publishedAt: new Date(item.datetime * 1000).toISOString(),
        category: item.category || "general",
        semanticScore: 0,
        sentimentScore: 0,
        impactScore: 0
      }));
    } catch (err) {
      console.warn(`Finnhub fetch failed for ${symbol}`);
      return [];
    }
  }

  async fetchGoogleNews(symbol, days) {
    try {
      // Google News RSS feed for 30 days
      const url = `https://news.google.com/rss/search?q=${symbol}+when:${days}d`;
      const response = await axios.get(url, { timeout: 8000 });
      const $ = cheerio.load(response.data, { xmlMode: true });
      
      const articles = [];
      $('item').each((i, el) => {
        if (i >= 10) return; // Limit to top 10 to avoid huge payloads
        const headline = $(el).find('title').text();
        const url = $(el).find('link').text();
        const pubDate = $(el).find('pubDate').text();
        
        articles.push({
          symbol,
          headline,
          summary: "", // RSS often has HTML in description, keeping it empty or simple
          source: "Google News",
          url,
          publishedAt: new Date(pubDate).toISOString(),
          category: "general",
          semanticScore: 0,
          sentimentScore: 0,
          impactScore: 0
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
        "news",
        "earnings",
        "analyst",
        "guidance",
        "regulation",
        "product",
        "partnership",
        "management"
      ];
      
      // Parallel requests to Tavily for different categories
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
            publishedAt: new Date().toISOString(), // Tavily may not always provide exact date
            category: cat,
            semanticScore: 0,
            sentimentScore: 0,
            impactScore: 0
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
      // Create a simple signature based on headline (lowercase, alphanumeric only)
      const sig = (article.headline || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(sig)) return false;
      seen.add(sig);
      return true;
    });
  }
}

export default new NewsService();
