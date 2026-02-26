import feedparser
import requests
import re
import yfinance as yf
from datetime import datetime, timedelta
import time
import ssl
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed

# SSL Fix
if hasattr(ssl, '_create_unverified_context'):
    ssl._create_default_https_context = ssl._create_unverified_context

# ============================================================
# UPGRADE 3: SEMANTIC SIMILARITY FILTER
# ============================================================

try:
    from sentence_transformers import SentenceTransformer, util
    SEMANTIC_MODEL = SentenceTransformer("all-MiniLM-L6-v2")
    FINANCE_REFERENCE = "earnings revenue guidance profit loss merger acquisition regulation lawsuit analyst rating upgrade downgrade CEO CFO quarterly results forecast dividend buyback IPO"
    REF_EMBEDDING = SEMANTIC_MODEL.encode(FINANCE_REFERENCE)
    SEMANTIC_ENABLED = True
    print("Semantic filter: ENABLED")
except ImportError:
    SEMANTIC_ENABLED = False
    print("Semantic filter: DISABLED (sentence-transformers not installed)")

# ============================================================
# UPGRADE 1: FINANCIAL INTENT CLASSIFIER
# ============================================================

CATEGORY_RULES = {
    "earnings": ["earnings", "eps", "revenue", "quarter", "results", "guidance", "forecast", "profit", "loss", "beat", "miss"],
    "analyst": ["upgrade", "downgrade", "price target", "rating", "initiated", "reiterate", "analyst"],
    "management": ["ceo", "cfo", "board", "resigns", "appoints", "executive", "leadership"],
    "corporate": ["acquisition", "merger", "buyback", "dividend", "split", "deal", "partnership", "expansion"],
    "filing": ["13f", "stake", "holdings", "llc increases", "llc reduces", "management purchased", "increases position", 
               "reduces position", "institutional", "buys shares", "sells shares", "buys new shares", "new position in"],
    "regulation": ["sec", "lawsuit", "settlement", "investigation", "fine", "penalty", "compliance"],
}

# Categories to KEEP (high signal)
KEEP_CATEGORIES = ["earnings", "analyst", "management", "corporate", "regulation"]

# Categories to DISCARD (low signal, high noise)
DISCARD_CATEGORIES = ["filing"]

# Ownership spam patterns (HARD BLOCK)
OWNERSHIP_SPAM_PATTERNS = [
    "buys shares", "sells shares", "buys new shares", "increases holdings",
    "reduces holdings", "new position in", "llc buys", "llc sells",
    "advisors buys", "advisors sells", "management increases", "management reduces",
    "grows stock holdings", "raises stock position", "sells 4,", "sells 3,", "sells 2,", "sells 1,"
]

def is_ownership_spam(text):
    """Returns True if article is ownership/institutional filing spam."""
    text_lower = text.lower()
    return any(pattern in text_lower for pattern in OWNERSHIP_SPAM_PATTERNS)

def classify_article(text):
    """
    Classifies article into financial categories.
    Returns the primary category or 'general'.
    """
    text_lower = text.lower()
    scores = {}
    
    for category, keywords in CATEGORY_RULES.items():
        score = sum(1 for kw in keywords if kw in text_lower)
        if score > 0:
            scores[category] = score
    
    if not scores:
        return "general"
    
    return max(scores, key=scores.get)

# ============================================================
# UPGRADE 2: SOURCE CREDIBILITY WEIGHTING
# ============================================================

SOURCE_WEIGHT = {
    "reuters": 5,
    "wsj": 5,
    "ft.com": 5,
    "bloomberg": 5,
    "cnbc": 4,
    "seekingalpha": 3,
    "yahoo": 3,
    "benzinga": 2,
    "marketwatch": 2,
    "nasdaq": 2,
    "stocktwits": 0,
    "google": 1,  # Google News aggregates, variable quality
}

