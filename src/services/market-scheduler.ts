import { createClient } from '@/lib/supabase/server'
import cron from 'node-cron'
import { PortfolioTracker } from '@/services/portfolio-tracker'

interface StockData {
  ticker: string;
  price: number;
  timestamp: string;
}

interface OrderData {
  id: string;
  ticker: string;
  price: number;
  quantity: number;
  type: 'buy' | 'sell';
}

interface TradeData {
  buyOrderId: string;
  sellOrderId: string;
  price: number;
  quantity: number;
  timestamp: string;
}

type MarketEventType = 
  | 'economic_crisis' 
  | 'market_boom' 
  | 'interest_rate_cut' 
  | 'inflation_rise' 
  | 'tech_innovation'
  | 'policy_reform'
  | 'trade_conflict'
  | 'housing_market'
  | 'energy_crisis'
  | 'startup_boost'

interface MarketEvent {
  type: MarketEventType
  impact: number
  probability: number
}

interface CompanyNews {
  title: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number; // 가격 영향도 (-1.0 ~ 1.0)
}

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

export class MarketScheduler {
  private static instance: MarketScheduler | null = null;
  private supabase: any
  private isRunning: boolean = false
  private marketUpdateJob: cron.ScheduledTask | null = null
  private newsEventJob: cron.ScheduledTask | null = null
  private readonly MARKET_OPEN_HOUR = 9;    // 장 시작 시간
  private readonly MARKET_CLOSE_HOUR = 24;  // 장 마감 시간 (자정)
  
  private readonly marketNewsTemplates: NewsTemplate[] = [
    // 대형 이벤트 (큰 영향)
    {
      title: '글로벌 금융 위기 발생',
      content: '주요국 증시 폭락, 전세계 금융시장 패닉',
      sentiment: 'negative',
      impact: -0.25,
      type: 'market',
      volatility: 2.5
    },
    {
      title: '획기적인 AI 기술 발전',
      content: '새로운 AI 혁신으로 전 산업 생산성 향상 기대',
      sentiment: 'positive',
      impact: 0.12,
      type: 'market',
      volatility: 1.8
    },
    // 중간 규모 이벤트
    {
      title: '중앙은행 기준금리 인상',
      content: '예상보다 높은 수준의 금리 인상 단행',
      sentiment: 'negative',
      impact: -0.08,
      type: 'market',
      volatility: 1.5
    },
    {
      title: '주요국 경기부양책 발표',
      content: '대규모 경기부양 정책 시행 예정',
      sentiment: 'positive',
      impact: 0.07,
      type: 'market',
      volatility: 1.3
    },
    // 소규모 이벤트
    {
      title: '국제유가 소폭 상승',
      content: '원자재 가격 전반적 상승세',
      sentiment: 'neutral',
      impact: -0.02,
      type: 'market',
      volatility: 1.1
    }
  ];

  private readonly companyNewsTemplates: NewsTemplate[] = [
    // 대형 뉴스
    {
      title: '대규모 회계부정 적발',
      content: '기업 회계장부 조작 의혹 제기',
      sentiment: 'negative',
      impact: -0.35,
      type: 'company',
      volatility: 2.5
    },
    {
      title: '혁신적 신제품 출시',
      content: '시장 판도를 바꿀 새로운 제품 공개',
      sentiment: 'positive',
      impact: 0.20,
      type: 'company',
      volatility: 1.8
    },
    // 중간 규모 뉴스
    {
      title: '분기 실적 발표',
      content: '예상치 상회하는 실적 달성',
      sentiment: 'positive',
      impact: 0.12,
      type: 'company',
      volatility: 1.5
    },
    {
      title: '대규모 구조조정 착수',
      content: '인력 감축 계획 발표',
      sentiment: 'negative',
      impact: -0.10,
      type: 'company',
      volatility: 1.4
    },
    // 소규모 뉴스
    {
      title: '신규 특허 등록',
      content: '기술 경쟁력 강화 기대',
      sentiment: 'positive',
      impact: 0.05,
      type: 'company',
      volatility: 1.2
    }
  ];

  private constructor() {}

  static async getInstance(): Promise<MarketScheduler> {
    if (!MarketScheduler.instance) {
      MarketScheduler.instance = new MarketScheduler();
      await MarketScheduler.instance.initialize();
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
    if (this.isRunning) {
      console.log('마켓 스케줄러가 이미 실행 중입니다.')
      return
    }
    
    // 기존 인스턴스의 모든 작업을 정리
    if (MarketScheduler.instance) {
      await MarketScheduler.instance.cleanup()
    }
    
    await this.initialize()
    this.isRunning = true

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
    const priceUpdateJob = cron.schedule('* * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('시장 업데이트 시작:', new Date().toISOString())
        await this.updateMarket();
      }
    });

