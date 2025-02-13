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
    BASE_RANDOM_CHANGE: 0.01,           // 기본 변동폭 (±1%)
    REVERSAL: {
      BASE_CHANCE: 0.1,                 // 기본 반전 확률 (10%)
      MOMENTUM_MULTIPLIER: 0.15,        // 모멘텀당 추가 반전 확률 (15%)
      MAX_CHANCE: 0.85                  // 최대 반전 확률 (85%)
    },
    DAILY_LIMIT: 0.30,                  // 일일 가격 제한폭 (30%)
    WEIGHTS: {
      RANDOM: 0.3,
      NEWS: 0.55,                        // 뉴스 영향력 가중치 감소
      INDUSTRY: 0.3,
      MOMENTUM: 0.4,
      INDUSTRY_LEADER: 0.3
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

    // 아직 적용되지 않은 뉴스만 필터링 (applied가 false인 것들)
    const activeNews = recentNews.filter(news => 
      news.type === 'company' && 
      news.company_id === companyId && 
      !news.applied
    );

    for (const news of activeNews) {
      const timeElapsed = (now.getTime() - new Date(news.published_at).getTime()) / (60 * 1000);
      const effectiveDuration = this.getEffectiveDuration(news.volatility);
      
      if (timeElapsed <= effectiveDuration) {
        // 뉴스가 아직 유효한 경우, 매 분마다 적용할 영향도 계산
        const directionMultiplier = Math.random() < 0.7 ? 1 : -0.5;
        const impactVariation =
          SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN +
          Math.random() * (SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MAX - SIMULATION_PARAMS.NEWS.IMPACT_VARIATION_MIN);
        
        const baseImpact = news.impact * impactVariation * directionMultiplier;
        const sentimentMultiplier = this.calculateSentimentMultiplier(news.sentiment);
        const volatilityMultiplier = news.volatility >= 1.8 ? 1.2 : 1.0;

        // 단리 적용을 위한 매 분당 영향도 계산
        const perMinuteImpact = baseImpact * sentimentMultiplier * volatilityMultiplier * marketCapMultiplier;
        
        // 매 분당 영향도를 -0.06 ~ 0.06 범위로 제한
        const clampedImpact = Math.max(Math.min(perMinuteImpact, 0.06), -0.06);
        totalPerMinuteImpact += clampedImpact;
      } else {
        // 유효기간이 지난 뉴스는 applied로 표시
        await this.supabase
          .from('news')
          .update({ applied: true })
          .eq('id', news.id);
      }
    }

    // 최종 영향도에 NEWS 가중치 적용
    return totalPerMinuteImpact * SIMULATION_PARAMS.PRICE.WEIGHTS.NEWS;
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
    
    // 기본 랜덤 변동에 가우시안 노이즈 추가
    const baseRandomChange = (Math.random() - 0.5) * SIMULATION_PARAMS.PRICE.BASE_RANDOM_CHANGE;
    const gaussianNoise = this.randomGaussian(0, 0.002);
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