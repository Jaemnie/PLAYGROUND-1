import { createClient } from '@/lib/supabase/server'
import cron from 'node-cron'
import { PortfolioTracker } from '@/services/portfolio-tracker'
import type { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js'
import { getDbTimeXMinutesAgo } from '@/lib/timeUtils'
import { SupabaseClient } from '@supabase/supabase-js'
import { Client } from '@upstash/qstash'

interface NewsTemplate {
  title: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
  type: 'company';
  volatility?: number;
  company_id?: string;
  industry?: string;
}

interface NewsRecord {
  id: string;
  title: string;
  content: string;
  company_id?: string;
  published_at: string;
  type: 'company';
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
  volatility: number;
}

interface SchedulerStatus {
  status: 'running' | 'stopped' | 'error';
  lastRun: Date | null;
  nextRun: Date | null;
  errorMessage?: string;
  jobType: 'market_update' | 'news_generation' | 'price_update';
}

type Industry = '전자' | 'IT' | '제조' | '건설' | '식품';

interface Company {
  id: string;
  name: string;
  ticker: string;
  industry: Industry;
  current_price: number;
  previous_price: number;
  last_closing_price: number;
  is_delisted?: boolean;
  consecutive_down_days?: number;
  market_cap: number;
}

interface Holdings {
  company_id: string;
  shares: number;
  updated_at: string;
}

interface Profile {
  id: string;
}

// 시뮬레이션 파라미터 상수 수정
const SIMULATION_PARAMS = {
  NEWS: {
    COMPANY_NEWS_CHANCE: 1.0,           // 100% 확률로 변경
    IMPACT_VARIATION_MIN: 1.0,          // 뉴스 영향력 증가 (100% ~ 150%)
    IMPACT_VARIATION_MAX: 1.5,
    DECAY_TIME_MINUTES: 45,
  },
  PRICE: {
    BASE_RANDOM_CHANGE: 0.01,           // 기본 변동폭 (±1%)
    REVERSAL: {
      BASE_CHANCE: 0.1,                 // 기본 반전 확률 (10%)
      MOMENTUM_MULTIPLIER: 0.15,        // 모멘텀당 추가 반전 확률 (15%)
      MAX_CHANCE: 0.85                  // 최대 반전 확률 (85%)
    },
    DAILY_LIMIT: 0.30,                  // 일일 가격 제한폭 증가 (30%)
    WEIGHTS: {
      RANDOM: 0.3,
      NEWS: 0.5,
      INDUSTRY: 0.3,
      MOMENTUM: 0.4,
    }
  },
  INDUSTRY: {
    VOLATILITY: {
      'IT': 1.5,
      '전자': 1.4,
      '제조': 1.2,
      '건설': 1.1,
      '식품': 1.0
    } as const
  },
  MARKET_CAP: {
    VOLATILITY: {
      LARGE: 1.0,                       // 시가총액별 변동성 증가
      MEDIUM: 1.3,
      SMALL: 1.6,
    },
    THRESHOLDS: {
      LARGE: 100_000_000_000,
      MEDIUM: 100_000_000,
    }
  }
} as const;

export class MarketScheduler {
  private static instance: MarketScheduler | null = null;
  private isInitialized: boolean = false;
  private supabase!: SupabaseClient;
  private _isRunning: boolean = false;
  private tasks: Map<string, cron.ScheduledTask> = new Map();
  private readonly MARKET_OPEN_HOUR = 9;    // 장 시작 시간
  private readonly MARKET_CLOSE_HOUR = 24;   // 장 마감 시간 (자정)
  private lastMarketUpdate: Date | null = null;
  private lastNewsUpdate: Date | null = null;
  private newsTemplateCache: Map<string, NewsTemplate[]> = new Map();
  private priceCache: Map<string, number> = new Map();
  private priceMovementCache: Map<string, {
    direction: 'up' | 'down' | 'neutral',
    consecutiveCount: number,
    lastChange: number
  }> = new Map();
  private qstash: Client

  constructor() {
    this.qstash = new Client({
      token: process.env.QSTASH_TOKEN!
    })
  }

  static async getInstance(): Promise<MarketScheduler> {
    if (!MarketScheduler.instance) {
      MarketScheduler.instance = new MarketScheduler();
    }
    if (!MarketScheduler.instance.isInitialized) {
      await MarketScheduler.instance.initialize();
      MarketScheduler.instance.isInitialized = true;
    }
    return MarketScheduler.instance;
  }

  private isMarketOpen(): boolean {
    const now = new Date();
    const currentHour = now.getHours();
    return currentHour >= this.MARKET_OPEN_HOUR && currentHour < this.MARKET_CLOSE_HOUR;
  }

  async start() {
    if (this._isRunning) {
      console.log('마켓 스케줄러가 이미 실행 중입니다.');
      return;
    }

    try {
      // 1분마다 마켓 업데이트
      await this.qstash.schedules.create({
        destination: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/market-update`,
        cron: '* * * * *'
      });

      // 30분마다 뉴스 생성
      await this.qstash.schedules.create({
        destination: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/news-update`,
        cron: '*/30 * * * *'
      });

      this._isRunning = true;
      console.log('마켓 스케줄러가 시작되었습니다.');
    } catch (error) {
      console.error('스케줄러 시작 실패:', error);
      throw error;
    }
  }

  private async cleanup() {
    console.log('마켓 스케줄러 정리 시작');
    await this.cleanupTasks();
    this._isRunning = false;
    MarketScheduler.instance = null;
    console.log('마켓 스케줄러 정리 완료');
  }

  private async cleanupTasks() {
    for (const task of this.tasks.values()) {
      task.stop();
    }
    this.tasks.clear();
  }

  private async initialize() {
    console.log('마켓 스케줄러 초기화');
    this.supabase = await createClient();
    try {
      const { data: companies, error } = await this.supabase
        .from('companies')
        .select('*');

      if (error) throw error;

      if (companies && companies.length > 0) {
        const BATCH_SIZE = 50;  // 배치 처리 도입
        for (let i = 0; i < companies.length; i += BATCH_SIZE) {
          await Promise.all(companies.slice(i, i + BATCH_SIZE).map((company: Company) =>
            this.retryOperation(async () => {
              const result = await this.supabase
                .from('companies')
                .update({ last_closing_price: company.current_price })
                .eq('id', company.id)
              return result
            })
          ));
        }
      }
    } catch (error) {
      console.error('초기화 중 오류 발생:', error);
      throw new Error('마켓 스케줄러 초기화 실패');
    }
  }

  private async updateMarket() {
    try {
      await this.updateStatus({
        status: 'running',
        lastRun: new Date(),
        nextRun: this.calculateNextRun('market_update'),
        jobType: 'market_update'
      });
      
      if (!this.isMarketOpen()) {
        console.log('장 운영 시간이 아닙니다.');
        return;
      }
      
      const holdingsPromise = this.supabase
        .from('holdings')
        .select('company_id, shares')
        .gte('updated_at', getDbTimeXMinutesAgo(5));
        
      const recentNewsPromise = this.supabase
        .from('news')
        .select('*')
        .gte('published_at', getDbTimeXMinutesAgo(5));
        
      const companiesPromise = this.supabase
        .from('companies')
        .select('*');
        
      const [, recentNewsResult, companiesResult] = await Promise.all([
        holdingsPromise,
        recentNewsPromise,
        companiesPromise
      ]) as [
        PostgrestResponse<Holdings>,
        PostgrestResponse<NewsRecord>,
        PostgrestResponse<Company>
      ];
      
      const recentNews = recentNewsResult.data || [];
      const companies = companiesResult.data;
      
      if (companies && companies.length > 0) {
        const updates = await Promise.all(
          companies.map(async (company: Company) => {
            if (company.is_delisted) return;
            
            const newBasePrice = await this.calculateNewPrice(company);
            const companyNewsImpact = await this.calculateCompanyNewsImpact(company.id, recentNews);
            
            const finalPrice = newBasePrice * (
              1 + (companyNewsImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.NEWS)
            );

            const priceChange = (finalPrice - company.current_price) / company.current_price;
            const previousMovement = this.priceMovementCache.get(company.id) || {
              direction: 'neutral',
              consecutiveCount: 0,
              lastChange: 0
            };
            
            this.updatePriceMovement(company.id, priceChange, previousMovement);
          
            
            return {
              id: crypto.randomUUID(),
              company_id: company.id,
              old_price: Number(company.current_price.toFixed(4)),
              new_price: Number(finalPrice.toFixed(4)),
              change_percentage: Number((priceChange * 100).toFixed(4)),
              update_reason: this.generateUpdateReason(companyNewsImpact),
              created_at: new Date().toISOString()
            };
          })
        );

        await Promise.all(
          updates.filter(Boolean).map(async (update) => {
            await this.retryOperation(async () => {
              const result = await this.supabase
                .from('price_updates')
                .insert(update!)
              return result;
            });

            await this.retryOperation(async () => {
              const result = await this.supabase
                .from('companies')
                .update({
                  previous_price: update!.old_price,
                  current_price: update!.new_price,
                })
                .eq('id', update!.company_id)
              return result;
            });
          })
        );
      }
      console.log('시장 업데이트 완료');
      
      const { data: users } = await this.supabase
        .from('profiles')
        .select('id');
      if (users && users.length > 0) {
        const portfolioTracker = new PortfolioTracker();
        await Promise.all(
          users.map((user: Profile) => portfolioTracker.recordPerformance(user.id))
        );
      }
      await this.updateStatus({
        status: 'running',
        lastRun: new Date(),
        nextRun: this.calculateNextRun('market_update'),
        jobType: 'market_update'
      });
    } catch (error) {
      await this.updateStatus({
        status: 'error',
        lastRun: new Date(),
        nextRun: null,
        errorMessage: error instanceof Error ? error.message : '알 수 없는 오류가 발생했습니다.',
        jobType: 'market_update'
      });
      throw error;
    }
  }

  private generateUpdateReason(companyNewsImpact: number): string {
    const reasons: string[] = [];
    
    if (Math.abs(companyNewsImpact) > 0.01) {
      reasons.push(`기업 뉴스 영향 (${(companyNewsImpact * 100).toFixed(2)}%)`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : '일반 시장 변동';
  }

  private calculateMomentumFactor(movement: {
    direction: 'up' | 'down' | 'neutral',
    consecutiveCount: number,
    lastChange: number
  }): number {
    if (movement.consecutiveCount <= 1) return 1.0;
    
    const momentumStrength = Math.min(
      movement.consecutiveCount * Math.abs(movement.lastChange) * 0.3,
      0.05
    );
    
    const baseReversalChance = SIMULATION_PARAMS.PRICE.REVERSAL.BASE_CHANCE;
    const reversalChance = Math.min(
      baseReversalChance + 
      Math.pow(movement.consecutiveCount, 1.5) * SIMULATION_PARAMS.PRICE.REVERSAL.MOMENTUM_MULTIPLIER,
      SIMULATION_PARAMS.PRICE.REVERSAL.MAX_CHANCE
    );
    
    if (movement.consecutiveCount >= 5) {
      return movement.direction === 'up' ? 
        1 - (momentumStrength * 1.2) : 
        1 + (momentumStrength * 1.5);
    }
    
    if (Math.random() < reversalChance) {
      return movement.direction === 'up' ? 
        1 - momentumStrength : 
        1 + momentumStrength;
    }
    
    return movement.direction === 'up' ? 
      1 + (momentumStrength * 0.8) :
      1 - (momentumStrength * 0.7);
  }

  private updatePriceMovement(
    key: string,
    change: number,
    previousMovement: {
      direction: 'up' | 'down' | 'neutral',
      consecutiveCount: number,
      lastChange: number
    }
  ) {
    const newDirection = change > 0 ? 'up' : change < 0 ? 'down' : 'neutral';
    
    let consecutiveCount = 
      newDirection === previousMovement.direction ? 
      previousMovement.consecutiveCount + 1 : 1;
      
    const reversalThreshold = Math.min(0.3 + (consecutiveCount * 0.1), 0.9);
    if (consecutiveCount > 3 && Math.random() < reversalThreshold) {
      consecutiveCount = 1;
      change *= 0.5;
    }

    this.priceMovementCache.set(key, {
      direction: newDirection,
      consecutiveCount,
      lastChange: change
    });
  }

  private async generateCompanyNews() {
    try {
      const supabase = await this.ensureConnection();
      const { data: companies, error } = await supabase
        .from('companies')
        .select('*');
      if (error) throw error;

      // 확률 체크 제거, 항상 뉴스 생성
      if (companies && companies.length > 0) {
        const randomCompany = companies[Math.floor(Math.random() * companies.length)];
        const templatesForIndustry = this.getNewsTemplatesForIndustry(randomCompany.industry);
        const companyNews = this.selectRandomNews(templatesForIndustry);
        await this.createNews({
          ...companyNews,
          title: `[${randomCompany.name}] ${companyNews.title}`,
          content: `${randomCompany.name}(${randomCompany.ticker}): ${companyNews.content}`,
          company_id: randomCompany.id
        });
        console.log(`${randomCompany.name} 기업 뉴스 발생:`, companyNews.title);
      }
      
      this.priceCache.clear();
    } catch (error) {
      console.error('기업 뉴스 생성 중 오류:', error);
      throw new Error('기업 뉴스 생성 실패');
    }
  }

  private selectRandomNews(templates: NewsTemplate[]): NewsTemplate {
    const template = templates[Math.floor(Math.random() * templates.length)];
    // 변동성 요소 (±20% 랜덤 변동)
    const volatilityFactor = 1 + (Math.random() * 0.4 - 0.2);
    return {
      ...template,
      impact: template.impact * volatilityFactor
    };
  }

  private async createNews(news: NewsTemplate & { company_id?: string }) {
    try {
      const supabase = await this.ensureConnection();
      const seoulTime = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
      ).toISOString();

      const { error } = await this.retryOperation(async () => {
        const result = await supabase.from('news').insert({
          ...news,
          published_at: seoulTime
        });
        return result;
      });
      if (error) throw error;
    } catch (error) {
      console.error('뉴스 생성 중 오류 발생:', error);
      throw new Error('뉴스 생성 실패');
    }
  }

  private calculateSentimentMultiplier(sentiment: string): number {
    switch (sentiment) {
      case 'positive': return 1.2;
      case 'negative': return 1.2;
      default: return 1.0;
    }
  }

  private async calculateCompanyNewsImpact(companyId: string, recentNews: NewsRecord[]): Promise<number> {
    // 해당 회사의 시가총액 정보 가져오기
    const companyResponse = await this.supabase
      .from('companies')
      .select('market_cap')
      .eq('id', companyId)
      .single();
    const company = companyResponse.data;

    if (!company) {
      throw new Error(`회사 데이터를 찾을 수 없습니다. ID: ${companyId}`);
    }

    const marketCapMultiplier = this.calculateMarketCapNewsMultiplier(company.market_cap);

    const now = new Date();
    // 해당 회사의 뉴스 필터 (뉴스 타입과 회사 ID 체크) 및 각 뉴스마다 1~20분 사이 랜덤 유효시간 할당
    const eligibleNews = recentNews
      .filter((news) => news.type === 'company' && news.company_id === companyId)
      .map((news) => {
        const effectiveDuration = Math.floor(Math.random() * 20) + 1; // 1~20분 사이의 랜덤 유효시간
        const timeElapsed = (now.getTime() - new Date(news.published_at).getTime()) / (60 * 1000);
        return { news, effectiveDuration, timeElapsed };
      })
      .filter(({ timeElapsed, effectiveDuration }) => timeElapsed <= effectiveDuration);

    const newsCount = eligibleNews.length;
    // 뉴스 개수가 많을수록 개별 뉴스 영향력 감쇠 (원래 로직 유지)
    const diminishingFactor = newsCount > 0 ? Math.pow(0.7, newsCount - 1) : 1;

    let totalImpact = eligibleNews.reduce((sum, { news, effectiveDuration, timeElapsed }) => {
      // 감쇠 계수: 뉴스 발행 후 시간에 따라 선형적으로 감소
      const decayFactor = Math.max(0, 1 - (timeElapsed / effectiveDuration));
      const directionMultiplier = Math.random() < 0.7 ? 1 : -0.5;
      const impactVariation =
        SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN +
        Math.random() *
          (SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MAX - SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN);
      const baseImpact = news.impact * impactVariation * directionMultiplier;
      const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
      const volatilityMultiplier = news.volatility >= 1.8 ? 1.2 : 1.0;

      const newsImpact = baseImpact * sentimentMultiplier * volatilityMultiplier * decayFactor * marketCapMultiplier * diminishingFactor;

      // 뉴스 별 영향력 범위를 -0.02 ~ 0.02로 제한
      return sum + Math.max(Math.min(newsImpact, 0.02), -0.02);
    }, 0);

    // 전체 뉴스 영향력 범위를 -0.05 ~ 0.05로 제한
    totalImpact = Math.max(Math.min(totalImpact, 0.05), -0.05);
    return totalImpact;
  }

  private calculateMarketCapNewsMultiplier(marketCap: number): number {
    // 시가총액이 클수록 뉴스 영향력 증가
    if (marketCap > 100000000000) return 1.4;  // 1000억 이상
    if (marketCap > 10000000000) return 1.2;   // 100억 이상
    if (marketCap > 10000000000) return 1.1;    // 10억 이상
    return 1.0;
  }

  private async calculateNewPrice(company: Company): Promise<number> {
    const basePrice = company.current_price;
    
    const randomChange = (Math.random() - 0.5) * SIMULATION_PARAMS.PRICE.BASE_RANDOM_CHANGE;
    
    const industryVolatility = this.calculateIndustryVolatility(company.industry);
    const timeVolatility = this.calculateTimeVolatility(new Date().getHours());
    const marketCapVolatility = this.calculateMarketCapVolatility(company.market_cap);
    
    const baseChange = (
      randomChange * SIMULATION_PARAMS.PRICE.WEIGHTS.RANDOM
    ) * industryVolatility * timeVolatility * marketCapVolatility;

    return basePrice * (1 + baseChange);
  }

  private calculateIndustryVolatility(industry: Industry): number {
    return SIMULATION_PARAMS.INDUSTRY.VOLATILITY[industry] || 1.0;
  }

  // 시간대별 변동성 계산 (타임존 관련 처리는 기존대로 유지)
  private calculateTimeVolatility(hour: number): number {
    if (hour === 9) return 1.8;
    if (hour >= 11 && hour <= 13) return 0.7;
    if (hour >= 14) return 1.4;
    return 1.0;
  }

  private async setOpeningPrices() {
    const { data: companies } = await this.supabase.from('companies').select('*');
    if (companies && companies.length > 0) {
      await Promise.all(
        companies.map(async (company: Company) => {
          const priceChange = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
          const openingPrice = company.last_closing_price * (1 + priceChange);
          
          // price_updates 테이블에 기록
          await this.retryOperation(async () => {
            return await this.supabase
              .from('price_updates')
              .insert({
                id: crypto.randomUUID(),
                company_id: company.id,
                old_price: Number(company.current_price.toFixed(4)),
                new_price: Number(openingPrice.toFixed(4)),
                change_percentage: Number((priceChange * 100).toFixed(4)),
                update_reason: '장 시작',
                created_at: new Date().toISOString()
              });
          });

          // companies 테이블 업데이트
          await this.retryOperation(async () => {
            return await this.supabase
              .from('companies')
              .update({
                previous_price: company.current_price,
                current_price: openingPrice,
              })
              .eq('id', company.id);
          });
        })
      );
    }
  }

  private async setClosingPrices() {
    const { data: companies } = await this.supabase.from('companies').select('*');
    if (companies && companies.length > 0) {
      await Promise.all(
        companies.map(async (company: Company) => {
          // price_updates 테이블에 기록
          await this.retryOperation(async () => {
            return await this.supabase
              .from('price_updates')
              .insert({
                id: crypto.randomUUID(),
                company_id: company.id,
                old_price: Number(company.current_price.toFixed(4)),
                new_price: Number(company.current_price.toFixed(4)),
                change_percentage: 0,
                update_reason: '장 마감',
                created_at: new Date().toISOString()
              });
          });

          // companies 테이블 업데이트
          await this.retryOperation(async () => {
            return await this.supabase
              .from('companies')
              .update({ last_closing_price: company.current_price })
              .eq('id', company.id);
          });
        })
      );
    }
  }

  private async updateStatus(status: SchedulerStatus) {
    try {
      const supabase = await this.ensureConnection();
      const { error } = await supabase
        .from('scheduler_status')
        .upsert({
          status: status.status,
          last_run: status.lastRun?.toISOString(),
          next_run: status.nextRun?.toISOString(),
          error_message: status.errorMessage,
          job_type: status.jobType,
          updated_at: new Date().toISOString()
        });
      if (error) throw error;
    } catch (error) {
      console.error('스케줄러 상태 업데이트 중 오류:', error);
    }
  }

  private calculateNextRun(jobType: string): Date {
    const now = new Date();
    switch (jobType) {
      case 'market_update':
        return new Date(now.getTime() + 10 * 60000); // 10분 후
      case 'news_generation':
        return new Date(now.getTime() + 30 * 60000); // 30분 후로 수정
      default:
        return now;
    }
  }

  public getNextRunTime(jobType: 'market_update' | 'news_generation') {
    return this.calculateNextRun(jobType);
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  get lastMarketUpdateTime(): Date | null {
    return this.lastMarketUpdate;
  }

  get lastNewsUpdateTime(): Date | null {
    return this.lastNewsUpdate;
  }

  private async ensureConnection() {
    if (!this.supabase) {
      await this.initialize();
    }
    return this.supabase;
  }

  private getNewsTemplatesForIndustry(industry: string): NewsTemplate[] {
    if (this.newsTemplateCache.has(industry)) {
      return this.newsTemplateCache.get(industry)!;
    }
    // 5개의 분류에 맞게 템플릿 선택
    const templates = {
      '전자': this.companyNewsTemplates,
      'IT': this.companyNewsTemplates,
      '제조': this.companyNewsTemplates,
      '건설': this.companyNewsTemplates,
      '식품': this.companyNewsTemplates
    }[industry] || this.companyNewsTemplates;
    this.newsTemplateCache.set(industry, templates);
    return templates;
  }

  // 재시도 로직: 비동기 작업을 지정 횟수만큼 재시도합니다.
  private async retryOperation<T>(
    operation: () => Promise<PostgrestResponse<T> | PostgrestSingleResponse<T>>
  ): Promise<PostgrestResponse<T> | PostgrestSingleResponse<T>> {
    let lastError;
    for (let i = 0; i < 3; i++) {
      try {
        return await operation();
      } catch (e) {
        lastError = e;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw lastError;
  }

  private async checkDelisting(company: Company, newPrice: number): Promise<Company> {
    if (company.is_delisted) return company;

    if (newPrice <= 0) {
      // 주가가 0원 이하이면 상장폐지 처리
      newPrice = 0;
      company.is_delisted = true;
      console.log(`${company.name} (${company.ticker})의 주가가 0원에 도달하여 상장폐지 처리되었습니다.`);
    } else {
      // 주가가 0원이 아니라면 연속 하락일수 처리 (원래 로직 유지)
      let updatedDownDays = company.consecutive_down_days || 0;
      if (newPrice < company.current_price) {
        updatedDownDays += 1;
      } else {
        updatedDownDays = 0;
      }
      company.consecutive_down_days = updatedDownDays;
      console.log(`${company.name}: 연속 하락일수 ${updatedDownDays}일, 현재 가격 ${newPrice.toFixed(2)}원.`);
    }

    await this.supabase
      .from('companies')
      .update({
        consecutive_down_days: company.consecutive_down_days,
        is_delisted: company.is_delisted,
        current_price: newPrice
      })
      .eq('id', company.id);

    return { ...company, current_price: newPrice };
  }

  private calculateMarketCapVolatility(marketCap: number): number {
    if (marketCap >= SIMULATION_PARAMS.MARKET_CAP.THRESHOLDS.LARGE) {
      return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.LARGE;
    } else if (marketCap >= SIMULATION_PARAMS.MARKET_CAP.THRESHOLDS.MEDIUM) {
      return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.MEDIUM;
    }
    return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.SMALL;
  }

  private async calculateIndustryLeaderImpact(
    industry: string, 
    currentCompanyId: string
  ): Promise<number> {
    // 동일 산업 내 시가총액 상위 3개 기업의 최근 가격 변동 평균 계산
    const { data: leaders } = await this.supabase
      .from('companies')
      .select('id, current_price, previous_price, market_cap')
      .eq('industry', industry)
      .neq('id', currentCompanyId)
      .order('market_cap', { ascending: false })
      .limit(3);
      
    if (!leaders?.length) return 0;
    
    const averageChange = leaders.reduce(
      (sum: number, leader: { current_price: number; previous_price: number }) => {
        const priceChange = (leader.current_price - leader.previous_price) / leader.previous_price;
        return sum + (priceChange / leaders.length);
      },
      0
    );

    return averageChange;
  }
}