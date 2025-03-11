import { createClient } from '@/lib/supabase/server'
import { PortfolioTracker } from '@/services/portfolio-tracker'
import type { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js'
import { getDbTimeXMinutesAgo } from '@/lib/timeUtils'
import { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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
  applied?: boolean;
}

type Industry = '전자' | 'IT' | '제조' | '건설' | '식품';

interface Company {
  id: string;
  name: string;
  ticker: string;
  description: string;
  industry: Industry;
  current_price: number;
  market_cap: number;
  shares_issued: number;
  previous_price: number;
  last_closing_price: number;
  is_delisted: boolean;
  consecutive_down_days: number;
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
    COMPANY_NEWS_CHANCE: 1.0,           
    IMPACT_VARIATION_MIN: 0.7,          // 0.9 -> 0.7 (최소 영향력 감소)
    IMPACT_VARIATION_MAX: 1.2,          // 1.5 -> 1.2 (최대 영향력 감소)
    DECAY_TIME_MINUTES: 30,             // 45 -> 30 (뉴스 영향력 지속 시간 감소)
    NEWS_COUNT_PER_UPDATE: {
      MIN: 1,                           // 최소 뉴스 생성 개수
      MAX: 10                           // 최대 뉴스 생성 개수
    },          
  },
  PRICE: {
    BASE_RANDOM_CHANGE: 0.006,          // 0.008 -> 0.006 (랜덤 변동성 감소)
    REVERSAL: {
      BASE_CHANCE: 0.05,                
      MOMENTUM_MULTIPLIER: 0.07,         
      MAX_CHANCE: 0.70                   
    },
    DAILY_LIMIT: 0.30,                   
    WEIGHTS: {
      RANDOM: 0.15,                     // 0.25 -> 0.15 (랜덤 가중치 감소)
      NEWS: 0.20,                       // 0.35 -> 0.20 (뉴스 영향력 감소)
      INDUSTRY: 0.25,                   // 0.20 -> 0.25 (산업 영향력 증가)
      MOMENTUM: 0.30,                   // 0.25 -> 0.30 (모멘텀 영향력 증가)
      INDUSTRY_LEADER: 0.25             // 0.20 -> 0.25 (산업 리더 영향력 증가)
    }
  },
  INDUSTRY: {
    VOLATILITY: {
      'IT': 1.3,                        // 산업별 변동성 감소
      '전자': 1.2,
      '제조': 1.1,
      '건설': 1.05,
      '식품': 1.0
    } as const
  },
  MARKET_CAP: {
    VOLATILITY: {
      LARGE: 1.0,
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
  private supabase!: SupabaseClient;
  private readonly MARKET_OPEN_HOUR = 9;    // 장 시작 시간
  private readonly MARKET_CLOSE_HOUR = 24;   // 장 마감 시간 (자정)
  private newsTemplateCache: Map<string, NewsTemplate[]> = new Map();
  private priceCache: Map<string, number> = new Map();
  private priceMovementCache: Map<string, {
    direction: 'up' | 'down' | 'neutral',
    consecutiveCount: number,
    lastChange: number
  }> = new Map();

  static async getInstance(): Promise<MarketScheduler> {
    if (!MarketScheduler.instance) {
      MarketScheduler.instance = new MarketScheduler();
      await MarketScheduler.instance.initialize();
    }
    return MarketScheduler.instance;
  }

  public isMarketOpen(): boolean {
    const now = new Date();
    // 서버의 UTC 시간에 9시간을 더해 한국 시간으로 보정
    const koreaHour = (now.getUTCHours() + 9) % 24;
    return koreaHour >= this.MARKET_OPEN_HOUR && koreaHour < this.MARKET_CLOSE_HOUR;
  }

  private async initialize() {
    if (!this.supabase) {
      this.supabase = await createClient();
    }
    
    // 초기화 시 템플릿 캐시 로드
    await this.loadNewsTemplates();
  }

  private isScheduledTime(type: 'market' | 'news'): boolean {
    const now = new Date();
    
    if (type === 'market') {
      // 매 분 실행 허용
      return true;
    }
    
    if (type === 'news') {
      // 30분 단위 체크만 유지
      return now.getMinutes() % 30 === 0;
    }
    
    return false;
  }

  public async updateMarket() {
    console.log('마켓 업데이트 요청 받음:', new Date().toISOString());
    
    if (!this.isMarketOpen()) {
      console.log('장 마감 상태입니다. 마켓 업데이트를 건너뜁니다.');
      return;
    }

    try {
      const holdingsPromise = this.supabase
        .from('holdings')
        .select('*');
        
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
            
            const finalPrice = newBasePrice * (1 + companyNewsImpact);

            const priceChange = (finalPrice - company.current_price) / company.current_price;
            
            // 시가총액 업데이트 계산 (발행주식수 기반)
            const newMarketCap = Math.round(finalPrice * company.shares_issued);

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
              created_at: new Date().toISOString(),
              old_market_cap: company.market_cap,
              new_market_cap: newMarketCap
            };
          })
        );

        // 업데이트 실행
        await Promise.all(
          updates.filter(Boolean).map(async (update) => {
            // price_updates 테이블 업데이트
            await this.retryOperation(async () => {
              const result = await this.supabase
                .from('price_updates')
                .insert(update!)
              return result;
            });

            // companies 테이블 업데이트
            await this.retryOperation(async () => {
              const result = await this.supabase
                .from('companies')
                .update({
                  previous_price: update!.old_price,
                  current_price: update!.new_price,
                  market_cap: update!.new_market_cap
                })
                .eq('id', update!.company_id)
              return result;
            });
          })
        );
      }
      console.log('시장 업데이트 완료');
      
      // 포트폴리오 성과 기록
      const { data: users } = await this.supabase
        .from('profiles')
        .select('id');
      if (users && users.length > 0) {
        const portfolioTracker = new PortfolioTracker();
        await Promise.all(
          users.map((user: Profile) => portfolioTracker.recordPerformance(user.id))
        );
      }
    } catch (error) {
      console.error('마켓 업데이트 중 오류:', error);
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
    
    // 모멘텀 강도를 로그 스케일로 계산하여 급격한 증가 방지
    const logBase = 1.5;
    const momentumStrength = Math.min(
      (Math.log(movement.consecutiveCount) / Math.log(logBase)) * 
      Math.abs(movement.lastChange) * 
      0.2, // 전체적인 영향력 감소
      0.04  // 최대 영향력 제한
    );
    
    // 반전 확률을 연속 횟수에 따라 지수적으로 증가
    const baseReversalChance = SIMULATION_PARAMS.PRICE.REVERSAL.BASE_CHANCE;
    const reversalChance = Math.min(
      baseReversalChance + 
      (1 - Math.exp(-movement.consecutiveCount * 0.3)) * // 지수적 증가
      SIMULATION_PARAMS.PRICE.REVERSAL.MOMENTUM_MULTIPLIER,
      SIMULATION_PARAMS.PRICE.REVERSAL.MAX_CHANCE
    );
    
    // 반전 확률에 변동성 추가
    const volatilityFactor = 1 + (Math.random() * 0.2 - 0.1); // ±10% 변동
    const finalReversalChance = reversalChance * volatilityFactor;
    
    if (Math.random() < finalReversalChance) {
      // 반전 시 영향력을 점진적으로 적용
      return movement.direction === 'up' ? 
        1 - (momentumStrength * 0.7) : // 하락 반전 시 영향력 감소
        1 + (momentumStrength * 0.8);  // 상승 반전 시 영향력 증가
    }
    
    // 기존 추세 유지 시 영향력을 감소
    const trendDecay = Math.exp(-movement.consecutiveCount * 0.1); // 지속 기간에 따른 감쇠
    return movement.direction === 'up' ? 
      1 + (momentumStrength * 0.6 * trendDecay) :
      1 - (momentumStrength * 0.5 * trendDecay);
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

      // 뉴스 생성 개수를 1~10개 사이에서 랜덤하게 설정
      const randomNewsCount = Math.floor(
        Math.random() * (SIMULATION_PARAMS.NEWS.NEWS_COUNT_PER_UPDATE.MAX - SIMULATION_PARAMS.NEWS.NEWS_COUNT_PER_UPDATE.MIN + 1)
      ) + SIMULATION_PARAMS.NEWS.NEWS_COUNT_PER_UPDATE.MIN;
      
      const newsCount = Math.min(randomNewsCount, companies?.length || 0);
      
      if (companies && companies.length > 0) {
        // 기업 목록을 섞어서 중복 없이 선택하기 위한 배열 생성
        const shuffledCompanies = [...companies].sort(() => Math.random() - 0.5);
        
        // 최대 newsCount 개수만큼 뉴스 생성 (기업 수보다 많을 수 없음)
        for (let i = 0; i < newsCount; i++) {
          // 섞인 배열에서 순서대로 기업 선택 (중복 없음)
          const company = shuffledCompanies[i];
          const templatesForIndustry = await this.getNewsTemplatesForIndustry(company.industry);
          const companyNews = this.selectRandomNews(templatesForIndustry);
          
          await this.createNews({
            ...companyNews,
            title: `[${company.name}] ${companyNews.title}`,
            content: `${company.name}(${company.ticker}): ${companyNews.content}`,
            company_id: company.id
          });
          
          console.log(`${company.name} 기업 뉴스 발생:`, companyNews.title);
        }
        
        console.log(`총 ${newsCount}개의 뉴스가 생성되었습니다. (각 기업당 최대 1개)`);
      }
      
      this.priceCache.clear();
    } catch (error) {
      console.error('기업 뉴스 생성 중 오류:', error);
      throw new Error('기업 뉴스 생성 실패');
    }
  }

  private selectWeightedNews(templates: NewsTemplate[]): NewsTemplate {
    // volatility 기반 가중치 계산 로직 수정
    const weights = templates.map((template) => {
      const vol = template.volatility ?? 1.0;
      // 지수를 2.0으로 높여서 높은 volatility의 뉴스가 선택될 확률을 더 낮춤
      return Math.pow(1 / vol, 2.0); // 지수를 2.0으로 증가 (기존 1.0)
    });

    // 모든 weight의 합 계산
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);

    // 0 ~ totalWeight 사이의 난수 생성
    const randomValue = Math.random() * totalWeight;

    // 누적 가중치 합계를 이용해 선택
    let cumulative = 0;
    for (let i = 0; i < templates.length; i++) {
      cumulative += weights[i];
      if (randomValue <= cumulative) {
        return templates[i];
      }
    }
    
    return templates[templates.length - 1];
  }

  private selectRandomNews(templates: NewsTemplate[]): NewsTemplate {
    // 가중치 기반 뉴스 템플릿 선택
    const selectedTemplate = this.selectWeightedNews(templates);
    // 변동성 요소 (±20% 랜덤 변동) 적용
    const volatilityFactor = 1 + (Math.random() * 0.4 - 0.2);
    return {
      ...selectedTemplate,
      impact: selectedTemplate.impact * volatilityFactor
    };
  }

  private async createNews(news: NewsTemplate & { company_id?: string }) {
    try {
      const supabase = await this.ensureConnection();
      // UTC 시간을 그대로 사용
      const currentTime = new Date().toISOString();

      const { error } = await this.retryOperation(async () => {
        const result = await supabase.from('news').insert({
          title: news.title,
          content: news.content,
          sentiment: news.sentiment,
          impact: news.impact,
          type: news.type,
          volatility: news.volatility || 1.0,
          company_id: news.company_id,
          published_at: currentTime
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
      case 'positive':
        return 1.2; // 기존 값 유지
      case 'negative':
        return -1.2; // 기존 값 유지
      default:
        return 0.3; // 0.5 -> 0.3 (중립적 뉴스 영향력 감소)
    }
  }

  private getEffectiveDuration(volatility: number): number {
    const minDuration = 5;    // 최소 1분 -> 5분
    const maxDuration = 30;   // 최대 20분 -> 30분
    const volatilityMin = 1.0; // volatility 최소값
    const volatilityMax = 3.0; // volatility 최대값

    // volatility 값을 volatilityMin과 volatilityMax 사이로 클램핑
    const clampedVolatility = Math.min(Math.max(volatility, volatilityMin), volatilityMax);
    
    // 0~1 사이의 값으로 정규화
    const normalized = (clampedVolatility - volatilityMin) / (volatilityMax - volatilityMin);
    
    // 선형 매핑: normalized가 0이면 minDuration, 1이면 maxDuration
    return Math.round(minDuration + normalized * (maxDuration - minDuration));
  }

  private async calculateCompanyNewsImpact(companyId: string, recentNews: NewsRecord[]): Promise<number> {
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
    let totalPerMinuteImpact = 0;

    const activeNews = recentNews.filter(news => 
      news.type === 'company' && 
      news.company_id === companyId && 
      !news.applied
    );

    for (const news of activeNews) {
      const timeElapsed = (now.getTime() - new Date(news.published_at).getTime()) / (60 * 1000);
      const effectiveDuration = this.getEffectiveDuration(news.volatility);
      
      if (timeElapsed <= effectiveDuration) {
        // 뉴스 해석의 불확실성 추가
        const marketSentiment = Math.random(); // 시장 심리 팩터
        
        // 긍정/부정 뉴스 반대로 해석될 확률 대폭 감소
        const interpretationChance = 0.15; // 0.3 -> 0.15 (30% -> 15%)
        const reverseInterpretation = Math.random() < interpretationChance;
        
        // 방향성 결정 (기존 영향력의 방향을 뒤집을 수 있음)
        const directionMultiplier = reverseInterpretation ? -1 : 1;
        
        // 변동성에 따른 임팩트 변화
        const impactVariation = 
          SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN +
          Math.random() * (SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MAX - SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN);
        
        // 기본 영향력 계산
        const baseImpact = news.impact * impactVariation * directionMultiplier;
        
        // 시장 심리에 따른 증폭/감소 조정
        const marketSentimentMultiplier = marketSentiment < 0.3 ? 0.6 : // 0.7 -> 0.6 (부정적 시장 영향 더 감소)
                                        marketSentiment > 0.7 ? 1.4 : // 1.8 -> 1.4 (긍정적 시장 영향 감소)
                                        1.0; // 1.2 -> 1.0 (중립적 시장 영향 감소)
        
        const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
        const volatilityMultiplier = news.volatility >= 1.8 ? 1.1 : 0.9; // 1.2/1.0 -> 1.1/0.9 (변동성 영향 감소)

        // 최종 영향력 계산
        const perMinuteImpact = baseImpact * sentimentMultiplier * volatilityMultiplier * 
                               marketCapMultiplier * marketSentimentMultiplier;
        
        // 최종 영향력 범위 제한 값 감소
        const clampedImpact = Math.max(Math.min(perMinuteImpact, 0.05), -0.05); // 0.08 -> 0.05 (최대 영향력 감소)
        totalPerMinuteImpact += clampedImpact;
      } else {
        await this.supabase
          .from('news')
          .update({ applied: true })
          .eq('id', news.id);
      }
    }

    // 최종 영향도에 랜덤 노이즈 추가
    const randomNoise = (Math.random() - 0.5) * 0.01; // 0.02 -> 0.01 (랜덤 노이즈 감소)
    
    // 뉴스 개수가 많아졌으므로 영향력 분산을 위해 추가 감소 계수 적용
    const newsCountDampener = 0.7; // 뉴스 개수가 많아져서 각 뉴스의 영향력을 분산시키는 계수
    
    return (totalPerMinuteImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.NEWS * newsCountDampener) + randomNoise;
  }

  private calculateMarketCapNewsMultiplier(marketCap: number): number {
    // 시가총액이 클수록 뉴스 영향력 증가
    if (marketCap > 100000000000) return 1.4;  // 1000억 이상
    if (marketCap > 10000000000) return 1.2;   // 100억 이상
    if (marketCap > 10000000000) return 1.1;    // 10억 이상
    return 1.0;
  }

  private calculateTimeVolatility(hour: number): number {
    // 시간대별 변동성 가중치 감소
    if (hour >= 9 && hour < 10) return 1.4;  // 1.8 -> 1.4
    if (hour >= 10 && hour < 11) return 1.2; // 1.4 -> 1.2
    if (hour >= 11 && hour <= 13) return 0.7;
    if (hour >= 14 && hour < 15) return 1.1; // 1.2 -> 1.1
    if (hour >= 15) return 1.3;              // 1.6 -> 1.3
    return 1.0;
  }

  private randomGaussian(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
  }

  private async calculateNewPrice(company: Company): Promise<number> {
    if (company.is_delisted) return 0;
    
    const basePrice = company.current_price;
    
    // 가우시안 노이즈 강화
    const baseRandomChange = (Math.random() - 0.5) * SIMULATION_PARAMS.PRICE.BASE_RANDOM_CHANGE;
    const gaussianNoise = this.randomGaussian(0, 0.004); // 가우시안 노이즈 감소 (0.008 -> 0.004)
    const randomChange = baseRandomChange + gaussianNoise;
    
    const industryVolatility = this.calculateIndustryVolatility(company.industry);
    const timeVolatility = this.calculateTimeVolatility(new Date().getHours());
    const marketCapVolatility = this.calculateMarketCapVolatility(company.market_cap);
    
    const industryLeaderImpact = await this.calculateIndustryLeaderImpact(company.industry, company.id);
    
    const previousMovement = this.priceMovementCache.get(company.id) || {
      direction: 'neutral',
      consecutiveCount: 0,
      lastChange: 0
    };
    const momentumFactor = this.calculateMomentumFactor(previousMovement);
    
    // 변동성 요소들을 결합하여 최종 가격 변화율 계산
    const baseChange = (
      randomChange * SIMULATION_PARAMS.PRICE.WEIGHTS.RANDOM +
      industryLeaderImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.INDUSTRY_LEADER
    ) * industryVolatility * timeVolatility * marketCapVolatility * momentumFactor;

    let newPrice = basePrice * (1 + baseChange);
    
    // 주가가 0원 이하면 상장폐지 처리
    if (newPrice <= 0) {
      await this.supabase
        .from('companies')
        .update({
          is_delisted: true,
          current_price: 0
        })
        .eq('id', company.id);
      return 0;
    }
    
    this.updatePriceMovement(
      company.id,
      baseChange,
      previousMovement
    );

    return newPrice;
  }

  private calculateIndustryVolatility(industry: Industry): number {
    return SIMULATION_PARAMS.INDUSTRY.VOLATILITY[industry] || 1.0;
  }

  public async setOpeningPrices(): Promise<void> {
    if (!this.isMarketOpen()) {
      console.log('마켓이 닫혀있습니다.');
      return;
    }
    const { data: companies } = await this.supabase.from('companies').select('*');
    if (companies && companies.length > 0) {
      await Promise.all(
        companies.map(async (company: Company) => {
          const priceChange = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
          const openingPrice = company.last_closing_price * (1 + priceChange);
          const newMarketCap = Math.round(openingPrice * company.shares_issued);
          
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
                created_at: new Date().toISOString(),
                old_market_cap: company.market_cap,
                new_market_cap: newMarketCap
              });
          });

          await this.retryOperation(async () => {
            return await this.supabase
              .from('companies')
              .update({
                previous_price: company.current_price,
                current_price: openingPrice,
                market_cap: newMarketCap
              })
              .eq('id', company.id);
          });
        })
      );
    }
  }

  public async setClosingPrices() {
    const { data: companies } = await this.supabase.from('companies').select('*');
    if (companies && companies.length > 0) {
      await Promise.all(
        companies.map(async (company: Company) => {
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
                created_at: new Date().toISOString(),
                old_market_cap: company.market_cap,
                new_market_cap: company.market_cap
              });
          });

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

  private async ensureConnection() {
    if (!this.supabase) {
      await this.initialize();
    }
    return this.supabase;
  }

  private async getNewsTemplatesForIndustry(industry: string): Promise<NewsTemplate[]> {
    // 캐시에 없으면 다시 로드
    if (!this.newsTemplateCache.has(industry)) {
      await this.loadNewsTemplates();
    }
    
    return this.newsTemplateCache.get(industry) || [];
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
    // 시가총액 규모별 변동성 차등 적용
    if (marketCap >= 200000000000) { // 2000억 이상 (대기업)
      return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.LARGE * 0.8; // 변동성 20% 감소
    } else if (marketCap >= 70000000000) { // 700억 이상 (중견기업)
      return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.MEDIUM;
    } else if (marketCap >= 30000000000) { // 300억 이상 (중소기업)
      return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.MEDIUM * 1.2; // 변동성 20% 증가
    } else if (marketCap >= 20000000000) { // 200억 이상 (강소기업)
      return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.SMALL * 1.3; // 변동성 30% 증가
    } else { // 스타트업
      return SIMULATION_PARAMS.MARKET_CAP.VOLATILITY.SMALL * 1.5; // 변동성 50% 증가
    }
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

    // 영향도 범위 제한 값 감소
    return Math.max(Math.min(averageChange * 0.3, 0.01), -0.01); // 0.02 -> 0.01, multiplier 0.5 -> 0.3
  }

  public async updateNews(): Promise<void> {
    console.log('뉴스 업데이트 요청 받음:', new Date().toISOString());

    if (!this.isMarketOpen()) {
      console.log('장 마감 상태입니다. 뉴스 업데이트를 건너뜁니다.');
      return;
    }

    try {
      console.log("뉴스 업데이트 실행 중");
      await this.generateCompanyNews();
      console.log('뉴스 업데이트 완료');
    } catch (error) {
      console.error('뉴스 업데이트 중 오류 발생:', error);
      throw error;
    }
  }

  // 뉴스 템플릿을 DB에서 로드하는 새 메서드
  private async loadNewsTemplates() {
    try {
      const { data, error } = await this.supabase
        .from('news_templates')
        .select('*')
        .eq('type', 'company');
        
      if (error) throw error;
      
      // 산업별 템플릿 캐시 초기화
      const industries: Industry[] = ['전자', 'IT', '제조', '건설', '식품'];
      
      for (const industry of industries) {
        this.newsTemplateCache.set(industry, data);
      }
      
      console.log(`${data.length}개의 뉴스 템플릿을 DB에서 로드했습니다.`);
    } catch (error) {
      console.error('뉴스 템플릿 로드 중 오류:', error);
      throw new Error('뉴스 템플릿 로드 실패');
    }
  }
}