    // 5분마다 뉴스 생성
    this.newsEventJob = cron.schedule('*/5 * * * *', async () => {
      if (this.isMarketOpen()) {
        console.log('뉴스 생성 시작:', new Date().toISOString())
        await this.generateNewsAndEvents();
      }
    });

    // 모든 작업을 하나로 묶기
    const allJobs = [openingJob, closingJob, priceUpdateJob];
    this.marketUpdateJob = {
      stop: () => {
        console.log('모든 마켓 작업 중지')
        allJobs.forEach(job => job.stop());
      }
    } as cron.ScheduledTask;
  }

  private async cleanup() {
    console.log('마켓 스케줄러 정리 시작')
    if (this.marketUpdateJob) {
      this.marketUpdateJob.stop()
      this.marketUpdateJob = null
    }
    if (this.newsEventJob) {
      this.newsEventJob.stop()
      this.newsEventJob = null
    }
    this.isRunning = false
    MarketScheduler.instance = null
    console.log('마켓 스케줄러 정리 완료')
  }

  private async initialize() {
    console.log('마켓 스케줄러 초기화')
    this.supabase = await createClient()
    
    // 초기화 시 current_price를 last_closing_price로 설정
    const { data: companies } = await this.supabase
      .from('companies')
      .select('*')
    
    for (const company of companies || []) {
      await this.supabase
        .from('companies')
        .update({ 
          last_closing_price: company.current_price 
        })
        .eq('id', company.id)
    }
  }

  private async updateMarket() {
    try {
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

    } catch (error) {
      console.error('시장 업데이트 중 오류 발생:', error)
    }
  }

  private async generateNewsAndEvents() {
    try {
      if (!this.isMarketOpen()) {
        console.log('장 운영 시간이 아닙니다.');
        return;
      }

      let newsCreated = false;

      // 시장 전체 이벤트 (10% 확률로 증가)
      if (Math.random() < 0.10) {
        const marketNews = this.selectRandomNews(this.marketNewsTemplates);
        await this.createNews({
          ...marketNews,
          title: `[시장 전체] ${marketNews.title}`,
          content: `${marketNews.content} - 전체 시장에 영향`
        });
        console.log('시장 전체 이벤트 발생:', marketNews.title);
        newsCreated = true;
        return;
      }

      // 시장 전체 이벤트가 없을 경우에만 기업 뉴스 생성 시도
      const { data: companies } = await this.supabase
        .from('companies')
        .select('*');

      // 기업 뉴스 생성 확률 25%로 증가
      if (Math.random() < 0.25) {
        // 랜덤하게 하나의 기업 선택
        const randomCompany = companies[Math.floor(Math.random() * companies.length)];
        
        // 선택된 기업의 뉴스 생성 (15% 확률)
        const companyNews = this.selectRandomNews(this.companyNewsTemplates);
        await this.createNews({
          ...companyNews,
          title: `[${randomCompany.name}] ${companyNews.title}`,
          content: `${randomCompany.name}(${randomCompany.ticker}): ${companyNews.content}`,
          company_id: randomCompany.id
        });
        console.log(`${randomCompany.name} 기업 뉴스 발생:`, companyNews.title);
        newsCreated = true;
      }

      // 뉴스가 생성된 경우에만 가격 업데이트
      if (newsCreated) {
        console.log('뉴스로 인한 가격 변동 발생');
        await this.updateMarket();
      }
    } catch (error) {
      console.error('뉴스/이벤트 생성 중 오류 발생:', error);
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

  private async createNews(news: NewsTemplate, companyId?: string) {
    await this.supabase.from('news').insert({
      title: news.title,
      content: news.content,
      company_id: companyId || null,
      sentiment: news.sentiment,
      impact: news.impact,
      published_at: new Date().toISOString(),
      type: news.type,
      volatility: news.volatility
    });
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
    company: any,
    orders: any[],
    events: any[]
  ): Promise<number> {
    const basePrice = company.current_price
    
    // 1. 호가 영향 계산 - 영향력 증가
    const companyOrders = orders?.filter(o => o.company_id === company.id) || []
    const buyPressure = companyOrders
      .filter(o => o.transaction_type === 'buy')
      .reduce((sum, o) => sum + o.shares, 0)
    const sellPressure = companyOrders
      .filter(o => o.transaction_type === 'sell')
      .reduce((sum, o) => sum + o.shares, 0)
    
    // 주문 영향도를 5000으로 낮춰서 더 큰 변동성 부여
    const orderImpact = (buyPressure - sellPressure) / 5000 

    // 2. 이벤트 영향 계산 - 영향력 2배 증가
    const eventImpact = (events?.reduce((sum, e) => sum + (e.impact || 0), 0) || 0) * 2

    // 3. 랜덤 변동성 증가 (-1.5% ~ 1.5%)
    const randomChange = (Math.random() - 0.5) * 0.03

    // 4. 최종 가격 계산
    const totalChange = 1 + orderImpact + eventImpact + randomChange
    const newPrice = basePrice * totalChange

    // 5. 가격 제한 확대 (최대 ±50%)
    const maxChange = basePrice * 1.5
    const minChange = basePrice * 0.5
    return Math.min(Math.max(newPrice, minChange), maxChange)
  }

  private async createMarketEvent(event: MarketEvent) {
    const descriptions = {
      economic_crisis: [
        '글로벌 경제 위기 발생',
        '주요 경제국 금융 시장 충격',
      ],
      market_boom: [
        '시장 낙관론 확산',
        '글로벌 경기 회복 신호',
      ],
      interest_rate_cut: [
        '중앙은행, 기준금리 인하 결정',
        '금융시장, 금리 인하 기대감 고조',
      ],
      inflation_rise: [
        '소비자 물가 상승률 급등',
        '인플레이션 우려로 생활비 부담 증가',
      ],
      tech_innovation: [
        '최첨단 기술 혁신 발표',
        '신기술 도입으로 산업 전반에 파장 예상',
      ],
      policy_reform: [
        '정부, 대대적 경제 정책 개편 발표',
        '규제 완화 조치로 기업 활로 모색',
      ],
      trade_conflict: [
        '국제 무역 갈등 심화',
        '수출입 규제 강화로 글로벌 시장 동요',
      ],
      housing_market: [
        '부동산 시장 과열 우려',
        '주택 가격 급등, 정부의 대책 마련 필요',
      ],
      energy_crisis: [
        '에너지 공급 불안, 가격 폭등 우려',
        '원자재 시장 변동성 심화',
      ],
      startup_boost: [
        '스타트업 투자 활성화',
        '혁신 기업, 시장 경쟁력 강화 기대',
      ],
      // 필요에 따라 추가 이벤트 설명을 더 작성할 수 있습니다.
    };
  

    const description = descriptions[event.type][
      Math.floor(Math.random() * descriptions[event.type].length)
    ]

    await this.supabase.from('market_events').insert({
      event_type: event.type,
      description,
      impact: event.impact,
      is_active: true,
      expires_at: new Date(Date.now() + 30 * 60000) // 30분 지속
    })
  }

  private async generateCompanyNews(company: any) {
    const newsTemplates: CompanyNews[] = [
      // 긍정적인 뉴스 (큰 영향)
      { 
        title: '실적 발표', 
        content: `${company.name}의 분기 실적 예상치 크게 상회`, 
        sentiment: 'positive',
        impact: 0.15
      },
      { 
        title: '대규모 투자 유치', 
        content: `${company.name}, 1조원 규모 투자 유치 성공`, 
        sentiment: 'positive',
        impact: 0.12
      },
      // 긍정적인 뉴스 (중간 영향)
      { 
        title: '신규 사업 진출', 
        content: `${company.name}, 유망 시장 진출 선언`, 
        sentiment: 'positive',
        impact: 0.08
      },
      // 부정적인 뉴스 (큰 영향)
      { 
        title: '대규모 리콜', 
        content: `${company.name}, 주력 제품 전량 리콜 실시`, 
        sentiment: 'negative',
        impact: -0.15
      },
      { 
        title: '횡령 사건', 
        content: `${company.name} 경영진, 대규모 횡령 의혹`, 
        sentiment: 'negative',
        impact: -0.12
      },
      // 중립적인 뉴스
      { 
        title: '조직 개편', 
        content: `${company.name}, 정기 조직 개편 실시`, 
        sentiment: 'neutral',
        impact: 0.02
      }
    ];

    const selectedNews = newsTemplates[Math.floor(Math.random() * newsTemplates.length)];

    // 뉴스 생성 및 주가 영향 반영
    await this.supabase.from('news').insert({
      company_id: company.id,
      title: selectedNews.title,
      content: selectedNews.content,
      sentiment: selectedNews.sentiment,
      impact: selectedNews.impact
    });

    // 뉴스 영향에 따른 즉각적인 주가 변동
    const currentPrice = company.current_price;
    const priceChange = currentPrice * (1 + selectedNews.impact);
    await this.updateCompanyPrice(company.id, priceChange);
  }

  private async updateCompanyPrice(companyId: string, newPrice: number) {
    await this.supabase
      .from('companies')
      .update({ 
        current_price: newPrice,
        updated_at: new Date().toISOString()
      })
      .eq('id', companyId)
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
} 