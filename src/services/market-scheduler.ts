import { createAdminClient } from '@/lib/supabase/admin'
import { PortfolioTracker } from '@/services/portfolio-tracker'
import { OrderExecutor } from '@/services/order-executor'
import type { PostgrestResponse, PostgrestSingleResponse } from '@supabase/supabase-js'
import { getDbTimeXMinutesAgo } from '@/lib/timeUtils'
import { SupabaseClient } from '@supabase/supabase-js'

// ========================================
// 타입 정의
// ========================================

type Industry = '테크' | '반도체' | '바이오' | '엔터' | '에너지' | '금융' | '패션' | '푸드' | '로봇' | '건설' | '모빌리티' | '우주';
type MarketPhase = 'bull' | 'neutral' | 'bear';

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

interface NewsTemplate {
  title: string;
  content: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
  type: 'company';
  volatility?: number;
  company_id?: string;
  industry?: string;
  industries?: string[] | null;
}

interface MarketState {
  id: string;
  market_phase: MarketPhase;
  phase_started_at: string;
  phase_duration_minutes: number;
  sector_trends: Record<string, number>;
  sector_trends_updated_at: string;
  updated_at: string;
}

interface MarketEvent {
  id: string;
  title: string;
  description: string;
  effective_at: string;
  impact: number;
  event_type: string;
  affected_industries: string[];
  duration_minutes: number;
  is_active: boolean;
  sentiment: 'positive' | 'negative' | 'neutral';
}

interface PriceFactors {
  baseNoise: number;
  newsImpact: number;
  sectorTrend: number;
  marketCycle: number;
  momentum: number;
  leaderImpact: number;
  eventImpact: number;
}

interface Profile {
  id: string;
}

// ========================================
// 시뮬레이션 파라미터 (정규화된 가중치)
// ========================================

const SIMULATION_PARAMS = {
  NEWS: {
    CHANCE_PER_UPDATE: 0.08,                  // 매 업데이트 8% 확률로 뉴스 발생 (평균 ~12분에 1회)
    IMPACT_VARIATION: { MIN: 0.8, MAX: 1.2 },
    DECAY_MINUTES: 30,
  },
  PRICE: {
    BASE_VOLATILITY: 0.012,        // 기본 1.2% 변동성
    MAX_CHANGE_PER_UPDATE: 0.01,   // 업데이트당 최대 1% (현실적 수준)
    DAILY_PRESSURE_START: 0.18,    // 일중 18%부터 부드러운 압력 시작
    DAILY_PRESSURE_STRENGTH: 0.35, // 압력 강도 (부드러움)
    WEIGHTS: {                     // 합계 = 1.0 (정규화됨)
      BASE_NOISE: 0.15,
      NEWS: 0.25,
      SECTOR_TREND: 0.15,
      MARKET_CYCLE: 0.15,
      MOMENTUM: 0.10,
      LEADER: 0.10,
      EVENT: 0.10,
    },
  },
  INDUSTRY_VOLATILITY: {
    '우주': 1.6,      // 최고 변동성 (미래 산업, 불확실성 큼)
    '바이오': 1.5,     // 임상 결과에 따라 급등락
    '반도체': 1.4,     // 사이클 산업
    '테크': 1.35,      // 성장주 변동성
    '로봇': 1.3,       // 신기술 기대감
    '엔터': 1.25,      // 흥행 여부에 따라 변동
    '모빌리티': 1.2,   // 전기차/자율주행 기대
    '에너지': 1.15,    // 정책·원자재 영향
    '패션': 1.1,       // 트렌드 민감
    '건설': 1.05,      // 안정적 산업
    '푸드': 1.0,       // 가장 안정적
    '금융': 0.95,      // 최저 변동성 (규제 산업)
  } as Record<string, number>,
  MARKET_CAP_VOLATILITY: [
    { threshold: 200_000_000_000, multiplier: 0.7 },   // 2000억+ 대기업
    { threshold: 70_000_000_000, multiplier: 1.0 },     // 700억+ 중견기업
    { threshold: 30_000_000_000, multiplier: 1.2 },     // 300억+ 중소기업
    { threshold: 20_000_000_000, multiplier: 1.4 },     // 200억+ 강소기업
    { threshold: 0, multiplier: 1.6 },                  // 스타트업
  ],
  TIME_VOLATILITY: [
    { start: 9, end: 10, multiplier: 1.2 },    // 오전 개장 러시
    { start: 10, end: 12, multiplier: 1.1 },   // 오전
    { start: 12, end: 14, multiplier: 0.8 },   // 점심
    { start: 14, end: 18, multiplier: 1.0 },   // 오후
    { start: 18, end: 21, multiplier: 1.05 },  // 저녁
    { start: 21, end: 24, multiplier: 1.15 },  // 마감 러시
  ],
  MOMENTUM: {
    MAX_CONSECUTIVE_BEFORE_REVERSAL: 12,  // 12연속 이상 강제 반전 (기존 7)
    REVERSAL_BASE_CHANCE: 0.05,           // 기본 반전 확률 5% (기존 10%)
    REVERSAL_INCREMENT: 0.06,             // 연속횟수당 6% 증가 (기존 12%)
  },
  SECTOR_TREND: {
    ROTATION_INTERVAL_MINUTES: 90,        // 90분마다 섹터 트렌드 변경 (기존 240분)
    MAX_STRENGTH: 0.04,                   // 섹터 트렌드 최대 ±4% (기존 5%)
  },
  BLACK_SWAN: {
    CHANCE_PER_UPDATE: 0.0015,            // 업데이트당 0.15% 확률 (하루 종목당 ~1.35회)
    MIN_MAGNITUDE: 0.02,                  // 최소 ±2%
    MAX_MAGNITUDE: 0.05,                  // 최대 ±5%
  },
  MARKET_CYCLE: {
    PHASE_MIN_MINUTES: 480,               // 최소 8시간 지속
    PHASE_MAX_MINUTES: 2880,              // 최대 48시간 지속
    BULL_BIAS: 0.015,                     // 호황시 +1.5% 편향
    BEAR_BIAS: -0.015,                    // 침체시 -1.5% 편향
    NEUTRAL_BIAS: 0,
  },
  MARKET_EVENT: {
    CHANCE_PER_UPDATE: 0.015,             // 매 업데이트 1.5% 확률로 이벤트 발생
    MAX_ACTIVE_EVENTS: 3,                 // 동시 활성 이벤트 최대 3개
  },
};

// ========================================
// 마켓 이벤트 템플릿
// ========================================

