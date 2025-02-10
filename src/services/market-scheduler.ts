import { createClient } from '@/lib/supabase/server'
import cron from 'node-cron'
import { PortfolioTracker } from '@/services/portfolio-tracker'
import type { PostgrestResponse } from '@supabase/supabase-js'
import { getDbTimeXMinutesAgo } from '@/lib/timeUtils'

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
}

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

    // 1분마다 주가 업데이트
    const priceUpdateJob = cron.schedule('*/1 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('시장 업데이트 시작:', new Date().toISOString());
        await this.updateMarket();
      }
    });
    this.tasks.set('priceUpdate', priceUpdateJob);

    // 1시간마다 마켓 뉴스 생성
    const marketNewsJob = cron.schedule('0 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('마켓 뉴스 생성 시작:', new Date().toISOString());
        await this.generateMarketNews();
      }
    });
    this.tasks.set('marketNews', marketNewsJob);

    // 30분마다 기업 뉴스 생성
    const companyNewsJob = cron.schedule('*/30 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('기업 뉴스 생성 시작:', new Date().toISOString());
        await this.generateCompanyNews();
      }
    });
    this.tasks.set('companyNews', companyNewsJob);

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
      ] = await Promise.all([
        holdingsPromise,
        eventsPromise,
        recentNewsPromise,
        companiesPromise
      ]);
      
      const holdingsData = holdingsResult.data || [];
      const activeEvents = activeEventsResult.data;
      const recentNews = recentNewsResult.data;
      const companies = companiesResult.data;
      
      // 먼저 시장 뉴스 영향(글로벌 뉴스)을 계산
      const marketNewsImpact = this.calculateMarketNewsImpact(recentNews);
      
      if (companies && companies.length > 0) {
        await Promise.all(
          companies.map(async (company: Company) => {
            if (company.is_delisted) {
              console.log(`${company.name}은(는) 이미 상장폐지 상태입니다.`);
              return;
            }
            
            const companyHoldings = holdingsData.filter(
              (holding: any) => holding.company_id === company.id
            );
            const totalHoldingShares = companyHoldings.reduce(
              (sum: number, h: any) => sum + h.shares,
              0
            );
            
            // 캐시 키는 회사 고유의 ID만을 사용 (보유 주식 수는 제거)
            const cacheKey = `${company.id}`;
            let newPrice: number;

            if (this.priceCache.has(cacheKey)) {
              newPrice = this.priceCache.get(cacheKey)!;
            } else {
              // 새로운 주가 계산 (호가창 데이터 및 이벤트 반영)
              newPrice = await this.calculateNewPrice(company, activeEvents);
              // 캐시 저장 후 5초 후 자동 삭제 (TTL 적용)
              this.priceCache.set(cacheKey, newPrice);
              setTimeout(() => {
                this.priceCache.delete(cacheKey);
              }, 5000);
            }
            
            // 회사 뉴스 영향은 해당 기업에만 직접 반영
            const companyNewsImpact = this.calculateCompanyNewsImpact(company.id, recentNews);
            
            // 주가 변화율 계산: (새로 계산된 가격 / 전일 종가) - 1
            const relativeChange = newPrice / company.last_closing_price - 1;
            
            // 최종 주가 계산 (recovery factor 제거)
            const finalPrice = company.last_closing_price * (1 + relativeChange + companyNewsImpact);
            
            await this.retryOperation(() =>
              this.supabase
                .from('companies')
                .update({
                  previous_price: company.current_price,
                  current_price: finalPrice
                })
                .eq('id', company.id)
            );
            await this.checkDelisting(company, finalPrice);
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

  private async generateMarketNews() {
    if (Math.random() < 0.05) {
      // 산업 목록에서 임의로 선택 (필요에 따라 확장 가능)
      const industriesForMarketNews: Industry[] = ['전자','IT','제조','건설','식품'];
      const selectedIndustry = industriesForMarketNews[Math.floor(Math.random() * industriesForMarketNews.length)];

      const marketNews = this.selectRandomNews(this.marketNewsTemplates);
      await this.createNews({
        ...marketNews,
        industry: selectedIndustry,  // 새로운 칼럼 값 추가
        title: `[${selectedIndustry} 시장] ${marketNews.title}`,
        content: `${marketNews.content} - ${selectedIndustry} 산업 전반에 미치는 영향`
      });
      console.log(`[${selectedIndustry} 시장 뉴스 발생]`, marketNews.title);
    }
  }

  private async generateCompanyNews() {
    try {
      const supabase = await this.ensureConnection();
      const { data: companies, error } = await supabase
        .from('companies')
        .select('*');
      if (error) throw error;

      if (Math.random() < 0.6 && companies && companies.length > 0) {
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
      const { error } = await this.retryOperation<PostgrestResponse<any>>(() =>
        supabase.from('news').insert({
          title: news.title,
          content: news.content,
          company_id: news.company_id || null,
          published_at: new Date().toISOString(),
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
      case 'negative': return 1.5;
      default: return 1.0;
    }
  }

  private calculateCompanyNewsImpact(companyId: string, recentNews: NewsRecord[]): number {
    const companyNews = recentNews.filter((news: NewsRecord) => news.type === 'company' && news.company_id === companyId);
    return companyNews.reduce((sum: number, news: NewsRecord) => {
      const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
      const volatilityMultiplier = news.volatility && news.volatility >= 1.8 ? 1.5 : 1.0;
      return sum + (news.impact * news.volatility * sentimentMultiplier * volatilityMultiplier);
    }, 0);
  }

  private calculateMarketNewsImpact(recentNews: NewsRecord[]): number {
    const marketNews = recentNews.filter((news: NewsRecord) => news.type === 'market');
    return marketNews.reduce((sum: number, news: NewsRecord) => {
      const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
      const volatilityMultiplier = news.volatility && news.volatility >= 1.8 ? 1.5 : 1.0;
      return sum + (news.impact * news.volatility * sentimentMultiplier * volatilityMultiplier);
    }, 0);
  }

  private async calculateNewPrice(
    company: Company,
    events: any[]
  ): Promise<number> {
    try {
      const basePrice = company.current_price;
      
      // 1. 이전 가격 움직임 데이터 가져오기
      const movementKey = company.id;
      const previousMovement = this.priceMovementCache.get(movementKey) || {
        direction: 'neutral',
        consecutiveCount: 0,
        lastChange: 0
      };

      // 2. 기본 변동 요소 계산
      const eventImpact = this.calculateEventImpact(events, company.industry);
      const industryVolatility = this.calculateIndustryVolatility(company.industry);
      const timeVolatility = this.calculateTimeVolatility(new Date().getHours());
      
      // 3. 모멘텀 계수 계산 (연속성 부여)
      const momentumFactor = this.calculateMomentumFactor(previousMovement);
      
      // 4. 랜덤 변동성 (-0.5% ~ +0.5%)에 모멘텀 반영
      const baseRandomChange = (Math.random() - 0.5) * 0.01;
      const randomChange = baseRandomChange * momentumFactor;
      
      // 5. 최종 변화율 계산
      const totalChange = (
        eventImpact * 0.3 +      // 이벤트 영향 30%
        randomChange * 0.7       // 랜덤 변동성 70% (모멘텀 반영)
      ) * timeVolatility * industryVolatility;

      // 6. 새로운 가격 계산
      const newPrice = basePrice * (1 + totalChange);
      
      // 7. 가격 움직임 정보 업데이트
      this.updatePriceMovement(movementKey, totalChange, previousMovement);

      // 8. 가격 제한 (전일 종가 대비 ±30% 제한)
      const maxPrice = company.last_closing_price * 1.3;
      const minPrice = company.last_closing_price * 0.7;

      return Math.min(Math.max(newPrice, minPrice), maxPrice);
    } catch (error) {
      console.error('가격 계산 중 오류:', error);
      return company.current_price;
    }
  }

  private calculateIndustryVolatility(industry: Industry): number {
    const volatilityMap: Record<Industry, number> = {
      '전자': 1.3,
      'IT': 1.4,
      '제조': 0.9,
      '건설': 0.8,
      '식품': 0.7,
    };
    return volatilityMap[industry] || 1.0;
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

  private calculateMomentumFactor(movement: {
    direction: 'up' | 'down' | 'neutral',
    consecutiveCount: number,
    lastChange: number
  }): number {
    // 연속 상승/하락에 따른 모멘텀 계수 계산
    const baseMomentum = 1.0;
    const momentumMultiplier = 1.2; // 모멘텀 강도
    
    if (movement.consecutiveCount <= 1) return baseMomentum;
    
    // 연속 횟수가 증가할수록 모멘텀도 강화 (최대 3회)
    const momentum = Math.min(
      baseMomentum * Math.pow(momentumMultiplier, Math.min(movement.consecutiveCount, 3) - 1),
      2.0 // 최대 모멘텀 제한
    );
    
    return momentum;
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
      
    // 연속 상승/하락이 5회를 넘어가면 반전 확률 증가
    if (consecutiveCount > 5 && Math.random() < 0.4) {
      consecutiveCount = 1;
    }

    this.priceMovementCache.set(key, {
      direction: newDirection,
      consecutiveCount,
      lastChange: change
    });
  }

  private async setOpeningPrices() {
    const { data: companies } = await this.supabase.from('companies').select('*');
    if (companies && companies.length > 0) {
      await Promise.all(
        companies.map((company: any) => {
          const priceChange = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
          const openingPrice = company.last_closing_price * (1 + priceChange);
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
        companies.map((company: any) =>
          this.retryOperation(() =>
            this.supabase
              .from('companies')
              .update({ last_closing_price: company.current_price })
              .eq('id', company.id)
          )
        )
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
}