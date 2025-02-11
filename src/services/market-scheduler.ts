import { createClient } from '@/lib/supabase/server'
import cron from 'node-cron'
import { PortfolioTracker } from '@/services/portfolio-tracker'
import type { PostgrestResponse } from '@supabase/supabase-js'
import { getDbTimeXMinutesAgo } from '@/lib/timeUtils'
import { useStockStore } from '@/stores/stockStore'
import { redis } from '@/lib/upstash-client'
import { StockCache } from '@/lib/cache/stock-cache'

interface NewsTemplate {
  title: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
  type: 'market' | 'company';
  volatility?: number; // 뉴스의 파급 정도
  company_id?: string;
  industry?: string; // 추가: 뉴스와 관련된 산업 정보
}

interface NewsRecord {
  id: string;
  title: string;
  content: string;
  company_id?: string;
  published_at: string;
  type: 'market' | 'company';
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

// 시뮬레이션 파라미터 상수 수정
const SIMULATION_PARAMS = {
  NEWS: {
    MARKET_NEWS_HOURLY_CHANCE: 1.0,     // 100% 확률로 변경
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
  private supabase: any;
  private _isRunning: boolean = false;
  // 기존 개별 작업 변수 대신 타스크를 관리할 Map 사용
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

  // 시장 뉴스 템플릿 (Market News Templates)
  private readonly marketNewsTemplates: NewsTemplate[] = [
    {
      title: '글로벌 금융 위기 발생',
      content: '주요국 증시 폭락과 함께 전세계 금융시장이 마치 지진처럼 흔들립니다!',
      sentiment: 'negative',
      impact: -0.30,
      type: 'market',
      volatility: 3.0
    },
    {
      title: '획기적인 AI 기술 발전',
      content: '신세대 AI 도입으로 모든 산업이 혁신의 물결을 타고 있습니다. 미래가 달라집니다!',
      sentiment: 'positive',
      impact: 0.20,
      type: 'market',
      volatility: 2.2
    },
    {
      title: '중앙은행 기준금리 인상',
      content: '예상보다 높은 금리 인상으로 금융시장이 긴장 상태에 돌입합니다.',
      sentiment: 'negative',
      impact: -0.10,
      type: 'market',
      volatility: 1.6
    },
    {
      title: '주요국 경기부양책 발표',
      content: '각국 정부가 대규모 경기부양책을 발표, 시장 활성화에 대한 기대감 상승!',
      sentiment: 'positive',
      impact: 0.10,
      type: 'market',
      volatility: 1.5
    },
    {
      title: '국제유가 소폭 상승',
      content: '원자재 가격이 소폭 상승하면서 에너지 관련 기업에 미미한 영향 발생',
      sentiment: 'neutral',
      impact: -0.03,
      type: 'market',
      volatility: 1.2
    },
    {
      title: '글로벌 사이버 공격 발생',
      content: '전 세계 증권 거래소가 사이버 공격으로 일시 마비, 시장에 혼란을 초래합니다!',
      sentiment: 'negative',
      impact: -0.15,
      type: 'market',
      volatility: 2.0
    },
    {
      title: '세계 각국 축제 열풍',
      content: '국제 문화 축제가 동시에 열리며 소비 심리가 급상승, 긍정적 분위기 확산!',
      sentiment: 'positive',
      impact: 0.08,
      type: 'market',
      volatility: 1.3
    },
    {
      title: '메타버스 혁명 시작',
      content: '가상현실과 현실의 경계가 무너지며 새로운 경제 패러다임이 열립니다!',
      sentiment: 'positive',
      impact: 0.15,
      type: 'market',
      volatility: 2.0
    },
    {
      title: '글로벌 공급망 대란',
      content: '주요 물류 허브 마비로 전 세계 공급망에 비상이 걸렸습니다.',
      sentiment: 'negative',
      impact: -0.18,
      type: 'market',
      volatility: 2.1
    },
    {
      title: '양자컴퓨터 상용화 임박',
      content: '양자 우위 달성! 기존 암호체계와 금융시스템의 대변혁이 예고됩니다.',
      sentiment: 'positive',
      impact: 0.25,
      type: 'market',
      volatility: 2.4
    },
    {
      title: '글로벌 기후 위기 심화',
      content: '이상기후 현상으로 인한 산업계 전반의 비상상황 발생!',
      sentiment: 'negative',
      impact: -0.12,
      type: 'market',
      volatility: 1.8
    }
  ];

  // 기업 뉴스 템플릿 (Company News Templates)
  private readonly companyNewsTemplates: NewsTemplate[] = [
    {
      title: '대규모 회계부정 의혹 제기',
      content: '내부 고발로 드러난 분식회계 의혹… 금융당국의 특별 감리와 함께 주가 급락 우려!',
      sentiment: 'negative',
      impact: -0.45,
      type: 'company',
      volatility: 3.0
    },
    {
      title: '획기적인 신기술 특허 취득',
      content: '글로벌 시장을 선도할 핵심 기술 확보! 향후 5년간 독점권이 보장될 전망입니다.',
      sentiment: 'positive',
      impact: 0.40,
      type: 'company',
      volatility: 2.8
    },
    {
      title: '실적 서프라이즈 달성',
      content: '시장 예상치를 30% 상회하는 영업이익 기록! 주력 사업의 호조가 눈에 띕니다.',
      sentiment: 'positive',
      impact: 0.18,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '대규모 리콜 발표',
      content: '품질 결함으로 인한 전량 리콜 결정… 막대한 비용 부담과 함께 이미지 타격 우려!',
      sentiment: 'negative',
      impact: -0.20,
      type: 'company',
      volatility: 2.1
    },
    {
      title: '대형 공급계약 체결',
      content: '3년간의 납품 계약 성사! 향후 매출 신장이 기대됩니다.',
      sentiment: 'positive',
      impact: 0.14,
      type: 'company',
      volatility: 1.7
    },
    {
      title: '신임 CEO 선임',
      content: '전문경영인 출신의 신임 대표이사 선임… 조직 개편과 경영 혁신이 예고됩니다.',
      sentiment: 'neutral',
      impact: 0.06,
      type: 'company',
      volatility: 1.4
    },
    {
      title: '해외 시장 진출',
      content: '동남아 시장에 첫 진출! 현지 유통망 구축에 박차를 가하고 있습니다.',
      sentiment: 'positive',
      impact: 0.10,
      type: 'company',
      volatility: 1.5
    },
    {
      title: '신제품 출시 일정 지연',
      content: '부품 수급 차질로 인해 신제품 출시가 3개월 연기… 소비자 우려 증폭',
      sentiment: 'negative',
      impact: -0.08,
      type: 'company',
      volatility: 1.3
    },
    {
      title: '우수 인재 영입',
      content: '경쟁사 핵심 개발자 영입 성공! 기술력 강화와 함께 혁신적 변화 기대',
      sentiment: 'positive',
      impact: 0.05,
      type: 'company',
      volatility: 1.2
    },
    {
      title: '친환경 설비 투자',
      content: 'ESG 경영 강화의 일환으로 친환경 설비에 대규모 투자… 탄소 배출 20% 감축 목표!',
      sentiment: 'positive',
      impact: 0.04,
      type: 'company',
      volatility: 1.0
    },
    {
      title: '노사 임금 협상 타결',
      content: '올해 임금 3.5% 인상 합의! 노사 간 무분규 타결로 안정된 경영 환경 조성',
      sentiment: 'neutral',
      impact: 0.03,
      type: 'company',
      volatility: 1.0
    },
    {
      title: '사내 복지 제도 개선',
      content: '직원 만족도 향상을 위한 복리후생 제도 대폭 확대',
      sentiment: 'positive',
      impact: 0.03,
      type: 'company',
      volatility: 1.0
    },
    {
      title: '소규모 기업 인수',
      content: '기술력 보유 스타트업 인수로 시너지 효과 기대, 시장 경쟁력 강화',
      sentiment: 'neutral',
      impact: 0.04,
      type: 'company',
      volatility: 1.2
    },
    {
      title: '정기 임원 인사',
      content: '상반기 임원 인사 단행… 조직 효율화와 혁신 경영 추진',
      sentiment: 'neutral',
      impact: 0.02,
      type: 'company',
      volatility: 0.9
    },
    {
      title: '업무 협약 체결',
      content: '동종 업계 선두 기업과 기술 협력 MOU 체결, 공동 성장 기대',
      sentiment: 'positive',
      impact: 0.03,
      type: 'company',
      volatility: 1.0
    },
    {
      title: '전설의 CEO 복귀',
      content: '퇴임 후 갑작스럽게 복귀한 전설의 CEO가 회사에 새로운 바람을 예고합니다!',
      sentiment: 'positive',
      impact: 0.25,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '신비로운 연구 성과 공개',
      content: '비밀리에 진행된 혁신 연구 결과가 공개되어 미래 기술에 대한 기대감이 폭발합니다!',
      sentiment: 'positive',
      impact: 0.20,
      type: 'company',
      volatility: 2.2
    },
    {
      title: '대규모 사이버 보안 사고',
      content: '회사 시스템 해킹으로 인한 데이터 유출 발생, 신속한 복구 조치 중입니다.',
      sentiment: 'negative',
      impact: -0.22,
      type: 'company',
      volatility: 2.3
    },
    {
      title: '특별 주주총회 소집',
      content: '예상치 못한 안건 상정으로 주주들이 뜨거운 관심을 보입니다.',
      sentiment: 'neutral',
      impact: 0.03,
      type: 'company',
      volatility: 1.1
    },
    {
      title: '인공지능 챗봇 서비스 출시',
      content: '혁신적인 AI 기술을 적용한 고객 서비스로 시장을 선도합니다!',
      sentiment: 'positive',
      impact: 0.15,
      type: 'company',
      volatility: 1.8
    },
    {
      title: '직원 대량 이직 사태',
      content: '핵심 인재들의 잇따른 퇴사로 기업 경쟁력 약화 우려가 제기됩니다.',
      sentiment: 'negative',
      impact: -0.12,
      type: 'company',
      volatility: 1.6
    },
    {
      title: '블록체인 기술 도입',
      content: '전사적 블록체인 시스템 구축으로 업무 혁신을 이뤄냅니다!',
      sentiment: 'positive',
      impact: 0.10,
      type: 'company',
      volatility: 1.5
    },
    {
      title: '환경 규제 위반 적발',
      content: '환경부 특별 단속에서 규정 위반 사실이 드러나 과징금 부과가 예상됩니다.',
      sentiment: 'negative',
      impact: -0.15,
      type: 'company',
      volatility: 1.7
    },
    {
      title: '우주 사업 진출 선언',
      content: '민간 우주산업 참여를 선언하며 미래 성장동력 확보에 나섭니다!',
      sentiment: 'positive',
      impact: 0.30,
      type: 'company',
      volatility: 2.5
    }
  ];

  private constructor() {}

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
    // 이전 스케줄 작업 정리
    await this.cleanupTasks();
    await this.initialize();
    this._isRunning = true;
    console.log('마켓 스케줄러가 시작되었습니다.');
    this.scheduleTasks();
  }

  private scheduleTasks() {
    // 1분마다 주가 업데이트
    const marketUpdateJob = cron.schedule('*/1 * * * *', async () => {
      if (this.isMarketOpen()) {
        await this.updateMarket();
      }
    });
    this.tasks.set('marketUpdate', marketUpdateJob);

    // 1시간마다 마켓 뉴스 생성 (100% 확률)
    const marketNewsJob = cron.schedule('0 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('마켓 뉴스 생성 시작:', new Date().toISOString());
        await this.generateMarketNews();
      }
    });
    this.tasks.set('marketNews', marketNewsJob);

