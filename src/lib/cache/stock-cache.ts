import { StockData } from '@/types/stock';
import { redis } from '@/lib/upstash-client'
import { CACHE_TTL } from '@/constants/cache'

export class StockCache {
  private static instance: StockCache;
  private cache: Map<string, {
    data: StockData;
    timestamp: number;
    etag: string;
  }> = new Map();

  private constructor() {}

  static getInstance(): StockCache {
    if (!this.instance) {
      this.instance = new StockCache();
    }
    return this.instance;
  }

  get(key: string): { data: StockData; etag: string } | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    // 1분 캐시
    if (Date.now() - cached.timestamp > 60 * 1000) {
      this.cache.delete(key);
      return null;
    }

    return {
      data: cached.data,
      etag: cached.etag
    };
  }

  set(key: string, data: StockData): string {
    const etag = this.generateETag(data);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag
    });
    return etag;
  }

  private generateETag(data: StockData): string {
    return `W/"${Date.now()}-${Math.random().toString(36).substring(7)}"`;
  }

  static async invalidatePrice(ticker: string): Promise<void> {
    const key = `stock:${ticker}`
    await redis.del(key)
  }
  
  static async setPrice(ticker: string, data: any): Promise<void> {
    const key = `stock:${ticker}`
    await redis.set(key, data, { ex: CACHE_TTL.PRICE })
  }
  
  static async batchInvalidate(tickers: string[]): Promise<void> {
    const pipeline = redis.pipeline()
    tickers.forEach(ticker => {
      const key = `stock:${ticker}`
      pipeline.del(key)
    })
    await pipeline.exec()
  }
} 