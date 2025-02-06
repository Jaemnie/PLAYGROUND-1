import { createClient } from '@/lib/supabase/server'
import cron from 'node-cron'
import { PortfolioTracker } from '@/services/portfolio-tracker'

interface NewsTemplate {
  title: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
  type: 'market' | 'company';
  volatility?: number; // 변동성 계수 (뉴스가 얼마나 큰 파장을 일으킬 수 있는지)
  company_id?: string;
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

type Industry =
  | 'IT' 
  | 'IT 서비스'
  | '소프트웨어'
  | '전자'
  | '반도체'
  | '바이오'
  | '제약'
  | '금융'
  | '건설'
  | '식품'
  | '소비재'
  | '자동차'
  | '운송'
  | '에너지'
  | '디자인'
  | '제조'
  | string;

interface Company {
  id: string;
  name: string;
  ticker: string;
  industry: Industry;
  current_price: number;
  previous_price: number;
  last_closing_price: number;
}

export class MarketScheduler {
  private static instance: MarketScheduler | null = null;
  private isInitialized: boolean = false;
  private supabase: any
  private _isRunning = false
  private marketUpdateJob: cron.ScheduledTask | null = null
  private newsEventJob: cron.ScheduledTask | null = null
  private readonly MARKET_OPEN_HOUR = 9;    // 장 시작 시간
  private readonly MARKET_CLOSE_HOUR = 24;  // 장 마감 시간 (자정)
  private lastMarketUpdate: Date | null = null;
  private lastNewsUpdate: Date | null = null;
  private newsTemplateCache: Map<string, NewsTemplate[]> = new Map();
  
  // 시장 뉴스 템플릿 (Market News Templates)
private readonly marketNewsTemplates: NewsTemplate[] = [
  // 대형 이벤트 (큰 영향)
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
  // 중간 규모 이벤트
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
  // 소규모 이벤트
  {
    title: '국제유가 소폭 상승',
    content: '원자재 가격이 소폭 상승하면서 에너지 관련 기업에 미미한 영향 발생',
    sentiment: 'neutral',
    impact: -0.03,
    type: 'market',
    volatility: 1.2
  },
  // 추가 재미있는 이벤트
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
  // 대형 뉴스 (약 5% 확률)
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
  // 중형 뉴스 (약 15% 확률)
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
  // 소형 뉴스 (약 80% 확률)
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
  // 추가 재미있는 기업 뉴스
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
    
    // 9시 ~ 24시 사이만 장 운영
    return currentHour >= this.MARKET_OPEN_HOUR && currentHour < this.MARKET_CLOSE_HOUR;
  }

  async start() {
    if (this._isRunning) {
      console.log('마켓 스케줄러가 이미 실행 중입니다.')
      return
    }
    
    // 기존 인스턴스의 모든 작업을 정리
    if (MarketScheduler.instance) {
      await MarketScheduler.instance.cleanup()
    }
    
    await this.initialize()
    this._isRunning = true

    console.log('마켓 스케줄러가 시작되었습니다.')

    // 기존 작업이 있다면 먼저 중지
    if (this.marketUpdateJob) {
      this.marketUpdateJob.stop()
    }
    if (this.newsEventJob) {
      this.newsEventJob.stop()
    }

    // 장 시작/마감 작업
    const openingJob = cron.schedule('0 9 * * *', async () => {
      console.log('장 시작 - 시가 결정')
      await this.setOpeningPrices();
    });

    const closingJob = cron.schedule('0 0 * * *', async () => {
      console.log('장 마감 - 종가 저장')
      await this.setClosingPrices();
    });
    // 1분마다 주가 변동 (단일 작업으로 변경)
    const priceUpdateJob = cron.schedule('*/1 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('시장 업데이트 시작:', new Date().toISOString())
        await this.updateMarket();
      }
    });