const MARKET_EVENT_TEMPLATES: Array<{
  title: string;
  description: string;
  sentiment: 'positive' | 'negative' | 'neutral';
  impact: number;
  affected_industries: Industry[];
  duration_minutes: number;
}> = [
  // 긍정적 이벤트
  { title: '중앙은행 기준금리 인하', description: '중앙은행이 경기 부양을 위해 기준금리를 인하했습니다.', sentiment: 'positive', impact: 0.8, affected_industries: [], duration_minutes: 120 },
  { title: '정부 경기 부양책 발표', description: '정부가 대규모 경기 부양 정책을 발표했습니다.', sentiment: 'positive', impact: 0.7, affected_industries: ['건설', '테크'], duration_minutes: 180 },
  { title: '반도체 슈퍼사이클 진입', description: 'AI 수요 폭증으로 반도체 슈퍼사이클에 진입했다는 분석입니다.', sentiment: 'positive', impact: 0.8, affected_industries: ['반도체', '테크'], duration_minutes: 150 },
  { title: '글로벌 AI 투자 러시', description: '전 세계적으로 AI 관련 투자가 급증하고 있습니다.', sentiment: 'positive', impact: 0.6, affected_industries: ['테크', '반도체', '로봇'], duration_minutes: 150 },
  { title: '소비자 신뢰지수 상승', description: '소비자 신뢰지수가 예상을 크게 웃돌았습니다.', sentiment: 'positive', impact: 0.4, affected_industries: ['푸드', '패션', '엔터'], duration_minutes: 90 },
  { title: '외국인 투자자 순매수 확대', description: '외국인 투자자들이 대규모 순매수에 나섰습니다.', sentiment: 'positive', impact: 0.6, affected_industries: [], duration_minutes: 120 },
  { title: '우주산업 육성법 통과', description: '우주산업 육성을 위한 특별법이 국회를 통과했습니다.', sentiment: 'positive', impact: 0.7, affected_industries: ['우주', '모빌리티'], duration_minutes: 150 },
  { title: '친환경 에너지 대규모 투자', description: '정부와 민간이 친환경 에너지에 대규모 투자를 발표했습니다.', sentiment: 'positive', impact: 0.6, affected_industries: ['에너지', '건설'], duration_minutes: 120 },

  // 부정적 이벤트
  { title: '중앙은행 기준금리 인상', description: '인플레이션 억제를 위해 기준금리가 인상되었습니다.', sentiment: 'negative', impact: 0.8, affected_industries: [], duration_minutes: 120 },
  { title: '글로벌 경기 침체 우려', description: '주요국 경제 지표 악화로 경기 침체가 우려됩니다.', sentiment: 'negative', impact: 0.7, affected_industries: [], duration_minutes: 180 },
  { title: '무역 분쟁 격화', description: '주요 교역국 간 무역 분쟁이 심화되고 있습니다.', sentiment: 'negative', impact: 0.6, affected_industries: ['반도체', '모빌리티'], duration_minutes: 150 },
  { title: '국제 원자재 가격 급등', description: '국제 원자재 가격이 급등하여 생산 비용 증가가 우려됩니다.', sentiment: 'negative', impact: 0.5, affected_industries: ['건설', '푸드', '에너지'], duration_minutes: 120 },
  { title: '소비 심리 위축', description: '소비자 심리가 크게 위축되어 내수 시장이 침체되고 있습니다.', sentiment: 'negative', impact: 0.4, affected_industries: ['푸드', '패션', '엔터'], duration_minutes: 90 },
  { title: '외국인 투자자 대규모 매도', description: '외국인 투자자들이 대규모 매도에 나서 시장이 흔들리고 있습니다.', sentiment: 'negative', impact: 0.6, affected_industries: [], duration_minutes: 120 },
  { title: 'AI 규제 강화 움직임', description: '각국 정부가 AI 기술에 대한 규제를 대폭 강화할 움직임입니다.', sentiment: 'negative', impact: 0.5, affected_industries: ['테크', '로봇', '반도체'], duration_minutes: 120 },
  { title: '글로벌 공급망 혼란', description: '주요 물류 거점에서 공급망 혼란이 발생했습니다.', sentiment: 'negative', impact: 0.5, affected_industries: ['반도체', '모빌리티', '패션'], duration_minutes: 120 },

  // 중립적 이벤트
  { title: '대규모 규제 개편 예고', description: '정부가 산업 전반에 걸친 규제 개편을 예고했습니다.', sentiment: 'neutral', impact: 0.3, affected_industries: [], duration_minutes: 120 },
  { title: '주요 경제 지표 발표 대기', description: '이번 주 주요 경제 지표 발표가 예정되어 시장이 관망세입니다.', sentiment: 'neutral', impact: 0.2, affected_industries: [], duration_minutes: 60 },
  { title: '금융 규제 샌드박스 확대', description: '핀테크 혁신을 위한 규제 샌드박스가 확대됩니다.', sentiment: 'neutral', impact: 0.3, affected_industries: ['금융', '테크'], duration_minutes: 90 },
  { title: '로봇세 도입 논의', description: '로봇 활용에 대한 세금 부과가 논의되고 있습니다.', sentiment: 'neutral', impact: 0.3, affected_industries: ['로봇', '테크'], duration_minutes: 90 },
];

// ========================================
// 섹터 트렌드 사유 (UI 표시용)
// ========================================

const GENERIC_SECTOR_REASONS = ['시장 변동', '수요 변화', '공급 변화', '계절성 요인', '글로벌 이슈'];

const SECTOR_TREND_REASONS: Record<string, string[]> = {
  '테크': ['AI 투자 열풍', '클라우드 수요 급증', 'SaaS 성장 가속', '디지털 전환 확산', '빅테크 규제 논의'],
  '반도체': ['AI 칩 수요 폭발', '파운드리 수주 확대', '메모리 가격 반등', '공급 과잉 우려', '차세대 공정 경쟁'],
  '바이오': ['신약 승인 기대', '유전자 치료 돌파구', '임상 실패 우려', '글로벌 제약사 M&A', '디지털 헬스케어 성장'],
  '엔터': ['대작 게임 흥행', '콘텐츠 투자 확대', 'K-콘텐츠 글로벌 인기', '구독자 이탈 우려', '메타버스 콘텐츠 기대'],
  '에너지': ['신재생 에너지 정책', '배터리 기술 돌파', '유가 변동 영향', '탄소중립 투자 확대', '에너지 보조금 변동'],
  '금융': ['금리 인하 기대', '핀테크 혁신 가속', '가계 부채 우려', '디지털 뱅킹 성장', '규제 환경 변화'],
  '패션': ['럭셔리 소비 회복', '지속가능 패션 트렌드', '시즌 판매 호조', '소비 심리 위축', '온라인 패션 성장'],
  '푸드': ['건강식품 트렌드', '외식 경기 회복', '식자재 가격 변동', '푸드테크 투자 확대', '글로벌 프랜차이즈 확장'],
  '로봇': ['자동화 수요 급증', 'AI 로봇 기술 발전', '인건비 상승 효과', '로봇 윤리 논의', '서비스 로봇 시장 확대'],
  '건설': ['부동산 시장 회복', '인프라 투자 확대', '건설 원가 상승', '스마트시티 프로젝트', '해외 건설 수주 증가'],
  '모빌리티': ['자율주행 기술 진전', '전기차 보급 확대', 'UAM 시대 개막', '충전 인프라 투자', '물류 자동화 가속'],
  '우주': ['민간 우주 시대 개막', '위성 인터넷 사업 확대', '우주 관광 기대', '로켓 기술 혁신', '국가 우주 예산 확대'],
};

