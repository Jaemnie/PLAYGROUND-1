import { createClient } from '@/lib/supabase/server'
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
  private _isRunning: boolean = false;
  private supabase!: SupabaseClient;
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
  private qstash: Client = new Client({
    token: process.env.QSTASH_TOKEN!,
    baseUrl: process.env.QSTASH_URL
  });
  private companyNewsTemplates: NewsTemplate[] = [
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
    },
    {
      title: '사내 스타 탄생, 비밀 프로젝트 성과 공개',
      content: '깜짝 놀랄 혁신 프로젝트가 성공적으로 완료되어, 사내 스타로 떠오른 팀이 주목받고 있습니다!',
      sentiment: 'positive',
      impact: 0.35,
      type: 'company',
      volatility: 2.3
    },
    {
      title: '미래를 여는 AI 비서, 상용화 임박',
      content: '최첨단 인공지능 비서가 실제 업무에 투입되어, 직원들의 업무 효율성이 급상승하고 있습니다!',
      sentiment: 'positive',
      impact: 0.30,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '사내 VR 체험존 오픈, 현실을 넘나드는 체험',
      content: '직원들을 위한 최첨단 VR 체험존 개장이 발표되어, 업무 중 스트레스 해소와 창의력 증진에 도움을 주고 있습니다.',
      sentiment: 'positive',
      impact: 0.20,
      type: 'company',
      volatility: 1.8
    },
    {
      title: '비밀의 연말 파티, 예상치 못한 대반전',
      content: '회사가 비밀리에 진행한 연말 파티에서 깜짝 이벤트와 대반전이 연속으로 펼쳐져, 전 직원이 놀라움과 웃음을 터트렸습니다.',
      sentiment: 'neutral',
      impact: 0.10,
      type: 'company',
      volatility: 1.5
    },
    {
      title: '사내 펫 페스티벌, 동물들의 대소동',
      content: '반려동물을 데려온 직원들이 참여한 사내 펫 페스티벌에서 귀여운 동물들의 해프닝이 화제를 모으고 있습니다.',
      sentiment: 'positive',
      impact: 0.08,
      type: 'company',
      volatility: 1.3
    },
    {
      title: '이색 기업 전시회, 창의력의 향연',
      content: '사내 창의적 아이디어 전시회가 개최되어, 독특한 작품들과 혁신적 컨셉이 전 직원에게 영감을 주고 있습니다.',
      sentiment: 'positive',
      impact: 0.12,
      type: 'company',
      volatility: 1.7
    },
    {
      title: '직원 맞춤형 복지 시스템 도입',
      content: '개인의 라이프스타일을 반영한 맞춤형 복지 시스템이 도입되어, 직원 만족도와 업무 효율성이 크게 향상되고 있습니다.',
      sentiment: 'positive',
      impact: 0.15,
      type: 'company',
      volatility: 1.2
    },
    {
      title: '미래 지향적 사내 교육 프로그램 개편',
      content: '4차 산업혁명 시대에 발맞춘 새로운 사내 교육 프로그램 개편으로, 직원들의 전문성과 창의력이 증진될 전망입니다.',
      sentiment: 'positive',
      impact: 0.07,
      type: 'company',
      volatility: 1.1
    },
    {
      title: '사내 커뮤니티 앱, 소통의 혁명',
      content: '새롭게 출시된 사내 커뮤니티 앱이 직원 간 소통과 협업의 문화를 혁신적으로 변화시키고 있습니다.',
      sentiment: 'positive',
      impact: 0.09,
      type: 'company',
      volatility: 1.0
    },
    {
      title: '의외의 기업 간 합작, 신사업 도전',
      content: '전혀 다른 업계의 기업과 손잡아 새로운 신사업에 도전, 예상치 못한 시너지 효과로 업계에 신선한 바람을 불어넣고 있습니다.',
      sentiment: 'neutral',
      impact: 0.05,
      type: 'company',
      volatility: 1.4
    },
    {
      title: '사내 혁신 아이디어 공모전, 놀라운 결과 발표',
      content: '직원들이 제출한 창의적 아이디어가 빛을 발하며, 회사 전반에 새로운 혁신의 물결을 일으키고 있습니다.',
      sentiment: 'positive',
      impact: 0.18,
      type: 'company',
      volatility: 1.9
    },
    {
      title: '비상식적인 마케팅 전략, 매출 급증 효과',
      content: '독특한 마케팅 전략이 예상 밖의 성과를 내며, 단기간 내에 매출 증가에 기여하는 결과를 가져왔습니다.',
      sentiment: 'positive',
      impact: 0.22,
      type: 'company',
      volatility: 2.1
    },
    {
      title: '사내 "해적의 날" 이벤트, 모두의 참여 열기',
      content: '전 직원이 해적 복장을 착용하고 참여한 이색 이벤트가 사내 분위기를 한층 밝게 만들어 주고 있습니다.',
      sentiment: 'positive',
      impact: 0.10,
      type: 'company',
      volatility: 1.3
    },
    {
      title: '사내 로봇 도입, 업무 혁신과 재미 동시에',
      content: '최첨단 로봇이 도입되어 반복 업무는 물론, 창의적 아이디어 실현에도 도움을 주며 업무 환경에 신선한 변화를 가져오고 있습니다.',
      sentiment: 'positive',
      impact: 0.16,
      type: 'company',
      volatility: 1.8
    },
    {
      title: '회사 대표, SNS 생방송 토크쇼 진행',
      content: '회사의 대표가 SNS 생방송을 통해 직원 및 고객과 소통하며, 인간적인 매력과 투명한 경영 철학을 선보이고 있습니다.',
      sentiment: 'neutral',
      impact: 0.07,
      type: 'company',
      volatility: 1.5
    },
    {
      title: '예상치 못한 디자인 리뉴얼, 사용자 반응 뜨거워',
      content: '웹사이트와 앱의 파격적인 디자인 리뉴얼이 고객들 사이에서 큰 호응을 얻으며, 브랜드 이미지에 긍정적 영향을 미치고 있습니다.',
      sentiment: 'positive',
      impact: 0.12,
      type: 'company',
      volatility: 1.4
    },
    {
      title: '기발한 신제품 광고, 소셜 미디어를 강타',
      content: '창의적인 신제품 광고 캠페인이 소셜 미디어에서 폭발적인 반응을 이끌어내며, 브랜드 인지도를 한층 높이고 있습니다.',
      sentiment: 'positive',
      impact: 0.20,
      type: 'company',
      volatility: 1.9
    }
  ];

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
      console.log('마켓 스케줄러가 이미 실행 중입니다.')
      return
    }

    try {
      await this.initialize();
      this._isRunning = true;
      
      // QStash 작업 등록만 하고 즉시 실행은 하지 않도록 수정
      await this.scheduleTasks();
      
      // 초기 실행은 스케줄에 따라 자동으로 이루어지도록 함
      console.log('마켓 스케줄러가 시작되었습니다. 다음 예약된 시간에 작업이 실행됩니다.');
    } catch (error) {
      console.error('스케줄러 시작 실패:', error)
      throw error
    }
  }

  private async scheduleTasks() {
    // 마켓 업데이트 (1분마다)
    await this.qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/market-update`,
      cron: '* * * * *',
      deduplicationId: 'market-update'
    });

    // 뉴스 업데이트 (30분마다)
    await this.qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/news-update`,
      cron: '*/30 * * * *',
      deduplicationId: 'news-update'
    });

    // 장 시작 (매일 9시)
    await this.qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/market-open`,
      cron: '0 9 * * *',
      deduplicationId: 'market-open'
    });

    // 장 마감 (매일 24시)
    await this.qstash.publishJSON({
      url: `${process.env.NEXT_PUBLIC_APP_URL}/api/cron/market-close`,
      cron: '0 0 * * *',
      deduplicationId: 'market-close'
    });
  }

  public async cleanup() {
    // QStash 작업 취소 로직 추가 필요
    this._isRunning = false;
    MarketScheduler.instance = null;
    console.log('마켓 스케줄러 정리 완료');
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

  private isScheduledTime(type: 'market' | 'news'): boolean {
    const now = new Date();
    
    if (type === 'market') {
      return now.getSeconds() === 0; // 정각 분에만 실행
    }
    
    if (type === 'news') {
      return now.getMinutes() % 30 === 0 && now.getSeconds() === 0; // 30분 단위에만 실행
    }
    
    return false;
  }

  public async updateMarket() {
    if (!this.isScheduledTime('market')) {
      console.log('마켓 업데이트 예약 시간이 아닙니다.');
      return;
    }
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

  public async updateNews(): Promise<void> {
    if (!this.isScheduledTime('news')) {
      console.log('뉴스 업데이트 예약 시간이 아닙니다.');
      return;
    }
    try {
      console.log("뉴스 업데이트 실행 중");
      
      // 기업 뉴스 생성
      await this.generateCompanyNews();
      
      // 마지막 뉴스 업데이트 시간 기록
      this.lastNewsUpdate = new Date();
      
      // 다음 실행 시간 계산 및 상태 업데이트
      const nextRun = this.calculateNextRun('news_generation');
      await this.updateStatus({
        status: 'running',
        lastRun: new Date(),
        nextRun,
        jobType: 'news_generation'
      });

      console.log('뉴스 업데이트 완료');
    } catch (error) {
      console.error('뉴스 업데이트 중 오류 발생:', error);
      await this.updateStatus({
        status: 'error',
        lastRun: new Date(),
        nextRun: null,
        errorMessage: error instanceof Error ? error.message : '알 수 없는 오류입니다.',
        jobType: 'news_generation'
      });
      throw error;
    }
  }
}