def get_source_weight(link, source_name):
    """Returns credibility weight based on source."""
    link_lower = link.lower()
    source_lower = source_name.lower()
    
    for source, weight in SOURCE_WEIGHT.items():
        if source in link_lower or source in source_lower:
            return weight
    
    return 1  # Default weight

# ============================================================
# UPGRADE 4: STRONGER NOISE BLACKLIST
# ============================================================

NOISE_KEYWORDS = [
    # Weather
    "weather", "storm", "hurricane", "flood", "tornado", "freeze", "snow",
    # Violence/Crime
    "shooting", "murder", "crime", "arrest", "police",
    # War/Military
    "war", "military", "invasion", "troops", "missile", "ukraine", "russia",
    # Politics (unless directly business-related)
    "election", "vote", "congress", "senate", "democrat", "republican", "trump", "biden",
    # Sports/Entertainment
    "sports", "game", "celebrity", "movie", "concert", "nfl", "nba",
    # Travel disruptions
    "airline delays", "flight cancel", "airport",
    # Crypto-only noise (unless it's about the company's crypto strategy)
    "bitcoin price", "crypto crash", "meme coin",
]

def has_noise(text):
    """Returns True if article contains noise keywords."""
    text_lower = text.lower()
    noise_count = sum(1 for kw in NOISE_KEYWORDS if kw in text_lower)
    return noise_count >= 2  # Allow 1 mention, block 2+

# ============================================================
# LAYER 1: SOURCE SEPARATION (Tier A = ticker-specific only)
# ============================================================

def get_rss_feeds(ticker):
    """
    Returns ONLY high-quality ticker-specific feeds.
    Removed all generic macro noise sources.
    """
    return [
        # Tier A: Ticker-specific (HIGH RELEVANCE)
        f"https://news.google.com/rss/search?q={ticker}+stock&hl=en-US&gl=US&ceid=US:en",
        f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}",
        f"https://www.nasdaq.com/feed/rssoutbound?symbol={ticker}",
        f"https://stocktwits.com/symbol/{ticker}.rss",
        f"https://seekingalpha.com/api/sa/combined/{ticker}.xml",
        
        # Tier B: Quality sources (will be filtered by ticker presence)
        "https://feeds.benzinga.com/benzinga",
        "https://seekingalpha.com/market_currents.xml",
    ]

# ============================================================
# COMPANY NAME LOOKUP
# ============================================================

_company_cache = {}

def get_company_info(ticker):
    """Returns company name and related keywords for filtering."""
    if ticker in _company_cache:
        return _company_cache[ticker]
    
    try:
        stock = yf.Ticker(ticker)
        info = stock.info
        
        company_name = info.get('shortName', '') or info.get('longName', '')
        
        keywords = [ticker.lower()]
        
        if company_name:
            keywords.append(company_name.lower())
            for word in company_name.split():
                if len(word) > 3:
                    keywords.append(word.lower())
        
        _company_cache[ticker] = keywords
        return keywords
        
    except Exception:
        _company_cache[ticker] = [ticker.lower()]
        return [ticker.lower()]

# ============================================================
# HIGH IMPACT KEYWORDS
# ============================================================

HIGH_IMPACT_KEYWORDS = [
    "earnings", "revenue", "guidance", "quarter", "profit", "loss",
    "upgrade", "downgrade", "beat", "miss", "forecast", "outlook",
    "acquisition", "merger", "buyback", "dividend", "split",
    "sec", "filing", "lawsuit", "settlement", "investigation",
    "ceo", "cfo", "executive", "board", "analyst"
]

# ============================================================
# RELEVANCE FILTER (HARD FILTER)
# ============================================================

def is_relevant(article, ticker, company_keywords):
    """HARD FILTER: Returns True only if article is company-specific."""
    text = (article["title"] + " " + article.get("summary", "")).lower()
    
    for kw in company_keywords:
        if kw in text:
            return True
    
    return False