const ALL_INDUSTRIES: Industry[] = ['테크', '반도체', '바이오', '엔터', '에너지', '금융', '패션', '푸드', '로봇', '건설', '모빌리티', '우주'];

// ========================================
// MarketScheduler 클래스
// ========================================

export class MarketScheduler {
  private static instance: MarketScheduler | null = null;
  private supabase!: SupabaseClient;
  private readonly MARKET_OPEN_HOUR = 9;
  private readonly MARKET_CLOSE_HOUR = 24;
  private newsTemplateCache: Map<string, NewsTemplate[]> = new Map();
  private priceMovementCache: Map<string, {
    direction: 'up' | 'down' | 'neutral';
    consecutiveCount: number;
    lastChange: number;
  }> = new Map();

  // ─── 싱글톤 & 초기화 ──────────────────────────

  static async getInstance(): Promise<MarketScheduler> {
    if (!MarketScheduler.instance) {
      const instance = new MarketScheduler();
      await instance.initialize();
      MarketScheduler.instance = instance; // 초기화 성공 후에만 캐시
    }
    return MarketScheduler.instance;
  }

  public isMarketOpen(): boolean {
    const now = new Date();
    const koreaHour = (now.getUTCHours() + 9) % 24;
    return koreaHour >= this.MARKET_OPEN_HOUR && koreaHour < this.MARKET_CLOSE_HOUR;
  }

  private async initialize() {
    if (!this.supabase) {
      this.supabase = createAdminClient();
    }
    await this.loadNewsTemplates();
  }

  private async ensureConnection() {
    if (!this.supabase) {
      await this.initialize();
    }
    return this.supabase;
  }

  // ─── 시장 상태 관리 ──────────────────────────

