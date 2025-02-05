import { createClient } from '@/lib/supabase/server'
import cron from 'node-cron'

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

export class MarketScheduler {
  private static instance: MarketScheduler | null = null;
  private supabase: any
  private isRunning: boolean = false
  private marketUpdateJob: cron.ScheduledTask | null = null
  private newsEventJob: cron.ScheduledTask | null = null
  
  private constructor() {}

  static async getInstance(): Promise<MarketScheduler> {
    if (!MarketScheduler.instance) {
      MarketScheduler.instance = new MarketScheduler();
      await MarketScheduler.instance.initialize();
    }
    return MarketScheduler.instance;
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

    // 새로운 작업 시작
    this.marketUpdateJob = cron.schedule('* * * * *', async () => {
      await this.updateMarket()
    })

    this.newsEventJob = cron.schedule('*/5 * * * *', async () => {
      await this.generateNewsAndEvents()
    })
  }

  private async cleanup() {
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
  }

  private async initialize() {
    this.supabase = await createClient()
  }

  private async updateMarket() {
    try {
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

      // 3. 각 기업별 가격 업데이트
      const { data: companies } = await this.supabase
        .from('companies')
        .select('*')

      for (const company of companies || []) {
        const newPrice = await this.calculateNewPrice(company, orders, activeEvents)
        
        // 현재 가격을 이전 가격으로 저장하고 새 가격 업데이트
        await this.supabase
          .from('companies')
          .update({ 
            previous_price: company.current_price,
            current_price: newPrice 
          })
          .eq('id', company.id)
      }
      console.log('시장 업데이트 완료')
    } catch (error) {
      console.error('시장 업데이트 중 오류 발생:', error)
    }
  }

  private async generateNewsAndEvents() {
    try {
      const events: MarketEvent[] = [
        { type: 'economic_crisis', impact: -0.05, probability: 0.1 },
        { type: 'market_boom', impact: 0.05, probability: 0.1 },
        { type: 'interest_rate_cut', impact: -0.02, probability: 0.2 },
        { type: 'tech_innovation', impact: 0.03, probability: 0.2 },
      ]

      // 랜덤 이벤트 발생
      for (const event of events) {
        if (Math.random() < event.probability) {
          await this.createMarketEvent(event)
        }
      }

      // 기업별 뉴스 생성
      const { data: companies } = await this.supabase
        .from('companies')
        .select('*')

      for (const company of companies || []) {
        if (Math.random() < 0.3) { // 30% 확률로 뉴스 생성
          await this.generateCompanyNews(company)
        }
      }
      console.log('뉴스/이벤트 생성 완료')
    } catch (error) {
      console.error('뉴스/이벤트 생성 중 오류 발생:', error)
    }
  }