# ============================================================
# UPGRADE 3: SEMANTIC SIMILARITY SCORE
# ============================================================

def semantic_score(text):
    """Returns semantic similarity to financial reference text."""
    if not SEMANTIC_ENABLED:
        return 1.0  # Bypass if not available
    
    try:
        emb = SEMANTIC_MODEL.encode(text[:500])  # Limit text length
        score = util.cos_sim(emb, REF_EMBEDDING).item()
        return score
    except Exception:
        return 0.5

# ============================================================
# COMPLETE SCORING FUNCTION
# ============================================================

def score_article(article, ticker, company_keywords):
    """
    PRO scoring with all upgrades:
    - Ticker/company presence
    - High-impact keywords
    - Source credibility
    - Semantic similarity
    - Category bonuses
    - Noise penalties
    """
    score = 0
    title = article["title"].lower()
    text = (title + " " + article.get("summary", "")).lower()
    link = article.get("link", "").lower()
    source = article.get("source", "")
    
    # === BASE SCORING ===
    
    # Ticker in title: +10 (strongest signal)
    if ticker.lower() in title:
        score += 10
    elif ticker.lower() in text:
        score += 5
    
    # Company name match: +6
    for kw in company_keywords:
        if kw != ticker.lower() and kw in text:
            score += 6
            break
    
    # High-impact keywords: +2 each (max 8)
    impact_count = sum(1 for k in HIGH_IMPACT_KEYWORDS if k in text)
    score += min(impact_count * 2, 8)
    
    # === UPGRADE 2: Source credibility ===
    score += get_source_weight(link, source)
    
    # === UPGRADE 3: Semantic similarity bonus ===
    if SEMANTIC_ENABLED:
        sem_score = semantic_score(text)
        if sem_score > 0.35:
            score += 5
        elif sem_score > 0.25:
            score += 2
        elif sem_score < 0.15:
            score -= 5  # Penalize non-financial content
    
    # === UPGRADE 1: Category bonuses ===
    category = classify_article(text)
    article['_category'] = category  # Store for quota system
    
    if category in ["earnings", "analyst"]:
        score += 4
    elif category in ["management", "corporate"]:
        score += 3
    elif category in ["regulation"]:
        score += 2
    elif category in ["filing"]:
        score -= 8  # Heavy penalty for ownership spam
    
    # === UPGRADE 4: Noise penalties ===
    if has_noise(text):
        score -= 10
    
    return score

# ============================================================
# DEDUPLICATION
# ============================================================

def deduplicate_articles(articles):
    """Deduplicates articles based on normalized title similarity."""
    unique_articles = []
    seen_normalized_titles = set()
    
    for article in articles:
        norm_title = re.sub(r'\W+', '', article['title'].lower())
        
        # More aggressive dedup: first 50 chars
        short_key = norm_title[:50]
        
        if short_key in seen_normalized_titles:
            continue
            
        seen_normalized_titles.add(short_key)
        unique_articles.append(article)
        
    return unique_articles

# ============================================================
# UPGRADE 5: CATEGORY QUOTAS
# ============================================================

def apply_category_quotas(articles, quota_per_category=2, total_limit=10):
    """
    Returns balanced articles with max N per category.
    Ensures diverse summary (Bloomberg style).
    """
    bucket = defaultdict(list)
    
    for article in articles:
        category = article.get('_category', 'general')
        bucket[category].append(article)
    
    final = []
    
    # Priority order
    priority_categories = ["earnings", "analyst", "corporate", "management", "regulation", "general"]
    
    for cat in priority_categories:
        if cat in bucket:
            final.extend(bucket[cat][:quota_per_category])
    
    # Fill remaining with any leftover high-scoring articles
    if len(final) < total_limit:
        all_remaining = [a for a in articles if a not in final]
        final.extend(all_remaining[:total_limit - len(final)])
    
    return final[:total_limit]

# ============================================================
# MAIN FETCH FUNCTION (with all 5 upgrades)
# ============================================================

