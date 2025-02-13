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
    IMPACT_VARIATION_MIN: 1.0,          // 최소 영향력 유지
    IMPACT_VARIATION_MAX: 1.8,          // 최대 영향력 1.8배로 증가
    DECAY_TIME_MINUTES: 45,
  },
  PRICE: {
    BASE_RANDOM_CHANGE: 0.035,           // 기본 변동폭 3.5%로 증가 (기존 1%)
    REVERSAL: {
      BASE_CHANCE: 0.15,                 // 기본 반전 확률 15%로 증가 (기존 10%)
      MOMENTUM_MULTIPLIER: 0.2,          // 모멘텀당 추가 반전 확률 20%로 증가 (기존 15%)
      MAX_CHANCE: 0.9                    // 최대 반전 확률 90%로 증가 (기존 85%)
    },
    DAILY_LIMIT: 0.30,                   // 일일 가격 제한폭 유지
    WEIGHTS: {
      RANDOM: 0.4,                       // 랜덤 변동 가중치 증가 (기존 0.3)
      NEWS: 0.5,                         // 뉴스 영향력 조정 (기존 0.55)
      INDUSTRY: 0.35,                    // 산업 영향력 증가 (기존 0.3)
      MOMENTUM: 0.45,                    // 모멘텀 영향력 증가 (기존 0.4)
      INDUSTRY_LEADER: 0.35              // 산업 리더 영향력 증가 (기존 0.3)
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
  private companyNewsTemplates: NewsTemplate[] = [
    /* Negative Templates (총 20개, volatility 내림차순) */
    {
      title: '대규모 회계부정 의혹 제기',
      content: '내부 고발로 드러난 분식회계 의혹… 금융당국의 특별 감리와 함께 주가 급락 우려!',
      sentiment: 'negative',
      impact: -0.45,
      type: 'company',
      volatility: 3.0
    },
    {
      title: '대규모 횡령 사건 발생',
      content: '경영진의 대규모 횡령 사실이 드러나며 기업 신뢰도 급락',
      sentiment: 'negative',
      impact: -0.43,
      type: 'company',
      volatility: 2.9
    },
    {
      title: '주요 특허 소송 패소',
      content: '핵심 기술 관련 특허 소송에서 패소... 막대한 배상금 지급 예정',
      sentiment: 'negative',
      impact: -0.40,
      type: 'company',
      volatility: 2.8
    },
    {
      title: '내부자 거래 의혹',
      content: '임원진의 내부자 거래 의혹으로 조사 착수',
      sentiment: 'negative',
      impact: -0.38,
      type: 'company',
      volatility: 2.7
    },
    {
      title: '대규모 담합 혐의',
      content: '공정위, 수년간의 시장 가격 담합 혐의 조사 착수',
      sentiment: 'negative',
      impact: -0.36,
      type: 'company',
      volatility: 2.6
    },
    {
      title: '대규모 사이버 보안 사고',
      content: '회사 시스템 해킹으로 인한 데이터 유출 발생, 신속한 복구 조치 중입니다.',
      sentiment: 'negative',
      impact: -0.35,
      type: 'company',
      volatility: 2.5
    },
    {
      title: '투자 손실 발생',
      content: '신규 사업 투자 실패로 대규모 손실 발생',
      sentiment: 'negative',
      impact: -0.32,
      type: 'company',
      volatility: 2.5
    },
    {
      title: '대형 거래처 계약 해지',
      content: '주요 매출처와의 계약 중단으로 실적 악화 전망',
      sentiment: 'negative',
      impact: -0.30,
      type: 'company',
      volatility: 2.4
    },
    {
      title: '제품 안전성 문제 제기',
      content: '주력 제품의 안전성 결함 발견으로 소비자 신뢰도 하락',
      sentiment: 'negative',
      impact: -0.28,
      type: 'company',
      volatility: 2.2
    },
    {
      title: '직원 대량 이직 사태',
      content: '핵심 인재들의 잇따른 퇴사로 기업 경쟁력 약화 우려가 제기됩니다.',
      sentiment: 'negative',
      impact: -0.25,
      type: 'company',
      volatility: 2.3
    },
    {
      title: '신용등급 하락',
      content: '재무건전성 악화로 기업 신용등급 강등',
      sentiment: 'negative',
      impact: -0.25,
      type: 'company',
      volatility: 2.1
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
      title: '부실 경영 의혹',
      content: '경영 전반의 부실로 인한 의혹 제기, 투자자 신뢰 하락 우려',
      sentiment: 'negative',
      impact: -0.30,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '해외 사업장 폐쇄',
      content: '수익성 악화로 주요 해외 생산기지 철수 결정',
      sentiment: 'negative',
      impact: -0.22,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '주요 인증 취소',
      content: '품질 관리 미흡으로 핵심 제품 인증 취소',
      sentiment: 'negative',
      impact: -0.20,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '대규모 구조조정 계획',
      content: '경영 악화로 인한 인력 감축... 노조와의 갈등 우려',
      sentiment: 'negative',
      impact: -0.18,
      type: 'company',
      volatility: 1.9
    },
    {
      title: '신제품 출시 연기',
      content: '기술적 문제로 인한 신제품 출시 무기한 연기',
      sentiment: 'negative',
      impact: -0.15,
      type: 'company',
      volatility: 1.8
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
      title: '주요 임원 사임',
      content: '핵심 임원진의 갑작스러운 사임으로 경영 불확실성 증가',
      sentiment: 'negative',
      impact: -0.12,
      type: 'company',
      volatility: 1.6
    },
    {
      title: '노사 갈등 심화',
      content: '임금 협상 결렬로 노사 관계 악화, 파업 가능성 제기',
      sentiment: 'negative',
      impact: -0.10,
      type: 'company',
      volatility: 1.5
    },

    /* Positive Templates (총 20개, volatility 내림차순) */
    {
      title: '혁신적 AI 기술 개발',
      content: '세계 최초 AI 기술 개발 성공으로 시장 지배력 확대 전망',
      sentiment: 'positive',
      impact: 0.45,
      type: 'company',
      volatility: 3.0
    },
    {
      title: '전설의 CEO 복귀',
      content: '퇴임 후 갑작스럽게 복귀한 전설의 CEO가 회사에 새로운 바람을 예고합니다!',
      sentiment: 'positive',
      impact: 0.42,
      type: 'company',
      volatility: 2.9
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
      title: '신비로운 연구 성과 공개',
      content: '비밀리에 진행된 혁신 연구 결과가 공개되어 미래 기술에 대한 기대감이 폭발합니다!',
      sentiment: 'positive',
      impact: 0.38,
      type: 'company',
      volatility: 2.7
    },
    {
      title: '대규모 해외 수주',
      content: '역대 최대 규모의 해외 프로젝트 수주 성공',
      sentiment: 'positive',
      impact: 0.36,
      type: 'company',
      volatility: 2.6
    },
    {
      title: '실적 서프라이즈 달성',
      content: '시장 예상치를 30% 상회하는 영업이익 기록! 주력 사업의 호조가 눈에 띕니다.',
      sentiment: 'positive',
      impact: 0.35,
      type: 'company',
      volatility: 2.5
    },
    {
      title: '차세대 제품 개발 성공',
      content: '미래 시장을 선도할 혁신 제품 개발 완료',
      sentiment: 'positive',
      impact: 0.34,
      type: 'company',
      volatility: 2.5
    },
    {
      title: '글로벌 기업과 전략적 제휴',
      content: '세계적 기업과의 전략적 파트너십 체결로 시장 지배력 강화 전망',
      sentiment: 'positive',
      impact: 0.32,
      type: 'company',
      volatility: 2.4
    },
    {
      title: '대형 공급계약 체결',
      content: '3년간의 대규모 납품 계약 성사! 향후 매출 신장이 기대됩니다.',
      sentiment: 'positive',
      impact: 0.30,
      type: 'company',
      volatility: 2.3
    },
    {
      title: '시장 점유율 급증',
      content: '급격한 시장 점유율 확대가 관측되어 주가 상승 모멘텀 강화',
      sentiment: 'positive',
      impact: 0.28,
      type: 'company',
      volatility: 2.3
    },
    {
      title: '혁신 플랫폼 출시',
      content: '차세대 디지털 플랫폼 출시로 시장 판도 변화 예고',
      sentiment: 'positive',
      impact: 0.28,
      type: 'company',
      volatility: 2.2
    },
    {
      title: '신규 특허 포트폴리오 구축',
      content: '핵심 기술 분야 특허 다수 확보로 기술 경쟁력 강화',
      sentiment: 'positive',
      impact: 0.26,
      type: 'company',
      volatility: 2.1
    },
    {
      title: '신시장 진출 성공',
      content: '새로운 시장 진출로 사업 다각화 및 성장동력 확보',
      sentiment: 'positive',
      impact: 0.25,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '우수 인재 영입 성공',
      content: '글로벌 최고 수준의 전문가 영입으로 기술력 강화',
      sentiment: 'positive',
      impact: 0.24,
      type: 'company',
      volatility: 2.0
    },
    {
      title: '획기적 원가절감 달성',
      content: '혁신적 생산방식 도입으로 수익성 대폭 개선',
      sentiment: 'positive',
      impact: 0.22,
      type: 'company',
      volatility: 1.9
    },
    {
      title: '정부 지원사업 선정',
      content: '대규모 국책과제 수행기관으로 선정되어 안정적 성장 기반 마련',
      sentiment: 'positive',
      impact: 0.20,
      type: 'company',
      volatility: 1.8
    },
    {
      title: '친환경 인증 획득',
      content: '국제 환경 인증 획득으로 글로벌 시장 확대 전망',
      sentiment: 'positive',
      impact: 0.18,
      type: 'company',
      volatility: 1.7
    },
    {
      title: '신규 생산라인 구축',
      content: '최첨단 스마트 팩토리 구축으로 생산성 향상 기대',
      sentiment: 'positive',
      impact: 0.15,
      type: 'company',
      volatility: 1.6
    },
    {
      title: '고객 만족도 1위',
      content: '업계 최고 수준의 고객 만족도 달성으로 브랜드 가치 상승',
      sentiment: 'positive',
      impact: 0.12,
      type: 'company',
      volatility: 1.5
    },
    {
      title: '안정적 실적 달성',
      content: '분기 실적 시장 전망치 부합으로 안정적 성장세 입증',
      sentiment: 'positive',
      impact: 0.10,
      type: 'company',
      volatility: 1.4
    }
  ];

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

  private selectWeightedNews(templates: NewsTemplate[]): NewsTemplate {
    // 각 템플릿의 weight 계산 (낮은 volatility일수록 높은 weight)
    const weights = templates.map((template) => {
      const vol = template.volatility ?? 1.0;
      return 1 / vol;
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
    
    // 혹시 선택되지 않으면 마지막 템플릿 반환 (예외 상황 방지)
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
          ...news,
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
      case 'positive': return 1.4;  // 긍정 뉴스 영향력 증가
      case 'negative': return 1.6;  // 부정 뉴스 영향력 더 큰 폭 증가
      default: return 1.0;
    }
  }

  private getEffectiveDuration(volatility: number): number {
    const minDuration = 1;    // 최소 1분
    const maxDuration = 20;   // 최대 20분
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
        
        // 긍정적 뉴스도 부정적으로 해석될 수 있는 로직
        const interpretationChance = news.sentiment === 'positive' ? 0.4 : 0.2; // 긍정뉴스가 부정적으로 해석될 확률 40%
        const reverseInterpretation = Math.random() < interpretationChance;
        
        // 방향성 결정 (기존 영향력의 방향을 뒤집을 수 있음)
        const directionMultiplier = reverseInterpretation ? -1 : 1;
        
        // 변동성에 따른 임팩트 변화
        const impactVariation = 
          SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN +
          Math.random() * (SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MAX - SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN);
        
        // 기본 영향력 계산
        const baseImpact = news.impact * impactVariation * directionMultiplier;
        
        // 시장 심리에 따른 증폭/감소
        const marketSentimentMultiplier = marketSentiment < 0.3 ? 0.5 : // 부정적 시장
                                        marketSentiment > 0.7 ? 1.5 : // 긍정적 시장
                                        1.0; // 중립적 시장
        
        const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
        const volatilityMultiplier = news.volatility >= 1.8 ? 1.2 : 1.0;

        // 최종 영향력 계산
        const perMinuteImpact = baseImpact * sentimentMultiplier * volatilityMultiplier * 
                               marketCapMultiplier * marketSentimentMultiplier;
        
        // 영향력 범위 제한 (-0.08 ~ 0.08)로 확대
        const clampedImpact = Math.max(Math.min(perMinuteImpact, 0.08), -0.08);
        totalPerMinuteImpact += clampedImpact;
      } else {
        await this.supabase
          .from('news')
          .update({ applied: true })
          .eq('id', news.id);
      }
    }

    // 최종 영향도에 랜덤 노이즈 추가
    const randomNoise = (Math.random() - 0.5) * 0.02; // ±1% 랜덤 노이즈
    return (totalPerMinuteImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.NEWS) + randomNoise;
  }

  private calculateMarketCapNewsMultiplier(marketCap: number): number {
    // 시가총액이 클수록 뉴스 영향력 증가
    if (marketCap > 100000000000) return 1.4;  // 1000억 이상
    if (marketCap > 10000000000) return 1.2;   // 100억 이상
    if (marketCap > 10000000000) return 1.1;    // 10억 이상
    return 1.0;
  }

  private calculateTimeVolatility(hour: number): number {
    // 시간대별 변동성 가중치 개선
    if (hour >= 9 && hour < 10) return 1.8;  // 개장 초반 매우 높은 변동성
    if (hour >= 10 && hour < 11) return 1.4;  // 개장 1시간 이후 여전히 높은 변동성
    if (hour >= 11 && hour <= 13) return 0.7; // 점심시간대 낮은 변동성
    if (hour >= 14 && hour < 15) return 1.2;  // 오후 시작 보통 변동성
    if (hour >= 15) return 1.6;               // 장 마감 전 높은 변동성
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
    const gaussianNoise = this.randomGaussian(0, 0.008); // 가우시안 노이즈 증가 (기존 0.002)
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

  public async setClosingPrices() {
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

    // 영향도를 -0.02 ~ 0.02 범위로 제한
    return Math.max(Math.min(averageChange * 0.5, 0.02), -0.02);
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
}