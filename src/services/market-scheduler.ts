import { createClient } from '@/lib/supabase/server'
import cron from 'node-cron'

export class MarketScheduler {
  private supabase
  private isRunning: boolean = false
  
  constructor() {
    this.supabase = createClient()
  }

  async start() {
    if (this.isRunning) return
    this.isRunning = true

    // 1분마다 시장 업데이트
    cron.schedule('* * * * *', async () => {
      await this.updateMarket()
    })

    // 5분마다 뉴스/이벤트 생성
    cron.schedule('*/5 * * * *', async () => {
      await this.generateNewsAndEvents()
    })
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
        await this.updateCompanyPrice(company.id, newPrice)
      }
    } catch (error) {
      console.error('Market update error:', error)
    }
  }

  private async generateNewsAndEvents() {
    try {
      const events = [
        { type: 'economic_crisis', impact: -0.05, probability: 0.1 },
        { type: 'market_boom', impact: 0.05, probability: 0.1 },
        { type: 'regulation_change', impact: -0.02, probability: 0.2 },
        { type: 'innovation_announcement', impact: 0.03, probability: 0.2 },
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
    } catch (error) {
      console.error('News/Events generation error:', error)
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

  private async createMarketEvent(event: any) {
    const descriptions = {
      economic_crisis: [
        '글로벌 경제 위기 발생',
        '주요 경제국 금융 시장 충격',
      ],
      market_boom: [
        '시장 낙관론 확산',
        '글로벌 경기 회복 신호',
      ],
      // ... 더 많은 이벤트 설명 추가
    }

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
      // ... 더 많은 뉴스 템플릿 추가
    ]

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