    // 30분마다 기업 뉴스 생성 (100% 확률)
    const companyNewsJob = cron.schedule('*/30 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('기업 뉴스 생성 시작:', new Date().toISOString());
        await this.generateCompanyNews();
      }
    });
    this.tasks.set('companyNews', companyNewsJob);

    // 장 시작 시 시가 결정 (매일 9시 정각)
    const openingJob = cron.schedule('0 9 * * *', async () => {
      console.log('장 시작 - 시가 결정');
      await this.setOpeningPrices();
    });
    this.tasks.set('opening', openingJob);

    // 장 마감 시 종가 저장 (매일 0시 정각)
    const closingJob = cron.schedule('0 0 * * *', async () => {
      console.log('장 마감 - 종가 저장');
      await this.setClosingPrices();
    });
    this.tasks.set('closing', closingJob);

    // 시뮬레이션 봇 관련 스케줄은 더 이상 실행하지 않습니다.
  }

  public async cleanup() {
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
          await Promise.all(companies.slice(i, i + BATCH_SIZE).map((company: any) =>
            this.retryOperation(() =>
              this.supabase
                .from('companies')
                .update({ last_closing_price: company.current_price })
                .eq('id', company.id)
            )
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
        
      const eventsPromise = this.supabase
        .from('market_events')
        .select('*')
        .eq('is_active', true);
        
      const recentNewsPromise = this.supabase
        .from('news')
        .select('*')
        .gte('published_at', getDbTimeXMinutesAgo(5));
        
      const companiesPromise = this.supabase
        .from('companies')
        .select('*');
        
      const [
        holdingsResult,
        activeEventsResult,
        recentNewsResult,
        companiesResult
      ]: [
        PostgrestResponse<any>,
        PostgrestResponse<any>,
        PostgrestResponse<NewsRecord>,
        PostgrestResponse<Company>
      ] = await Promise.all([
        holdingsPromise,
        eventsPromise,
        recentNewsPromise,
        companiesPromise
      ]);
      
      const holdingsData = holdingsResult.data || [];
      const activeEvents = activeEventsResult.data;
      const recentNews = recentNewsResult.data || [];
      const companies = companiesResult.data;
      
      if (companies && companies.length > 0) {
        const updates = await Promise.all(
          companies.map(async (company) => {
            if (company.is_delisted) return;
            
            const newBasePrice = await this.calculateNewPrice(company, activeEvents || []);
            const companyNewsImpact = await this.calculateCompanyNewsImpact(company.id, recentNews);
            const marketNewsImpact = this.calculateMarketNewsImpact(recentNews);
            
            // 일일 제한폭 대신 모멘텀 기반 가격 조정
            const finalPrice = newBasePrice * (
              1 + 
              (companyNewsImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.NEWS) +
              (marketNewsImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.NEWS * 0.5)
            );

            // 가격 변동 추적 및 모멘텀 반전 처리
            const priceChange = (finalPrice - company.current_price) / company.current_price;
            const previousMovement = this.priceMovementCache.get(company.id) || {
              direction: 'neutral',
              consecutiveCount: 0,
              lastChange: 0
            };
            
            this.updatePriceMovement(company.id, priceChange, previousMovement);
            
            // 상장폐지 체크 (0원 이하일 경우만)
            const updatedCompany = await this.checkDelisting(company, finalPrice);
            
            return {
              company_id: company.id,
              old_price: company.current_price,
              new_price: finalPrice,
              change_percentage: priceChange * 100,
              update_reason: this.generateUpdateReason(companyNewsImpact, marketNewsImpact),
              timestamp: new Date()
            };
          })
        );

        // 일괄 업데이트 처리
        await Promise.all(
          updates.filter(Boolean).map(async (update) => {
            await this.retryOperation(() =>
              this.supabase
                .from('price_updates')
                .insert(update!)
            );

            await this.retryOperation(() =>
              this.supabase
                .from('companies')
                .update({
                  previous_price: update!.old_price,
                  current_price: update!.new_price,
                })
                .eq('id', update!.company_id)
            );
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
          users.map((user: any) => portfolioTracker.recordPerformance(user.id))
        );
      }
      await this.updateStatus({
        status: 'running',
        lastRun: new Date(),
        nextRun: this.calculateNextRun('market_update'),
        jobType: 'market_update'
      });

      // 가격 업데이트 후 캐시 무효화
      await Promise.all(
        (companies || []).map(async (company: Company) => {
          const key = `stock:${company.ticker}`;
          await redis.del(key);
        })
      );
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

  private generateUpdateReason(
    companyNewsImpact: number,
    marketNewsImpact: number
  ): string {
    const reasons: string[] = [];
    
    if (Math.abs(companyNewsImpact) > 0.01) {
      reasons.push(`기업 뉴스 영향 (${(companyNewsImpact * 100).toFixed(2)}%)`);
    }
    if (Math.abs(marketNewsImpact) > 0.01) {
      reasons.push(`시장 뉴스 영향 (${(marketNewsImpact * 100).toFixed(2)}%)`);
    }
    
    return reasons.length > 0 ? reasons.join(', ') : '일반 시장 변동';
  }

  private calculateMomentumFactor(movement: {
    direction: 'up' | 'down' | 'neutral',
    consecutiveCount: number,
    lastChange: number
  }): number {
    if (movement.consecutiveCount <= 1) return 1.0;
    
    // 연속성이 증가할수록 모멘텀 강도 증가
    const momentumStrength = Math.min(
      movement.consecutiveCount * Math.abs(movement.lastChange) * 0.3, // 30%로 감소
      0.05  // 최대 5%로 제한
    );
    
    // 연속성이 증가할수록 반전 확률 급격히 증가
    const baseReversalChance = SIMULATION_PARAMS.PRICE.REVERSAL.BASE_CHANCE;
    const reversalChance = Math.min(
      baseReversalChance + 
      Math.pow(movement.consecutiveCount, 1.5) * SIMULATION_PARAMS.PRICE.REVERSAL.MOMENTUM_MULTIPLIER,
      SIMULATION_PARAMS.PRICE.REVERSAL.MAX_CHANCE
    );
    
    // 연속 횟수가 많을수록 반전 확률 증가
    if (movement.consecutiveCount >= 5) {
      return movement.direction === 'up' ? 
        1 - (momentumStrength * 1.2) : // 상승 시 더 강한 하락 반전
        1 + (momentumStrength * 1.5);  // 하락 시 더 강한 상승 반전
    }
    
    if (Math.random() < reversalChance) {
      return movement.direction === 'up' ? 
        1 - momentumStrength : 
        1 + momentumStrength;
    }
    
    return movement.direction === 'up' ? 
      1 + (momentumStrength * 0.8) : // 상승 모멘텀 약화
      1 - (momentumStrength * 0.7);  // 하락 모멘텀 약화
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
    
    // 연속성 카운트 업데이트
    let consecutiveCount = 
      newDirection === previousMovement.direction ? 
      previousMovement.consecutiveCount + 1 : 1;
      
    // 연속 상승/하락이 길어질수록 반전 확률 증가
    const reversalThreshold = Math.min(0.3 + (consecutiveCount * 0.1), 0.9);
    if (consecutiveCount > 3 && Math.random() < reversalThreshold) {
      consecutiveCount = 1;
      // 반전 시 변동폭 감소
      change *= 0.5;
    }

    this.priceMovementCache.set(key, {
      direction: newDirection,
      consecutiveCount,
      lastChange: change
    });
  }

  private async generateMarketNews() {
    try {
      const industriesForMarketNews: Industry[] = ['전자','IT','제조','건설','식품'];
      const selectedIndustry = industriesForMarketNews[Math.floor(Math.random() * industriesForMarketNews.length)];

      const marketNews = this.selectRandomNews(this.marketNewsTemplates);
      
      // 마켓 뉴스는 특정 기업이 아닌 산업군 전체에 영향을 미치도록 수정
      await this.createNews({
        ...marketNews,
        title: `[${selectedIndustry}] ${marketNews.title}`,
        content: `${marketNews.content} - ${selectedIndustry} 산업 전반에 미치는 영향`,
        company_id: undefined,  // null 대신 undefined 사용
        industry: selectedIndustry,
        type: 'market'
      });

      // 해당 산업군의 모든 기업에 영향을 주기 위해 관련 기업들의 가격을 업데이트
      const { data: affectedCompanies } = await this.supabase
        .from('companies')
        .select('*')
        .eq('industry', selectedIndustry);

      if (affectedCompanies) {
        // 해당 산업군의 모든 기업 가격 업데이트
        await Promise.all(
          affectedCompanies.map(async (company: Company) => {
            const priceImpact = marketNews.impact * 
              SIMULATION_PARAMS.INDUSTRY.VOLATILITY[company.industry as Industry] * 
              this.calculateMarketCapVolatility(company.market_cap);
            
            const newPrice = company.current_price * (1 + priceImpact);
            
            // 가격 업데이트 기록
            await this.retryOperation(() =>
              this.supabase
                .from('price_updates')
                .insert({
                  company_id: company.id,
                  old_price: company.current_price,
                  new_price: newPrice,
                  change_percentage: priceImpact * 100,
                  update_reason: `${selectedIndustry} 산업 뉴스 영향: ${marketNews.title}`
                })
            );

            // 기업 가격 업데이트
            await this.retryOperation(() =>
              this.supabase
                .from('companies')
                .update({
                  previous_price: company.current_price,
                  current_price: newPrice
                })
                .eq('id', company.id)
            );

            // 캐시 무효화
            const key = `stock:${company.ticker}`;
            await redis.del(key);
          })
        );
      }

      console.log(`[${selectedIndustry} 산업 뉴스 발생]`, marketNews.title);
    } catch (error) {
      console.error('마켓 뉴스 생성 중 오류:', error);
      throw new Error('마켓 뉴스 생성 실패');
    }
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

  private async createNews(news: NewsTemplate) {
    try {
      const supabase = await this.ensureConnection();
      const seoulTime = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Seoul' })
      ).toISOString();

      const { error } = await this.retryOperation<PostgrestResponse<any>>(() =>
        supabase.from('news').insert({
          title: news.title,
          content: news.content,
          company_id: news.company_id || null,
          published_at: seoulTime,  // 서울 시간대로 변경
          type: news.type,
          sentiment: news.sentiment,
          impact: news.impact,
          volatility: news.volatility,
          industry: news.industry || null
        })
      );
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
    const companyResponse = await this.supabase
      .from('companies')
      .select('market_cap')
      .eq('id', companyId)
      .single();
    
    const company = companyResponse.data;
    const marketCapMultiplier = this.calculateMarketCapNewsMultiplier(company.market_cap);
    
    const companyNews = recentNews.filter((news: NewsRecord) => 
      news.type === 'company' && 
      news.company_id === companyId
    );

    let totalImpact = companyNews.reduce((sum: number, news: NewsRecord) => {
      const timeElapsed = (Date.now() - new Date(news.published_at).getTime()) / (1000 * 60);
      // 뉴스 영향 시간을 30분에서 10분으로 단축
      const decayFactor = Math.max(0, 1 - (timeElapsed / 10));
      
      // 뉴스 방향의 불확실성 추가 (70% 확률로 뉴스 방향대로, 30% 확률로 반대 방향)
      const directionMultiplier = Math.random() < 0.7 ? 1 : -0.5;
      
      const impactVariation = 
        SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN + 
        Math.random() * (
          SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MAX - 
          SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN
        );
      
      const baseImpact = news.impact * impactVariation * directionMultiplier;
      
      // 연속된 뉴스의 경우 한계 효용 더 강하게 감소 (70%)
      const diminishingFactor = Math.pow(0.7, companyNews.length - 1);
      
      const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
      const volatilityMultiplier = news.volatility >= 1.8 ? 1.2 : 1.0;
      
      // 각 뉴스의 개별 영향력 상한 적용 (±2%)
      const newsImpact = Math.max(
        Math.min(
          baseImpact * sentimentMultiplier * volatilityMultiplier * decayFactor * marketCapMultiplier * diminishingFactor,
          0.02
        ),
        -0.02
      );
      
      return sum + newsImpact;
    }, 0);

    // 누적 뉴스 영향 상한/하한 적용 (±5%)
    totalImpact = Math.max(Math.min(totalImpact, 0.05), -0.05);
    
    return totalImpact;
  }

  private calculateMarketCapNewsMultiplier(marketCap: number): number {
    // 시가총액이 클수록 뉴스 영향력 증가
    if (marketCap > 100000000000) return 1.4;  // 1000억 이상
    if (marketCap > 10000000000) return 1.2;   // 100억 이상
    if (marketCap > 1000000000) return 1.1;    // 10억 이상
    return 1.0;
  }

  private calculateMarketNewsImpact(recentNews: NewsRecord[]): number {
    const marketNews = recentNews.filter((news: NewsRecord) => news.type === 'market');
    
    let totalImpact = marketNews.reduce((sum: number, news: NewsRecord) => {
      const timeElapsed = (Date.now() - new Date(news.published_at).getTime()) / (1000 * 60);
      const decayFactor = Math.max(0, 1 - (timeElapsed / 10));  // 10분으로 단축

      // 뉴스 방향의 불확실성 추가
      const directionMultiplier = Math.random() < 0.7 ? 1 : -0.5;
      
      const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
      const volatilityMultiplier = news.volatility >= 1.8 ? 1.2 : 1.0;
      
      // 각 뉴스의 개별 영향력 상한 적용 (±2%)
      const newsImpact = Math.max(
        Math.min(
          news.impact * news.volatility * sentimentMultiplier * volatilityMultiplier * decayFactor * directionMultiplier,
          0.02
        ),
        -0.02
      );
      
      return sum + newsImpact;
    }, 0);

    // 누적 시장 뉴스 영향 상한/하한 적용 (±5%)
    totalImpact = Math.max(Math.min(totalImpact, 0.05), -0.05);
    
    return totalImpact;
  }

  private async calculateNewPrice(company: Company, events: any[]): Promise<number> {
    const basePrice = company.current_price;
    
    // 산업 리더 영향도 계산 추가
    const industryLeaderImpact = await this.calculateIndustryLeaderImpact(company.industry, company.id);
    
    const randomChange = (Math.random() - 0.5) * SIMULATION_PARAMS.PRICE.BASE_RANDOM_CHANGE;
    
    const industryVolatility = this.calculateIndustryVolatility(company.industry);
    const timeVolatility = this.calculateTimeVolatility(new Date().getHours());
    const marketCapVolatility = this.calculateMarketCapVolatility(company.market_cap);
    
    const baseChange = (
      randomChange * SIMULATION_PARAMS.PRICE.WEIGHTS.RANDOM +
      industryLeaderImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.INDUSTRY
    ) * industryVolatility * timeVolatility * marketCapVolatility;

    return basePrice * (1 + baseChange);
  }

  private calculateIndustryVolatility(industry: Industry): number {
    return SIMULATION_PARAMS.INDUSTRY.VOLATILITY[industry] || 1.0;
  }

  private calculateEventImpact(events: any[], industry: string): number {
    if (!events?.length) return 0;
    return events.reduce((impact, event) => {
      const industryWeight = event.affected_industries?.includes(industry) ? 1.5 : 1;
      return impact + (event.impact * industryWeight);
    }, 0);
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
        companies.map(async (company: any) => {
          const priceChange = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
          const openingPrice = company.last_closing_price * (1 + priceChange);
          
          // price_updates 테이블에 기록
          await this.retryOperation(() =>
            this.supabase
              .from('price_updates')
              .insert({
                company_id: company.id,
                old_price: company.current_price,
                new_price: openingPrice,
                change_percentage: ((openingPrice - company.current_price) / company.current_price) * 100,
                update_reason: '장 시작'
              })
          );

          // companies 테이블 업데이트
          return this.retryOperation(() =>
            this.supabase
              .from('companies')
              .update({
                previous_price: company.current_price,
                current_price: openingPrice,
              })
              .eq('id', company.id)
          );
        })
      );
    }
  }

  private async setClosingPrices() {
    const { data: companies } = await this.supabase.from('companies').select('*');
    if (companies && companies.length > 0) {
      await Promise.all(
        companies.map(async (company: any) => {
          // price_updates 테이블에 기록
          await this.retryOperation(() =>
            this.supabase
              .from('price_updates')
              .insert({
                company_id: company.id,
                old_price: company.current_price,
                new_price: company.current_price,
                change_percentage: 0,
                update_reason: '장 마감'
              })
          );

          // companies 테이블 업데이트
          return this.retryOperation(() =>
            this.supabase
              .from('companies')
              .update({ last_closing_price: company.current_price })
              .eq('id', company.id)
          );
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
        return new Date(now.getTime() + 60 * 60000); // 1시간 후
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
      '전자': this.marketNewsTemplates,
      'IT': this.marketNewsTemplates,
      '제조': this.companyNewsTemplates,
      '건설': this.companyNewsTemplates,
      '식품': this.companyNewsTemplates
    }[industry] || this.companyNewsTemplates;
    this.newsTemplateCache.set(industry, templates);
    return templates;
  }

  // 재시도 로직: 비동기 작업을 지정 횟수만큼 재시도합니다.
  private async retryOperation<T>(operation: () => Promise<T>, retries: number = 3, delay: number = 1000): Promise<T> {
    let lastError;
    for (let i = 0; i < retries; i++) {
      try {
        return await operation();
      } catch (e) {
        lastError = e;
        await new Promise((resolve) => setTimeout(resolve, delay));
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
    
    return leaders.reduce((sum: number, leader: Company) => {
      const priceChange = (leader.current_price - leader.previous_price) / leader.previous_price;
      return sum + priceChange;
    }, 0) / leaders.length * 0.5; // 영향력 50% 감소
  }
}