    // 1시간마다 마켓 뉴스 생성
    const marketNewsJob = cron.schedule('0 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('마켓 뉴스 생성 시작:', new Date().toISOString())
        await this.generateMarketNews();
      }
    });

    // 30분마다 기업 뉴스 생성
    const companyNewsJob = cron.schedule('*/30 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('기업 뉴스 생성 시작:', new Date().toISOString())
        await this.generateCompanyNews();
      }
    });

    // 모든 작업을 하나로 묶기
    const allJobs = [openingJob, closingJob, priceUpdateJob, marketNewsJob, companyNewsJob];
    this.marketUpdateJob = {
      stop: () => {
        console.log('모든 마켓 작업 중지')
        allJobs.forEach(job => job.stop());
      }
    } as cron.ScheduledTask;
  }

  public async cleanup() {
    console.log('마켓 스케줄러 정리 시작')
    if (this.marketUpdateJob) {
      this.marketUpdateJob.stop()
      this.marketUpdateJob = null
    }
    if (this.newsEventJob) {
      this.newsEventJob.stop()
      this.newsEventJob = null
    }
    this._isRunning = false
    MarketScheduler.instance = null
    console.log('마켓 스케줄러 정리 완료')
  }

  private async initialize() {
    console.log('마켓 스케줄러 초기화')
    this.supabase = await createClient()
    
    try {
      const { data: companies, error } = await this.supabase
        .from('companies')
        .select('*')
      
      if (error) throw error;

      for (const company of companies || []) {
        await this.supabase
          .from('companies')
          .update({ 
            last_closing_price: company.current_price 
          })
          .eq('id', company.id)
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

      // 1. 호가 데이터 분석
      const { data: orders } = await this.supabase
        .from('orders')
        .select('*')
        .gte('created_at', new Date(Date.now() - 5 * 60000).toISOString())

      // 2. 시장 이벤트 영향 계산
      const { data: activeEvents } = await this.supabase
        .from('market_events')
        .select('*')
        .eq('is_active', true)

      // 3. 뉴스 영향 계산
      const { data: recentNews } = await this.supabase
        .from('news')
        .select('*')
        .gte('published_at', new Date(Date.now() - 5 * 60000).toISOString());

      // 4. 각 기업별 가격 업데이트
      const { data: companies } = await this.supabase
        .from('companies')
        .select('*')

      for (const company of companies || []) {
        const newPrice = await this.calculateNewPrice(company, orders, activeEvents)
        const newsImpact = this.calculateNewsImpact(company.id, recentNews)
        const finalPrice = newPrice * (1 + newsImpact)
        
        await this.supabase
          .from('companies')
          .update({ 
            previous_price: company.current_price,
            current_price: finalPrice 
          })
          .eq('id', company.id)
      }
      console.log('시장 업데이트 완료')

      // 모든 사용자의 포트폴리오 성과 기록
      const { data: users } = await this.supabase
        .from('profiles')
        .select('id')
      
      const portfolioTracker = new PortfolioTracker()
      
      for (const user of users || []) {
        await portfolioTracker.recordPerformance(user.id)
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
    if (Math.random() < 0.05) { // 5% 확률로 마켓 뉴스 생성
      const marketNews = this.selectRandomNews(this.marketNewsTemplates);
      await this.createNews({
        ...marketNews,
        title: `[시장 전체] ${marketNews.title}`,
        content: `${marketNews.content} - 전체 시장에 영향`
      });
      console.log('시장 전체 뉴스 발생:', marketNews.title);
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
    
    // 변동성 요소 추가 (±20% 랜덤 변동)
    const volatilityFactor = 1 + (Math.random() * 0.4 - 0.2);
    return {
      ...template,
      impact: template.impact * volatilityFactor
    };
  }

  private async createNews(news: NewsTemplate) {
    try {
      const supabase = await this.ensureConnection();
      const { error } = await supabase.from('news').insert({
        title: news.title,
        content: news.content,
        company_id: news.company_id || null,
        sentiment: news.sentiment,
        impact: news.impact,
        published_at: new Date().toISOString(),
        type: news.type,
        volatility: news.volatility
      });

      if (error) throw error;
    } catch (error) {
      console.error('뉴스 생성 중 오류 발생:', error);
      throw new Error('뉴스 생성 실패');
    }
  }

  private calculateSentimentMultiplier(sentiment: string): number {
    switch (sentiment) {
      case 'positive': return 1.2;  // 긍정적 뉴스는 더 큰 영향
      case 'negative': return 1.5;  // 부정적 뉴스는 더욱 큰 영향
      default: return 1.0;          // 중립적 뉴스는 기본 영향
    }
  }

  private calculateNewsImpact(companyId: string, recentNews: any[]): number {
    const companyNews = recentNews.filter((news: NewsRecord) => news.company_id === companyId);
    const newsImpact = companyNews.reduce((sum: number, news: NewsRecord) => {
      const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
      return sum + (news.impact * news.volatility * sentimentMultiplier);
    }, 0);
    return newsImpact;
  }

  private async calculateNewPrice(
    company: Company,
    _orders: any[], // 사용하지 않음
    events: any[]
  ): Promise<number> {
    try {
      const basePrice = company.current_price;
      
      // 1. 시장 전체 트렌드 계산
      const { data: allCompanies } = await this.supabase
        .from('companies')
        .select('*');
      
      const marketTrend = this.calculateMarketTrend(allCompanies);
      
      // 2. 업종 트렌드 계산
      const industryCompanies = allCompanies.filter((c: Company) => c.industry === company.industry);
      const industryTrend = this.calculateMarketTrend(industryCompanies);

      // 3. 개별 종목 변동성
      const stockVolatility = this.calculateStockVolatility(company);
      
      // 4. 이벤트 영향력 계산
      const eventImpact = this.calculateEventImpact(events, company.industry);
      
      // 5. 시간대별 변동성
      const timeVolatility = this.calculateTimeVolatility(new Date().getHours());
      
      // 6. 최종 가격 변동률 계산
      const totalChange = (
        marketTrend * 0.45 +          // 시장 전체 영향 (45%)
        industryTrend * 0.35 +        // 업종 영향 (35%)
        stockVolatility * 0.15 +      // 개별 변동성 (15%)
        eventImpact * 0.05            // 이벤트 영향 (5%)
      ) * timeVolatility;             // 시간대별 변동성 적용

      // 7. 일일 가격 제한 (상/하한가 15%)
      const maxDailyChange = 0.15;
      const maxPrice = company.last_closing_price * (1 + maxDailyChange);
      const minPrice = company.last_closing_price * (1 - maxDailyChange);
      const newPrice = basePrice * (1 + totalChange);
      
      return Math.min(Math.max(newPrice, minPrice), maxPrice);
    } catch (error) {
      console.error('가격 계산 중 오류:', error);
      return company.current_price;
    }
  }

  // 시장/업종 트렌드 계산
  private calculateMarketTrend(companies: Company[]): number {
    if (!companies.length) return 0;
    
    // 브라운 운동 기반의 자연스러운 변동성 생성
    const baseChange = (Math.random() - 0.5) * 0.006; // 기본 변동폭 ±0.3%
    const momentum = Math.random() > 0.7 ? 1 : -1;    // 30% 확률로 추세 전환
    
    return baseChange * momentum;
  }

  // 개별 종목 변동성 계산
  private calculateStockVolatility(company: Company): number {
    // 산업별 기본 변동성 가중치
    const industryVolatility = {
      'IT': 1.4,
      'IT 서비스': 1.3,
      '소프트웨어': 1.3,
      '전자': 1.2,
      '반도체': 1.5,
      '바이오': 1.6,
      '제약': 1.2,
      '금융': 0.9,
      '건설': 0.8,
      '식품': 0.7,
      '소비재': 0.8,
      '자동차': 1.1,
      '운송': 0.9,
      '에너지': 1.0,
      '디자인': 1.1,
      '제조': 0.9
    }[company.industry] || 1.0;

    // 기본 변동성에 산업 가중치 적용
    return (Math.random() - 0.5) * 0.004 * industryVolatility;
  }

  // 이벤트 영향력 계산
  private calculateEventImpact(events: any[], industry: string): number {
    if (!events?.length) return 0;
    
    return events.reduce((impact, event) => {
      const industryWeight = event.affected_industries?.includes(industry) ? 1.5 : 1;
      return impact + (event.impact * industryWeight);
    }, 0);
  }

  // 시간대별 변동성 계산 (기존 함수 수정)
  private calculateTimeVolatility(hour: number): number {
    // 장 시작 직후 (9시-10시): 높은 변동성
    if (hour === 9) return 1.8;
    
    // 점심시간 (11시-13시): 낮은 변동성
    if (hour >= 11 && hour <= 13) return 0.7;
    
    // 장 마감 전 (14시-15시): 중간~높은 변동성
    if (hour >= 14) return 1.4;
    
    // 그 외 시간대: 보통 변동성
    return 1.0;
  }

  // 장 시작 시 시가 결정
  private async setOpeningPrices() {
    const { data: companies } = await this.supabase
      .from('companies')
      .select('*');

    for (const company of companies || []) {
      // 전일 종가 기준으로 ±5% 범위 내에서 시가 결정
      const priceChange = (Math.random() - 0.5) * 0.1; // -5% ~ +5%
      const openingPrice = company.last_closing_price * (1 + priceChange);

      await this.supabase
        .from('companies')
        .update({ 
          previous_price: company.current_price,
          current_price: openingPrice,
        })
        .eq('id', company.id);
    }
  }

  // 장 마감 시 종가 저장
  private async setClosingPrices() {
    const { data: companies } = await this.supabase
      .from('companies')
      .select('*');

    for (const company of companies || []) {
      await this.supabase
        .from('companies')
        .update({ 
          last_closing_price: company.current_price
        })
        .eq('id', company.id);
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

    const templates = {
      'IT': this.marketNewsTemplates,
      'IT 서비스': this.marketNewsTemplates,
      '소프트웨어': this.marketNewsTemplates,
      '전자': this.marketNewsTemplates,
      '반도체': this.marketNewsTemplates,
      '바이오': this.companyNewsTemplates,
      '제약': this.companyNewsTemplates,
      '금융': this.companyNewsTemplates,
      '건설': this.companyNewsTemplates,
      '식품': this.companyNewsTemplates,
      '소비재': this.companyNewsTemplates,
      '자동차': this.companyNewsTemplates,
      '운송': this.companyNewsTemplates,
      '에너지': this.companyNewsTemplates,
    }[industry] || this.companyNewsTemplates;

    this.newsTemplateCache.set(industry, templates);
    return templates;
  }
} 