  private async calculateNewPrice(
    company: any,
    orders: any[],
    events: any[]
  ): Promise<number> {
    const basePrice = company.current_price
    
    // 1. 호가 영향 계산
    const companyOrders = orders?.filter(o => o.company_id === company.id) || []
    const buyPressure = companyOrders
      .filter(o => o.transaction_type === 'buy')
      .reduce((sum, o) => sum + o.shares, 0)
    const sellPressure = companyOrders
      .filter(o => o.transaction_type === 'sell')
      .reduce((sum, o) => sum + o.shares, 0)
    
    const orderImpact = (buyPressure - sellPressure) / 10000 // 주문 영향도 조정 가능

    // 2. 이벤트 영향 계산
    const eventImpact = events?.reduce((sum, e) => sum + (e.impact || 0), 0) || 0

    // 3. 랜덤 변동성 (-0.5% ~ 0.5%)
    const randomChange = (Math.random() - 0.5) * 0.01

    // 4. 최종 가격 계산
    const totalChange = 1 + orderImpact + eventImpact + randomChange
    const newPrice = basePrice * totalChange

    // 5. 가격 제한 (최대 ±30%)
    const maxChange = basePrice * 1.3
    const minChange = basePrice * 0.7
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
    const newsTemplates = [
      { title: '실적 발표', content: `${company.name}의 분기 실적 예상치 상회` },
      { title: '신규 사업 진출', content: `${company.name}, 신규 시장 진출 선언` },
      // 추가된 50개의 뉴스 템플릿
      { title: '스타일 리뉴얼', content: `${company.name}의 새로운 이미지 변신!` },
      { title: 'CEO 깜짝 방문', content: `${company.name}의 CEO가 각 지점을 깜짝 방문했습니다.` },
      { title: '직원 파티', content: `${company.name} 전 직원이 참여한 깜짝 파티 개최!` },
      { title: '기술 혁신', content: `${company.name}, AI 로봇 도입으로 미래를 선도하다` },
      { title: '친환경 경영', content: `${company.name}, 대대적인 친환경 정책 시행` },
      { title: '사회공헌 활동', content: `${company.name}, 지역사회와 함께하는 나눔 프로젝트 시작` },
      { title: '문화 행사 후원', content: `${company.name}, 유명 문화행사 후원으로 화제` },
      { title: '새로운 파트너십', content: `${company.name}, 글로벌 기업과 전략적 제휴 체결` },
      { title: '신제품 출시', content: `${company.name}의 혁신적인 신제품이 공개되었습니다.` },
      { title: '시장 점유율 상승', content: `${company.name}, 전년 대비 시장 점유율 급증!` },
      { title: '재택근무 도입', content: `${company.name}, 전 직원 재택근무 전환 성공` },
      { title: '복지 강화', content: `${company.name}, 직원 복지 대폭 강화` },
      { title: '특허 출원 성공', content: `${company.name}, 혁신 기술 특허 출원에 성공하다` },
      { title: '이색 이벤트', content: `${company.name}, 고객 대상 특별 이벤트 진행` },
      { title: '투명 경영', content: `${company.name}, 신뢰 구축 위한 투명 경영 실현` },
      { title: '브랜드 리뉴얼', content: `${company.name}, 브랜드 이미지 전면 개편` },
      { title: '유명인과 콜라보', content: `${company.name}, 인기 연예인과 이색 콜라보 진행` },
      { title: '세계 기록 경신', content: `${company.name}, 하루 매출 세계 기록 경신!` },
      { title: '대규모 투자 유치', content: `${company.name}, 대규모 투자 유치에 성공하다` },
      { title: '해외 시장 진출', content: `${company.name}, 글로벌 시장 공략 본격 시작` },
      { title: '지속 가능한 성장', content: `${company.name}, 지속 가능한 성장 전략 발표` },
      { title: '온라인 플랫폼 런칭', content: `${company.name}, 혁신적 온라인 서비스 시작` },
      { title: '모바일 앱 출시', content: `${company.name}, 사용자 편의 모바일 앱 출시` },
      { title: '데이터 보안 강화', content: `${company.name}, 최신 보안 기술 도입 완료` },
      { title: '스마트 오피스 전환', content: `${company.name}, 스마트 오피스로 업무 혁신` },
      { title: '국제 대회 수상', content: `${company.name}, 글로벌 대회에서 수상 쾌거 달성` },
      { title: '신규 연구 개발', content: `${company.name}, 혁신 연구 프로젝트에 돌입` },
      { title: '크리에이티브 마케팅', content: `${company.name}, 창의적 광고 캠페인 선보여` },
      { title: '파격 할인 행사', content: `${company.name}, 고객 대상 파격 할인 이벤트 진행` },
      { title: 'SNS 챌린지', content: `${company.name}, 화제의 SNS 챌린지 론칭` },
      { title: '주가 상승', content: `${company.name}, 주식 시장서 주가 강세 지속` },
      { title: '인재 영입', content: `${company.name}, 업계 최고 인재 대거 영입` },
      { title: '고객 신뢰도 1위', content: `${company.name}, 고객 신뢰도 1위 등극!` },
      { title: '대규모 프로모션', content: `${company.name}, 고객 몰입 프로모션 개최` },
      { title: '테크 혁명', content: `${company.name}, 혁신 기술로 업계 판도 전환` },
      { title: '유명인 투자 참여', content: `${company.name}, 유명 투자자가 합류했습니다.` },
      { title: '스타트업 인수', content: `${company.name}, 유망 스타트업 인수로 도약` },
      { title: '최첨단 본사 개소', content: `${company.name}, 혁신적 본사 개소식 개최` },
      { title: '사회적 책임 캠페인', content: `${company.name}, 사회적 책임 이행 캠페인 전개` },
      { title: '혁신 재무 전략', content: `${company.name}, 새로운 재무 전략 발표` },
      { title: '창의력 경진대회', content: `${company.name}, 직원 대상 창의력 경진대회 개최` },
      { title: 'CEO 특별 인터뷰', content: `${company.name} CEO의 특별 인터뷰 공개` },
      { title: '미래 비전 제시', content: `${company.name}, 혁신적 미래 비전 발표` },
      { title: '글로벌 협력 강화', content: `${company.name}, 세계적 기업과 협력 강화` },
      { title: '재치 있는 광고', content: `${company.name}, SNS를 강타한 유쾌한 광고` },
      { title: '비즈니스 모델 혁신', content: `${company.name}, 새로운 비즈니스 모델 선보여` },
      { title: '독창적 이벤트', content: `${company.name}, 크리에이티브 이벤트로 화제 모음` },
      { title: '업계 선두주자', content: `${company.name}, 혁신의 선두주자로 자리매김` },
      { title: '창립 기념 이벤트', content: `${company.name}, 창립 기념 특별 이벤트 진행` },
      { title: '서프라이즈 발표', content: `${company.name}, 업계에 충격을 준 서프라이즈 발표` },
    ];
  
    const template = newsTemplates[Math.floor(Math.random() * newsTemplates.length)]

    await this.supabase.from('news').insert({
      company_id: company.id,
      title: template.title,
      content: template.content
    })
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
} 