  private async loadMarketState(): Promise<MarketState> {
    const { data, error } = await this.supabase
      .from('market_state')
      .select('*')
      .limit(1)
      .single();

    if (error || !data) {
      console.warn('시장 상태 로드 실패, 기본값 사용:', error?.message);
      return {
        id: '',
        market_phase: 'neutral',
        phase_started_at: new Date().toISOString(),
        phase_duration_minutes: 480,
        sector_trends: { 'IT': 0, '전자': 0, '제조': 0, '건설': 0, '식품': 0 },
        sector_trends_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    return data as MarketState;
  }

  private async saveMarketState(state: MarketState): Promise<void> {
    if (!state.id) return;
    await this.retryOperation(async () => {
      return await this.supabase
        .from('market_state')
        .update({
          market_phase: state.market_phase,
          phase_started_at: state.phase_started_at,
          phase_duration_minutes: state.phase_duration_minutes,
          sector_trends: state.sector_trends,
          sector_trends_updated_at: state.sector_trends_updated_at,
          updated_at: new Date().toISOString(),
        })
        .eq('id', state.id);
    });
  }

  /**
   * 섹터 트렌드 회전: 일정 시간 경과 후 각 산업의 강세/약세 방향을 변경
   * 이전 트렌드에서 점진적으로 이동하여 급격한 변화를 방지
   */
  private async maybeRotateSectorTrends(state: MarketState): Promise<MarketState> {
    const now = Date.now();
    const lastUpdate = new Date(state.sector_trends_updated_at).getTime();
    const elapsedMinutes = (now - lastUpdate) / (60 * 1000);

    // ±30분 랜덤 지터로 정확한 교체 시점 예측 불가능하게
    const jitter = (Math.random() - 0.5) * 60;
    const effectiveInterval = SIMULATION_PARAMS.SECTOR_TREND.ROTATION_INTERVAL_MINUTES + jitter;

    if (elapsedMinutes < effectiveInterval) {
      return state;
    }

    // 현재 시즌 테마 산업만 트렌드 회전
    const { data: activeSeason } = await this.supabase
      .from('seasons')
      .select('theme_id')
      .eq('status', 'active')
      .single();

    let industries: string[] = ALL_INDUSTRIES as string[];
    if (activeSeason?.theme_id) {
      const { data: themeCompanies } = await this.supabase
        .from('companies')
        .select('industry')
        .eq('theme_id', activeSeason.theme_id);
      industries = themeCompanies?.length
        ? [...new Set(themeCompanies.map((c) => c.industry as string))]
        : industries;
    }

    console.log('섹터 트렌드 회전 실행');
    const newTrends: Record<string, number> = {};

    for (const industry of industries) {
      const previousStrength = state.sector_trends[industry] || 0;
      // 새로운 목표 강도 (-1.0 ~ 1.0)
      const targetStrength = (Math.random() - 0.5) * 2;
      // 이전 값에서 목표로 50% 이동 (더 점진적 변화, 신호 읽기 어렵게)
      newTrends[industry] = previousStrength * 0.5 + targetStrength * 0.5;
      newTrends[industry] = Math.max(-1.0, Math.min(1.0, newTrends[industry]));

      const trend = newTrends[industry];
      const direction = trend > 0.3 ? '강세' : trend < -0.3 ? '약세' : '보합';
      const reasons = SECTOR_TREND_REASONS[industry] || GENERIC_SECTOR_REASONS;
      const reason = reasons[Math.floor(Math.random() * reasons.length)];
      console.log(`  ${industry}: ${direction} (${(trend * 100).toFixed(1)}%) - ${reason}`);
    }

    return {
      ...state,
      sector_trends: newTrends,
      sector_trends_updated_at: new Date().toISOString(),
    };
  }

  /**
   * 시장 사이클 전환: 호황/보합/침체 3단계를 자연스럽게 전환
   * 호황/침체에서는 60% 확률로 보합으로 복귀, 보합에서는 아무 단계로든 이동
   */
  private async maybeTransitionMarketPhase(state: MarketState): Promise<MarketState> {
    const now = Date.now();
    const phaseStart = new Date(state.phase_started_at).getTime();
    const elapsedMinutes = (now - phaseStart) / (60 * 1000);

    if (elapsedMinutes < state.phase_duration_minutes) {
      return state;
    }

    const phases: MarketPhase[] = ['bull', 'neutral', 'bear'];
    let newPhase: MarketPhase;

    if (state.market_phase === 'neutral') {
      // 보합에서는 어디든 갈 수 있음
      newPhase = phases[Math.floor(Math.random() * phases.length)];
    } else {
      // 호황/침체에서는 60% 확률로 보합 복귀, 40% 유지
      newPhase = Math.random() < 0.6 ? 'neutral' : state.market_phase;
    }

    const { PHASE_MIN_MINUTES, PHASE_MAX_MINUTES } = SIMULATION_PARAMS.MARKET_CYCLE;
    const newDuration = PHASE_MIN_MINUTES +
      Math.floor(Math.random() * (PHASE_MAX_MINUTES - PHASE_MIN_MINUTES));

    const phaseLabel = newPhase === 'bull' ? '호황' : newPhase === 'bear' ? '침체' : '보합';
    console.log(`시장 사이클 전환: ${state.market_phase} → ${newPhase} (${phaseLabel}, ${Math.round(newDuration / 60)}시간 지속 예정)`);

    return {
      ...state,
      market_phase: newPhase,
      phase_started_at: new Date().toISOString(),
      phase_duration_minutes: newDuration,
    };
  }

  /**
   * 마켓 이벤트 자동 생성: 매 업데이트마다 일정 확률로 시장 전체 이벤트 발생
   */
  private async maybeGenerateMarketEvent(): Promise<void> {
    if (Math.random() > SIMULATION_PARAMS.MARKET_EVENT.CHANCE_PER_UPDATE) {
      return;
    }

    // 활성 이벤트 수 확인
    const { data: activeEvents } = await this.supabase
      .from('market_events')
      .select('id')
      .eq('is_active', true);

    if ((activeEvents?.length || 0) >= SIMULATION_PARAMS.MARKET_EVENT.MAX_ACTIVE_EVENTS) {
      return;
    }

    // 현재 시즌 테마 산업 조회
    const { data: activeSeason } = await this.supabase
      .from('seasons')
      .select('theme_id')
      .eq('status', 'active')
      .single();

    let themeIndustrySet = new Set<string>();
    if (activeSeason?.theme_id) {
      const { data: themeCompanies } = await this.supabase
        .from('companies')
        .select('industry')
        .eq('theme_id', activeSeason.theme_id);
      themeIndustrySet = new Set(
        (themeCompanies ?? []).map((c) => c.industry as string)
      );
    }

    // 시즌에 맞는 이벤트 템플릿만 선택 (affected_industries 빈 배열이거나 테마 산업과 겹치는 것)
    const eligibleTemplates = MARKET_EVENT_TEMPLATES.filter((t) => {
      if (t.affected_industries.length === 0) return true;
      if (themeIndustrySet.size === 0) return true;
      return t.affected_industries.some((ind) => themeIndustrySet.has(ind));
    });

    if (eligibleTemplates.length === 0) return;

    const template = eligibleTemplates[
      Math.floor(Math.random() * eligibleTemplates.length)
    ];
    const impactVariation = 0.8 + Math.random() * 0.4; // ±20% 변동

    await this.retryOperation(async () => {
      return await this.supabase.from('market_events').insert({
        title: template.title,
        description: template.description,
        effective_at: new Date().toISOString(),
        impact: template.impact * impactVariation,
        event_type: 'auto',
        affected_industries: template.affected_industries,
        duration_minutes: template.duration_minutes,
        is_active: true,
        sentiment: template.sentiment,
      });
    });

    console.log(`🔔 마켓 이벤트 발생: ${template.title} (${template.sentiment}, 영향력: ${(template.impact * impactVariation).toFixed(2)})`);
  }

  /**
   * 활성 마켓 이벤트 조회 및 만료 이벤트 비활성화
   */
  private async getActiveMarketEvents(): Promise<MarketEvent[]> {
    const { data } = await this.supabase
      .from('market_events')
      .select('*')
      .eq('is_active', true);

    if (!data) return [];

    const now = Date.now();
    const activeEvents: MarketEvent[] = [];

    for (const event of data) {
      const elapsed = (now - new Date(event.effective_at).getTime()) / (60 * 1000);
      if (elapsed > event.duration_minutes) {
        // 만료된 이벤트 비활성화
        await this.supabase
          .from('market_events')
          .update({ is_active: false })
          .eq('id', event.id);
      } else {
        activeEvents.push(event as MarketEvent);
      }
    }

    return activeEvents;
  }

  // ─── 핵심 마켓 업데이트 ──────────────────────────

  public async updateMarket() {
    console.log('마켓 업데이트 요청 받음:', new Date().toISOString());

    if (!this.isMarketOpen()) {
      console.log('장 마감 상태입니다. 마켓 업데이트를 건너뜁니다.');
      return;
    }

    try {
      // 1. 시장 상태 관리 (섹터 트렌드 회전, 시장 사이클 전환, 이벤트/뉴스 생성)
      let marketState = await this.loadMarketState();
      marketState = await this.maybeRotateSectorTrends(marketState);
      marketState = await this.maybeTransitionMarketPhase(marketState);
      await this.saveMarketState(marketState);
      await this.maybeGenerateMarketEvent();
      await this.maybeGenerateNews(marketState);

      // 2. 데이터 일괄 조회 (현재 시즌 테마 기업만, N+1 쿼리 제거)
      const { data: activeSeason } = await this.supabase
        .from('seasons')
        .select('theme_id')
        .eq('status', 'active')
        .single();

      const themeId = activeSeason?.theme_id ?? null;
      let companiesQuery = this.supabase.from('companies').select('*');
      if (themeId) {
        companiesQuery = companiesQuery.eq('theme_id', themeId);
      }

      const [companiesResult, recentNewsResult, activeEvents] = await Promise.all([
        companiesQuery,
        this.supabase
          .from('news')
          .select('*')
          .gte('published_at', getDbTimeXMinutesAgo(30))
          .is('applied', false),
        this.getActiveMarketEvents(),
      ]);

      const companies = companiesResult.data as Company[] | null;
      const recentNews = (recentNewsResult.data || []) as NewsRecord[];

      if (!companies || companies.length === 0) {
        console.log('회사 데이터가 없습니다.');
        return;
      }

      // 3. 각 회사별 새 가격 계산 (DB 쿼리 없이 순수 계산)
      const updates = companies.map((company) => {
        if (company.is_delisted) return null;

        const companyNews = recentNews.filter(
          (n) => n.company_id === company.id && n.type === 'company'
        );

        const { newPrice, reason } = this.calculateNewPrice(
          company, companies, companyNews, marketState, activeEvents
        );

        const priceChange = (newPrice - company.current_price) / company.current_price;
        const newMarketCap = Math.round(newPrice * company.shares_issued);

        // 모멘텀 캐시 업데이트 (단순 기록만, 반전 로직 없음)
        this.updatePriceMovement(company.id, priceChange);

        return {
          id: crypto.randomUUID(),
          company_id: company.id,
          old_price: Number(company.current_price.toFixed(4)),
          new_price: Number(newPrice.toFixed(4)),
          change_percentage: Number((priceChange * 100).toFixed(4)),
          update_reason: reason,
          created_at: new Date().toISOString(),
          old_market_cap: company.market_cap,
          new_market_cap: newMarketCap,
        };
      });

      // 4. DB 업데이트
      await Promise.all(
        updates.filter(Boolean).map(async (update) => {
          await this.retryOperation(async () => {
            return await this.supabase.from('price_updates').insert(update!);
          });
          await this.retryOperation(async () => {
            return await this.supabase
              .from('companies')
              .update({
                previous_price: update!.old_price,
                current_price: update!.new_price,
                market_cap: update!.new_market_cap,
              })
              .eq('id', update!.company_id);
          });
        })
      );

      // 5. 만료된 뉴스 applied 처리
      const expiredNewsIds = recentNews
        .filter((n) => {
          const elapsed = (Date.now() - new Date(n.published_at).getTime()) / (60 * 1000);
          return elapsed > SIMULATION_PARAMS.NEWS.DECAY_MINUTES;
        })
        .map((n) => n.id);

      if (expiredNewsIds.length > 0) {
        await this.supabase
          .from('news')
          .update({ applied: true })
          .in('id', expiredNewsIds);
      }

      console.log('시장 업데이트 완료');

      // 6. 조건 주문 (예약 매수/매도) 체결 처리
      try {
        const updatedCompanies = updates.filter(Boolean).map((u) => ({
          id: u!.company_id,
          current_price: u!.new_price,
        }));
        const orderExecutor = new OrderExecutor();
        await orderExecutor.processOrders(updatedCompanies);
        console.log('조건 주문 처리 완료');
      } catch (orderError) {
        console.error('조건 주문 처리 중 오류 (무시):', orderError);
      }

      // 7. 포트폴리오 성과 기록
      const { data: users } = await this.supabase.from('profiles').select('id');
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

  // ─── 가격 계산 (핵심 알고리즘) ──────────────────────────

  /**
   * 새 주가 계산: 7개 독립 요소의 가중 합산 → 변동성 스케일링 → 클램핑
   *
   * 수식: newPrice = currentPrice * (1 + Σ(factor_i * weight_i) * industryVol * capVol * timeVol)
   *
   * 설계 원칙:
   * - 각 요소는 독립적으로 계산 (랜덤 체인 없음)
   * - 가중치 합 = 1.0 (정규화)
   * - 변동성 multiplier는 최종 단계에서 1회만 적용
   */
  private calculateNewPrice(
    company: Company,
    allCompanies: Company[],
    companyNews: NewsRecord[],
    marketState: MarketState,
    activeEvents: MarketEvent[]
  ): { newPrice: number; factors: PriceFactors; reason: string } {
    if (company.is_delisted) {
      const zeroFactors: PriceFactors = {
        baseNoise: 0, newsImpact: 0, sectorTrend: 0,
        marketCycle: 0, momentum: 0, leaderImpact: 0, eventImpact: 0,
      };
      return { newPrice: 0, factors: zeroFactors, reason: '상장폐지' };
    }

    const WEIGHTS = SIMULATION_PARAMS.PRICE.WEIGHTS;

    // 각 요소 독립 계산
    const factors: PriceFactors = {
      baseNoise: this.calculateBaseNoise(),
      newsImpact: this.calculateNewsImpact(companyNews),
      sectorTrend: this.calculateSectorTrendImpact(company.industry, marketState.sector_trends),
      marketCycle: this.calculateMarketCycleImpact(marketState.market_phase),
      momentum: this.calculateMomentum(company.id),
      leaderImpact: this.calculateLeaderImpact(company, allCompanies),
      eventImpact: this.calculateEventImpact(company, activeEvents),
    };

    // 가중 합산
    const weightedChange =
      factors.baseNoise * WEIGHTS.BASE_NOISE +
      factors.newsImpact * WEIGHTS.NEWS +
      factors.sectorTrend * WEIGHTS.SECTOR_TREND +
      factors.marketCycle * WEIGHTS.MARKET_CYCLE +
      factors.momentum * WEIGHTS.MOMENTUM +
      factors.leaderImpact * WEIGHTS.LEADER +
      factors.eventImpact * WEIGHTS.EVENT;

    // 변동성 스케일링 (산업 × 시가총액 × 시간대)
    const koreaHour = (new Date().getUTCHours() + 9) % 24;
    const industryVol = this.getIndustryVolatility(company.industry);
    const capVol = this.getMarketCapVolatility(company.market_cap);
    const timeVol = this.getTimeVolatility(koreaHour);

    const scaledChange = weightedChange * industryVol * capVol * timeVol;

    // 업데이트당 최대 변동폭 제한
    const maxChange = SIMULATION_PARAMS.PRICE.MAX_CHANGE_PER_UPDATE * industryVol;
    let clampedChange = Math.max(Math.min(scaledChange, maxChange), -maxChange);

    // 블랙스완 이벤트: 극히 드물게 캡을 무시하는 극단 변동
    const { CHANCE_PER_UPDATE, MIN_MAGNITUDE, MAX_MAGNITUDE } = SIMULATION_PARAMS.BLACK_SWAN;
    if (Math.random() < CHANCE_PER_UPDATE) {
      const magnitude = MIN_MAGNITUDE + Math.random() * (MAX_MAGNITUDE - MIN_MAGNITUDE);
      const direction = Math.random() < 0.5 ? 1 : -1;
      clampedChange = direction * magnitude; // 캡 무시, 블랙스완이 변동 전체를 대체
      console.log(`⚡ 블랙스완! ${company.name}: ${(direction * magnitude * 100).toFixed(1)}%`);
    }

    // 일중 변동폭 부드러운 압력 (18%부터 시작, 0.35 강도)
    if (company.last_closing_price > 0) {
      const projectedPrice = company.current_price * (1 + clampedChange);
      const projectedDailyChange =
        (projectedPrice - company.last_closing_price) / company.last_closing_price;
      const pressureStart = SIMULATION_PARAMS.PRICE.DAILY_PRESSURE_START;
      const pressureStrength = SIMULATION_PARAMS.PRICE.DAILY_PRESSURE_STRENGTH;

      if (Math.abs(projectedDailyChange) > pressureStart) {
        const pressure = (Math.abs(projectedDailyChange) - pressureStart) * pressureStrength;
        clampedChange -= Math.sign(projectedDailyChange) * pressure;
      }
    }

    const newPrice = company.current_price * (1 + clampedChange);

    // 가격 0 이하 방지 → 상장폐지
    if (newPrice <= 0) {
      this.supabase
        .from('companies')
        .update({ is_delisted: true, current_price: 0 })
        .eq('id', company.id);
      return { newPrice: 0, factors, reason: '상장폐지 - 주가 0원 도달' };
    }

    const reason = this.generateUpdateReason(factors);
    return { newPrice, factors, reason };
  }

  // ─── 요소별 계산 메서드 ──────────────────────────

  /** 기본 랜덤 노이즈 (가우시안 분포, 1회만 사용) */
  private calculateBaseNoise(): number {
    const noise = this.randomGaussian(0, SIMULATION_PARAMS.PRICE.BASE_VOLATILITY);
    return Math.max(Math.min(noise, 0.05), -0.05);
  }

  /**
   * 뉴스 영향력 계산
   * - 시간 감쇠 (지수 감쇠)
   * - 감정에 따른 방향 결정
   * - 다수 뉴스일 때 루트 스케일링으로 자연스러운 감쇠
   */
  private calculateNewsImpact(companyNews: NewsRecord[]): number {
    if (companyNews.length === 0) return 0;

    const now = Date.now();
    let totalImpact = 0;

    for (const news of companyNews) {
      const timeElapsedMinutes = (now - new Date(news.published_at).getTime()) / (60 * 1000);
      const decayDuration = SIMULATION_PARAMS.NEWS.DECAY_MINUTES;

      if (timeElapsedMinutes > decayDuration) continue;

      // 지수 감쇠
      const decayFactor = Math.exp(-timeElapsedMinutes / (decayDuration * 0.5));

      // 임팩트 변동 (±20%)
      const { MIN, MAX } = SIMULATION_PARAMS.NEWS.IMPACT_VARIATION;
      const impactVariation = MIN + Math.random() * (MAX - MIN);

      let impact = news.impact * impactVariation * decayFactor;

      // 감정에 따른 방향 및 크기
      switch (news.sentiment) {
        case 'positive':
          impact = Math.abs(impact) * 0.05;   // 최대 ~5% 상승 (기존 4%)
          break;
        case 'negative':
          impact = -Math.abs(impact) * 0.06;  // 최대 ~6% 하락 (기존 5%)
          break;
        default: // neutral
          impact = impact * 0.01 * (Math.random() - 0.5);
          break;
      }

      totalImpact += impact;
    }

    // 뉴스 다수일 때 루트 스케일링
    const dampener = companyNews.length > 1 ? 1 / Math.sqrt(companyNews.length) : 1;
    return Math.max(Math.min(totalImpact * dampener, 0.05), -0.05); // 클램프 ±5% (기존 ±6%)
  }

  /** 섹터 트렌드 영향: 현재 산업의 강세/약세 방향을 가격에 반영 */
  private calculateSectorTrendImpact(
    industry: Industry,
    sectorTrends: Record<string, number>
  ): number {
    const trendStrength = sectorTrends[industry] || 0;
    return trendStrength * SIMULATION_PARAMS.SECTOR_TREND.MAX_STRENGTH;
  }

  /** 시장 사이클 영향: 호황/침체/보합에 따른 전체적 편향 */
  private calculateMarketCycleImpact(phase: MarketPhase): number {
    const { BULL_BIAS, BEAR_BIAS, NEUTRAL_BIAS } = SIMULATION_PARAMS.MARKET_CYCLE;
    const baseBias =
      phase === 'bull' ? BULL_BIAS :
      phase === 'bear' ? BEAR_BIAS :
      NEUTRAL_BIAS;
    // ±30% 변동 추가
    return baseBias * (0.7 + Math.random() * 0.6);
  }

  /**
   * 모멘텀 계산 (단순화)
   * - 연속 상승/하락 횟수에 따라 선형으로 반전 확률 증가
   * - 7연속 이상이면 강제 반전
   * - 이중 반전 로직 없음 (updatePriceMovement에서 추가 반전하지 않음)
   */
  private calculateMomentum(companyId: string): number {
    const movement = this.priceMovementCache.get(companyId);
    if (!movement || movement.consecutiveCount <= 1) return 0;

    const { consecutiveCount, direction } = movement;
    const {
      MAX_CONSECUTIVE_BEFORE_REVERSAL,
      REVERSAL_BASE_CHANCE,
      REVERSAL_INCREMENT,
    } = SIMULATION_PARAMS.MOMENTUM;

    // 반전 확률: 연속 횟수에 비례하여 선형 증가 (최대 85%)
    const reversalChance = Math.min(
      REVERSAL_BASE_CHANCE + (consecutiveCount - 1) * REVERSAL_INCREMENT,
      0.85
    );

    // 강제 반전 또는 확률적 반전
    const shouldReverse =
      consecutiveCount >= MAX_CONSECUTIVE_BEFORE_REVERSAL ||
      Math.random() < reversalChance;

    // 모멘텀 강도 (연속 횟수에 비례, 상한 있음)
    const strength = Math.min(consecutiveCount * 0.006, 0.03);

    if (shouldReverse) {
      return direction === 'up' ? -strength : strength;
    } else {
      // 추세 유지 시 약한 힘
      return direction === 'up' ? strength * 0.4 : -strength * 0.4;
    }
  }

  /** 산업 리더 영향: 동일 산업 상위 3사의 최근 가격 변동 평균 */
  private calculateLeaderImpact(company: Company, allCompanies: Company[]): number {
    const leaders = allCompanies
      .filter((c) => c.industry === company.industry && c.id !== company.id && !c.is_delisted)
      .sort((a, b) => b.market_cap - a.market_cap)
      .slice(0, 3);

    if (leaders.length === 0) return 0;

    const averageChange = leaders.reduce((sum, leader) => {
      if (leader.previous_price <= 0) return sum;
      const change = (leader.current_price - leader.previous_price) / leader.previous_price;
      return sum + change / leaders.length;
    }, 0);

    return Math.max(Math.min(averageChange * 0.5, 0.03), -0.03);
  }

  /**
   * 마켓 이벤트 영향: 활성 이벤트의 영향력을 시간 감쇠와 산업 타겟팅으로 계산
   * - 대상 산업이면 1.5배, 비대상이면 0.4배
   * - 전체 대상(빈 배열)이면 1.0배
   */
  private calculateEventImpact(company: Company, activeEvents: MarketEvent[]): number {
    if (activeEvents.length === 0) return 0;

    const now = Date.now();
    let totalImpact = 0;

    for (const event of activeEvents) {
      const timeElapsed = (now - new Date(event.effective_at).getTime()) / (60 * 1000);
      if (timeElapsed > event.duration_minutes) continue;

      // 시간 감쇠
      const decayFactor = Math.exp(-timeElapsed / (event.duration_minutes * 0.5));
      let impact = event.impact * decayFactor * 0.03; // 기본 스케일 3%

      // 감정에 따른 방향
      if (event.sentiment === 'negative') impact = -Math.abs(impact);
      else if (event.sentiment === 'positive') impact = Math.abs(impact);
      else impact *= (Math.random() - 0.5) * 2;

      // 산업 타겟팅
      if (event.affected_industries.length > 0) {
        if (event.affected_industries.includes(company.industry)) {
          impact *= 1.5; // 대상 산업 50% 강화
        } else {
          impact *= 0.4; // 비대상 산업 60% 약화
        }
      }

      totalImpact += impact;
    }

    return Math.max(Math.min(totalImpact, 0.06), -0.06); // 클램프 ±6% (기존 ±5%)
  }

  // ─── 변동성 계산 헬퍼 ──────────────────────────

  private getIndustryVolatility(industry: string): number {
    return SIMULATION_PARAMS.INDUSTRY_VOLATILITY[industry] || 1.0;
  }

  private getMarketCapVolatility(marketCap: number): number {
    for (const tier of SIMULATION_PARAMS.MARKET_CAP_VOLATILITY) {
      if (marketCap >= tier.threshold) {
        return tier.multiplier;
      }
    }
    return 1.0;
  }

  private getTimeVolatility(koreaHour: number): number {
    for (const slot of SIMULATION_PARAMS.TIME_VOLATILITY) {
      if (koreaHour >= slot.start && koreaHour < slot.end) {
        return slot.multiplier;
      }
    }
    return 1.0;
  }

  // ─── 유틸리티 ──────────────────────────

  private randomGaussian(mean: number, stdDev: number): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    const num = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return num * stdDev + mean;
  }

  /**
   * 가격 변동 방향 기록 (단순화)
   * - 방향과 연속 횟수만 기록
   * - 반전 로직 없음 (calculateMomentum에서만 반전 판단)
   */
  private updatePriceMovement(companyId: string, priceChange: number) {
    const previous = this.priceMovementCache.get(companyId) || {
      direction: 'neutral' as const,
      consecutiveCount: 0,
      lastChange: 0,
    };

    const newDirection: 'up' | 'down' | 'neutral' =
      Math.abs(priceChange) < 0.0001 ? 'neutral' :
      priceChange > 0 ? 'up' : 'down';

    const consecutiveCount =
      newDirection === previous.direction && newDirection !== 'neutral'
        ? previous.consecutiveCount + 1
        : 1;

    this.priceMovementCache.set(companyId, {
      direction: newDirection,
      consecutiveCount,
      lastChange: priceChange,
    });
  }

  /**
   * 업데이트 사유 생성: 가장 큰 영향을 미친 상위 2개 요소를 표시
   */
  private generateUpdateReason(factors: PriceFactors): string {
    const WEIGHTS = SIMULATION_PARAMS.PRICE.WEIGHTS;
    const entries = [
      { name: '뉴스 영향', value: Math.abs(factors.newsImpact * WEIGHTS.NEWS), raw: factors.newsImpact },
      { name: '섹터 트렌드', value: Math.abs(factors.sectorTrend * WEIGHTS.SECTOR_TREND), raw: factors.sectorTrend },
      { name: '시장 분위기', value: Math.abs(factors.marketCycle * WEIGHTS.MARKET_CYCLE), raw: factors.marketCycle },
      { name: '시장 이벤트', value: Math.abs(factors.eventImpact * WEIGHTS.EVENT), raw: factors.eventImpact },
      { name: '모멘텀', value: Math.abs(factors.momentum * WEIGHTS.MOMENTUM), raw: factors.momentum },
      { name: '업종 리더', value: Math.abs(factors.leaderImpact * WEIGHTS.LEADER), raw: factors.leaderImpact },
    ];

    entries.sort((a, b) => b.value - a.value);

    const reasons: string[] = [];
    for (const entry of entries.slice(0, 2)) {
      if (entry.value > 0.0005) {
        const direction = entry.raw > 0 ? '↑' : '↓';
        reasons.push(`${entry.name} ${direction}`);
      }
    }

    return reasons.length > 0 ? reasons.join(', ') : '일반 시장 변동';
  }

  // ─── 장 시작/종료 ──────────────────────────

  /**
   * 장 시작 시 개장가 설정
   * - 시장 사이클에 따른 편향 (호황: +1%, 침체: -1%)
   * - 섹터 트렌드에 따른 산업별 편향
   */
  public async setOpeningPrices(): Promise<void> {
    if (!this.isMarketOpen()) {
      console.log('마켓이 닫혀있습니다.');
      return;
    }

    const marketState = await this.loadMarketState();
    const { data: companies } = await this.supabase.from('companies').select('*');

    if (companies && companies.length > 0) {
      const phaseBias =
        marketState.market_phase === 'bull' ? 0.01 :
        marketState.market_phase === 'bear' ? -0.01 : 0;

      const phaseLabel =
        marketState.market_phase === 'bull' ? '호황' :
        marketState.market_phase === 'bear' ? '침체' : '보합';

      await Promise.all(
        companies.map(async (company: Company) => {
          const sectorBias = (marketState.sector_trends[company.industry] || 0) * 0.003; // 시가 편향 약화 (기존 0.01)
          const priceChange = (Math.random() - 0.5) * 0.08 + phaseBias + sectorBias;
          const openingPrice = company.last_closing_price * (1 + priceChange);
          const newMarketCap = Math.round(openingPrice * company.shares_issued);

          await this.retryOperation(async () => {
            return await this.supabase.from('price_updates').insert({
              id: crypto.randomUUID(),
              company_id: company.id,
              old_price: Number(company.current_price.toFixed(4)),
              new_price: Number(openingPrice.toFixed(4)),
              change_percentage: Number((priceChange * 100).toFixed(4)),
              update_reason: `장 시작 (${phaseLabel})`,
              created_at: new Date().toISOString(),
              old_market_cap: company.market_cap,
              new_market_cap: newMarketCap,
            });
          });

          await this.retryOperation(async () => {
            return await this.supabase
              .from('companies')
              .update({
                previous_price: company.current_price,
                current_price: openingPrice,
                market_cap: newMarketCap,
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
            return await this.supabase.from('price_updates').insert({
              id: crypto.randomUUID(),
              company_id: company.id,
              old_price: Number(company.current_price.toFixed(4)),
              new_price: Number(company.current_price.toFixed(4)),
              change_percentage: 0,
              update_reason: '장 마감',
              created_at: new Date().toISOString(),
              old_market_cap: company.market_cap,
              new_market_cap: company.market_cap,
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

  // ─── 뉴스 시스템 ──────────────────────────

  /**
   * 확률적 뉴스 생성: 매 updateMarket() 호출 시 8% 확률로 뉴스 1개 발생
   * 평균 ~12분에 1건, 하루(15시간) ~75건 뉴스 기대값
   *
   * 섹터 트렌드 편향: 강세 섹터는 ~65% 긍정 뉴스, 약세 섹터는 ~65% 부정 뉴스
   * 나머지 ~35%는 랜덤으로 반대 감정/중립 뉴스가 나와 예측 불가능성 유지
   */
  private async maybeGenerateNews(marketState: MarketState): Promise<void> {
    if (Math.random() > SIMULATION_PARAMS.NEWS.CHANCE_PER_UPDATE) {
      return;
    }

    try {
      const supabase = await this.ensureConnection();

      // 현재 시즌 테마 기업만 뉴스 대상 (상장폐지 제외)
      const { data: activeSeason } = await supabase
        .from('seasons')
        .select('theme_id')
        .eq('status', 'active')
        .single();

      const themeId = activeSeason?.theme_id ?? null;
      let companiesQuery = supabase
        .from('companies')
        .select('*')
        .eq('is_delisted', false);
      if (themeId) {
        companiesQuery = companiesQuery.eq('theme_id', themeId);
      }
      const { data: companies, error } = await companiesQuery;
      if (error) throw error;

      if (companies && companies.length > 0) {
        // 랜덤 회사 1개 선택 (현재 시즌 테마 기업만)
        const company = companies[Math.floor(Math.random() * companies.length)];
        const templates = await this.getNewsTemplatesForIndustry(company.industry);
        if (templates.length === 0) return;

        // 섹터 트렌드 + 시장 사이클 기반으로 선호 감정 결정
        const sectorStrength = marketState.sector_trends[company.industry] || 0;
        const cycleBias = marketState.market_phase === 'bull' ? 0.1 :
                          marketState.market_phase === 'bear' ? -0.1 : 0;
        // -1.0 ~ 1.0 범위의 감정 편향 점수
        const sentimentBias = Math.max(-1, Math.min(1, sectorStrength + cycleBias));

        const selectedNews = this.selectBiasedNews(templates, sentimentBias);
        await this.createNews({
          ...selectedNews,
          title: `[${company.name}] ${selectedNews.title}`,
          content: `${company.name}(${company.ticker}): ${selectedNews.content}`,
          company_id: company.id,
        });

        console.log(`📰 ${company.name} 뉴스 발생: ${selectedNews.title} (편향: ${sentimentBias > 0 ? '+' : ''}${(sentimentBias * 100).toFixed(0)}%)`);
      }
    } catch (error) {
      console.error('뉴스 생성 중 오류 (무시됨):', error);
    }
  }

  /**
   * 섹터 트렌드 편향이 적용된 뉴스 선택
   *
   * sentimentBias > 0: 긍정 뉴스 선택 확률 증가
   * sentimentBias < 0: 부정 뉴스 선택 확률 증가
   * sentimentBias = 0: 기존 volatility 가중치만 적용 (편향 없음)
   *
   * 편향 강도: |bias| * 0.35 만큼 선호 감정에 가중치 부여 (최대 ~65% 편향)
   */
  private selectBiasedNews(templates: NewsTemplate[], sentimentBias: number): NewsTemplate {
    const biasStrength = Math.abs(sentimentBias) * 0.15; // 편향 약화 (기존 0.35 → 0.15)
    const preferredSentiment = sentimentBias > 0 ? 'positive' : 'negative';

    const weights = templates.map((t) => {
      const vol = t.volatility ?? 1.0;
      let weight = Math.pow(1 / vol, 2.0); // 기존 volatility 가중치

      // 편향 적용: 강한 트렌드에서만 활성화 (기존 0.1 → 0.35)
      if (Math.abs(sentimentBias) > 0.35) {
        if (t.sentiment === preferredSentiment) {
          weight *= (1 + biasStrength * 3); // 선호 감정: 최대 ~2.05배
        } else if (t.sentiment !== 'neutral') {
          weight *= (1 - biasStrength);      // 반대 감정: 최대 ~0.65배
        }
        // neutral은 가중치 변동 없음
      }

      return Math.max(weight, 0.01); // 최소 가중치 보장 (완전 제거 방지)
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = Math.random() * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < templates.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        const template = templates[i];
        const variation = 0.8 + Math.random() * 0.4;
        return { ...template, impact: template.impact * variation };
      }
    }

    const last = templates[templates.length - 1];
    return { ...last, impact: last.impact * (0.8 + Math.random() * 0.4) };
  }

  /**
   * 수동 뉴스 업데이트 (외부 cron에서 호출 시 사용)
   */
  public async updateNews(): Promise<void> {
    console.log('뉴스 수동 업데이트 요청 받음:', new Date().toISOString());

    if (!this.isMarketOpen()) {
      console.log('장 마감 상태입니다. 뉴스 업데이트를 건너뜁니다.');
      return;
    }

    try {
      const supabase = await this.ensureConnection();
      const { data: companies, error } = await supabase.from('companies').select('*');
      if (error) throw error;

      const newsCount = Math.min(
        Math.floor(Math.random() * 5) + 3, // 3~7개
        companies?.length || 0
      );

      if (companies && companies.length > 0) {
        const shuffledCompanies = [...companies].sort(() => Math.random() - 0.5);

        for (let i = 0; i < newsCount; i++) {
          const company = shuffledCompanies[i];
          const templates = await this.getNewsTemplatesForIndustry(company.industry);
          if (templates.length === 0) continue;

          const selectedNews = this.selectRandomNews(templates);
          await this.createNews({
            ...selectedNews,
            title: `[${company.name}] ${selectedNews.title}`,
            content: `${company.name}(${company.ticker}): ${selectedNews.content}`,
            company_id: company.id,
          });
        }

        console.log(`수동 뉴스 ${newsCount}개 생성 완료`);
      }
    } catch (error) {
      console.error('뉴스 업데이트 중 오류 발생:', error);
      throw error;
    }
  }

  /** volatility 기반 가중치 선택 (낮은 volatility = 높은 선택 확률) */
  private selectRandomNews(templates: NewsTemplate[]): NewsTemplate {
    const weights = templates.map((t) => {
      const vol = t.volatility ?? 1.0;
      return Math.pow(1 / vol, 2.0);
    });

    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    const random = Math.random() * totalWeight;

    let cumulative = 0;
    for (let i = 0; i < templates.length; i++) {
      cumulative += weights[i];
      if (random <= cumulative) {
        const template = templates[i];
        const variation = 0.8 + Math.random() * 0.4;
        return { ...template, impact: template.impact * variation };
      }
    }

    const last = templates[templates.length - 1];
    return { ...last, impact: last.impact * (0.8 + Math.random() * 0.4) };
  }

  private async createNews(news: NewsTemplate & { company_id?: string }) {
    try {
      const supabase = await this.ensureConnection();
      const { error } = await this.retryOperation(async () => {
        return await supabase.from('news').insert({
          title: news.title,
          content: news.content,
          sentiment: news.sentiment,
          impact: news.impact,
          type: news.type,
          volatility: news.volatility || 1.0,
          company_id: news.company_id,
          published_at: new Date().toISOString(),
        });
      });
      if (error) throw error;
    } catch (error) {
      console.error('뉴스 생성 중 오류 발생:', error);
      throw new Error('뉴스 생성 실패');
    }
  }

  private async getNewsTemplatesForIndustry(industry: string): Promise<NewsTemplate[]> {
    if (!this.newsTemplateCache.has(industry)) {
      await this.loadNewsTemplates();
    }
    return this.newsTemplateCache.get(industry) || [];
  }

  /**
   * 뉴스 템플릿 로드 (산업별 필터링)
   * - industries가 NULL이면 모든 산업에 적용
   * - industries 배열에 해당 산업이 포함된 경우만 적용
   */
  private async loadNewsTemplates() {
    try {
      const { data, error } = await this.supabase
        .from('news_templates')
        .select('*')
        .eq('type', 'company');

      if (error) throw error;

      // 산업별 필터링하여 캐시
      for (const industry of ALL_INDUSTRIES) {
        const filtered = data.filter((template: NewsTemplate) => {
          if (!template.industries || template.industries.length === 0) return true;
          return template.industries.includes(industry);
        });
        this.newsTemplateCache.set(industry, filtered);
      }

      console.log(`${data.length}개의 뉴스 템플릿을 DB에서 로드했습니다. (산업별 필터링 적용)`);
    } catch (error) {
      console.error('뉴스 템플릿 로드 중 오류:', error);
      throw new Error('뉴스 템플릿 로드 실패');
    }
  }

  // ─── 재시도 유틸리티 ──────────────────────────

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
}
