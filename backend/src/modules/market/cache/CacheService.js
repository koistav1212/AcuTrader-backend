import memoryCache from './MemoryCacheProvider.js';

class CacheService {
  constructor() {
    // You could dynamically load Redis here later
    this.provider = memoryCache;
  }

  async get(key) {
    return this.provider.get(key);
  }

  async set(key, value, ttlSeconds) {
    return this.provider.set(key, value, ttlSeconds);
  }

  async delete(key) {
    return this.provider.delete(key);
  }

  async clear() {
    return this.provider.clear();
  }

  async getOrSet(key, fetchFunction, ttlSeconds) {
    const cached = await this.get(key);
    if (cached) return cached;

    const data = await fetchFunction();
    if (data) {
      await this.set(key, data, ttlSeconds);
    }
    return data;
  }
}

export default new CacheService();