def fetch_news_data(ticker, days=14):
    """
    INSTITUTIONAL-GRADE news fetcher with 5 upgrades:
    1. Financial intent classifier
    2. Source credibility weighting
    3. Semantic similarity filter
    4. Stronger noise blacklist
    5. Category quotas
    """
    feeds = get_rss_feeds(ticker)
    cutoff_date = datetime.now() - timedelta(days=days)
    
    print(f"Fetching news for {ticker} from {len(feeds)} quality sources...")
    
    company_keywords = get_company_info(ticker)
    print(f"Company keywords: {company_keywords[:5]}")
    
    raw_articles = []
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
    }

    def fetch_single_feed(rss_url):
        articles = []
        try:
            response = requests.get(rss_url, headers=headers, timeout=5)
            if response.status_code != 200:
                return []
            
            feed = feedparser.parse(response.content)

            for entry in feed.entries:
                published_dt = None
                if hasattr(entry, 'published_parsed') and entry.published_parsed:
                    published_dt = datetime.fromtimestamp(time.mktime(entry.published_parsed))
                elif hasattr(entry, 'updated_parsed') and entry.updated_parsed:
                    published_dt = datetime.fromtimestamp(time.mktime(entry.updated_parsed))
                
                if not published_dt or published_dt < cutoff_date:
                    continue

                title = entry.title if hasattr(entry, 'title') else ''
                link = entry.link if hasattr(entry, 'link') else ''
                summary = entry.summary if hasattr(entry, 'summary') else ''
                
                def clean_text(text):
                    if not text: return ""
                    text = re.sub(r'<[^>]+>', '', text)
                    text = text.replace("&nbsp;", " ").replace("&amp;", "&")
                    return " ".join(text.split())

                title = clean_text(title)
                summary = clean_text(summary)
                
                if len(summary) < 20:
                    summary = title
                    
                source_title = getattr(feed.feed, 'title', 'Unknown')

                articles.append({
                    'title': title,
                    'link': link,
                    'published': published_dt.strftime('%Y-%m-%d %H:%M:%S'),
                    'summary': summary,
                    'source': source_title
                })
        except Exception:
            pass
            
        return articles

    # Parallel fetch
    with ThreadPoolExecutor(max_workers=8) as executor:
        future_to_url = {executor.submit(fetch_single_feed, url): url for url in feeds}
        for future in as_completed(future_to_url):
            try:
                data = future.result()
                raw_articles.extend(data)
            except Exception:
                pass
    
    print(f"Raw articles fetched: {len(raw_articles)}")
    
    # STEP 1: Deduplicate (more aggressive)
    articles = deduplicate_articles(raw_articles)
    print(f"After dedup: {len(articles)}")
    
    # STEP 2: Hard ticker filter
    articles = [a for a in articles if is_relevant(a, ticker, company_keywords)]
    print(f"After relevance filter: {len(articles)}")
    
    # STEP 3: Remove noise
    articles = [a for a in articles if not has_noise(a["title"] + " " + a.get("summary", ""))]
    print(f"After noise filter: {len(articles)}")
    
    # STEP 4: Score and rank (includes category classification)
    for article in articles:
        article['_score'] = score_article(article, ticker, company_keywords)
    
    articles.sort(key=lambda x: x['_score'], reverse=True)
    
    # STEP 5: Apply category quotas for balanced output
    top_articles = apply_category_quotas(articles, quota_per_category=2, total_limit=8)
    
    # Clean up internal fields
    for a in top_articles:
        a.pop('_score', None)
        a.pop('_category', None)
    
    print(f"Final top articles: {len(top_articles)}")
    return top_articles

if __name__ == "__main__":
    news = fetch_news_data("NVDA", days=14)
    print("\n=== TOP ARTICLES ===")
    for n in news:
        print(f"[{n['source'][:20]}] {n['title'][:70]}")
