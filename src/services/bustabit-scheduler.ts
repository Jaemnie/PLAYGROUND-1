import { createClient } from '@/lib/supabase/server'
import crypto from 'crypto'

// 게임 상태 타입
type GameState = 'waiting' | 'running' | 'crashed'

// 게임 해시 생성 함수
function generateGameHash(): string {
  return crypto.randomBytes(16).toString('hex')
}

// 게임 배수 계산 함수
function calculateMultiplier(hash: string): number {
  // 해시를 숫자로 변환
  const hmac = crypto.createHmac('sha256', process.env.BUSTABIT_SECRET || 'default-secret')
  hmac.update(hash)
  const seed = parseInt(hmac.digest('hex').slice(0, 8), 16)
  
  // 0에서 1 사이의 난수 생성
  const r = seed / 0xffffffff
  
  // 하우스 엣지 적용 (1%)
  if (r < 0.01) return 1.00 // 1% 확률로 1.00에서 크래시
  
  // 배수 계산 (99 / r 공식 사용)
  return Math.floor(99 / r) / 100
}

export class BustabitScheduler {
  private static instance: BustabitScheduler | null = null;
  private supabase: any = null
  private currentGameId: string | null = null
  private currentGameHash: string | null = null
  private targetMultiplier: number = 1.00
  private gameState: GameState = 'waiting'
  private gameStartTime: number = 0
  private currentMultiplier: number = 1.00
  private updateInterval: NodeJS.Timeout | null = null
  private gameTimeout: NodeJS.Timeout | null = null
  private waitingTimeout: NodeJS.Timeout | null = null
  private running: boolean = false
  
  // 싱글톤 패턴 구현
  public static getInstance(): BustabitScheduler {
    if (!BustabitScheduler.instance) {
      BustabitScheduler.instance = new BustabitScheduler();
    }
    return BustabitScheduler.instance;
  }
  
  private constructor() {
    // 생성자에서는 아무것도 초기화하지 않음
  }
  
  // Supabase 클라이언트 설정
  public setSupabaseClient(supabaseClient: any) {
    this.supabase = supabaseClient;
  }
  
  // 게임 사이클 시작
  private async startGameCycle() {
    try {
      // Supabase 클라이언트가 설정되지 않았으면 오류 반환
      if (!this.supabase) {
        console.error('Supabase client is not initialized');
        return;
      }
      
      // 이전 게임 상태 초기화
      this.resetGameState()
      
      // 대기 상태로 전환 (5초 대기)
      this.gameState = 'waiting'
      
      // 새 게임 생성
      const gameHash = generateGameHash()
      this.currentGameHash = gameHash
      this.targetMultiplier = calculateMultiplier(gameHash)
      
      console.log('New game created with hash:', gameHash)
      console.log('Target multiplier:', this.targetMultiplier)
      
      // 게임 DB에 저장
      const { data: gameData, error: gameError } = await this.supabase
        .from('bustabit_games')
        .insert({
          game_hash: gameHash,
          multiplier: this.targetMultiplier,
          crashed_at: new Date(Date.now() + 3600000) // 임시로 1시간 후 시간을 넣음
        })
        .select('id')
        .single()
      
      if (gameError) {
        console.error('Game creation error:', gameError)
        
        // 테이블이 없거나 crashed_at 컬럼이 NOT NULL인 경우 테이블 생성 시도
        if (gameError.code === '42P01' || gameError.code === '23502') {
          try {
            // bustabit_games 테이블 생성 또는 수정
            await this.supabase.rpc('exec_sql', {
              sql_query: `
                CREATE TABLE IF NOT EXISTS bustabit_games (
                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                  game_hash TEXT NOT NULL,
                  multiplier NUMERIC(10,2) NOT NULL,
                  crashed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW() + INTERVAL '1 hour',
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- bustabit_bets 테이블 생성
                CREATE TABLE IF NOT EXISTS bustabit_bets (
                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                  user_id UUID NOT NULL REFERENCES auth.users(id),
                  game_id UUID NOT NULL REFERENCES bustabit_games(id),
                  bet_amount INTEGER NOT NULL,
                  auto_cashout_multiplier NUMERIC(10,2),
                  cashout_multiplier NUMERIC(10,2),
                  profit INTEGER,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
                
                -- bustabit_stats 테이블 생성
                CREATE TABLE IF NOT EXISTS bustabit_stats (
                  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
                  user_id UUID NOT NULL REFERENCES auth.users(id) UNIQUE,
                  total_bets INTEGER DEFAULT 0,
                  total_wagered INTEGER DEFAULT 0,
                  total_profit INTEGER DEFAULT 0,
                  best_multiplier NUMERIC(10,2) DEFAULT 0,
                  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
                );
              `
            });
          } catch (err) {
            console.error('Error creating/modifying bustabit_games table:', err);
          }
          
          // 다시 게임 생성 시도
          const { data, error } = await this.supabase
            .from('bustabit_games')
            .insert({
              game_hash: gameHash,
              multiplier: this.targetMultiplier,
              crashed_at: new Date(Date.now() + 3600000) // 임시로 1시간 후 시간을 넣음
            })
            .select('id')
            .single();
            
          if (error) {
            console.error('Second attempt game creation error:', error);
            // 오류 발생 시 5초 후 재시도
            this.waitingTimeout = setTimeout(() => this.startGameCycle(), 5000);
            return;
          }
          
          this.currentGameId = data.id;
        } else {
          // 오류 발생 시 5초 후 재시도
          this.waitingTimeout = setTimeout(() => this.startGameCycle(), 5000);
          return;
        }
      } else {
        this.currentGameId = gameData.id;
      }
      
      // 게임 상태 브로드캐스트
      await this.broadcastGameState('waiting', this.currentGameId)
      
      // 5초 후 게임 시작
      this.waitingTimeout = setTimeout(() => this.startGame(), 5000)
    } catch (error) {
      console.error('Error starting game cycle:', error)
      // 오류 발생 시 5초 후 재시도
      this.waitingTimeout = setTimeout(() => this.startGameCycle(), 5000)
    }
  }
  
  // 게임 시작
  private async startGame() {
    try {
      if (!this.currentGameId) {
        throw new Error('No current game ID')
      }
      
      // 게임 상태 변경
      this.gameState = 'running'
      this.gameStartTime = Date.now()
      this.currentMultiplier = 1.00
      
      // 게임 상태 브로드캐스트
      await this.broadcastGameState('running', this.currentGameId, this.currentMultiplier)
      
      // 게임 업데이트 인터벌 시작 (100ms마다 업데이트)
      this.updateInterval = setInterval(() => this.updateGame(), 100)
      
      // 게임 종료 타이머 설정
      const gameDuration = (this.targetMultiplier - 1) * 1000 // 1초당 1.00씩 증가
      this.gameTimeout = setTimeout(() => this.crashGame(), gameDuration)
    } catch (error) {
      console.error('Error starting game:', error)
      // 오류 발생 시 게임 재시작
      this.resetGameState()
      this.waitingTimeout = setTimeout(() => this.startGameCycle(), 5000)
    }
  }
  
  // 게임 업데이트
  private async updateGame() {
    try {
      if (this.gameState !== 'running') return
      
      // 경과 시간 계산
      const elapsedTime = Date.now() - this.gameStartTime
      
      // 현재 배수 계산 (1초당 1.00씩 증가)
      this.currentMultiplier = 1.00 + (elapsedTime / 1000)
      
      // 100ms마다 브로드캐스트 (성능 최적화를 위해)
      await this.broadcastGameState('running', this.currentGameId, this.currentMultiplier)
      
      // 자동 캐시아웃 처리
      await this.processAutoCashouts()
    } catch (error) {
      console.error('Error updating game:', error)
    }
  }
  
  // 자동 캐시아웃 처리
  private async processAutoCashouts() {
    try {
      if (!this.currentGameId) return
      
      // 자동 캐시아웃 대상 조회
      const { data: autoCashoutBets, error } = await this.supabase
        .from('bustabit_bets')
        .select('id, user_id, bet_amount, auto_cashout_multiplier')
        .eq('game_id', this.currentGameId)
        .is('cashout_multiplier', null) // 아직 캐시아웃하지 않은 베팅
        .not('auto_cashout_multiplier', 'is', null) // 자동 캐시아웃 설정이 있는 베팅
        .lt('auto_cashout_multiplier', this.currentMultiplier) // 현재 배수보다 낮은 자동 캐시아웃 설정
      
      if (error) {
        console.error('Error fetching auto cashout bets:', error)
        return
      }
      
      // 각 베팅에 대해 자동 캐시아웃 처리
      for (const bet of autoCashoutBets || []) {
        const cashoutMultiplier = bet.auto_cashout_multiplier
        const winAmount = Math.floor(bet.bet_amount * cashoutMultiplier)
        const profitAmount = winAmount - bet.bet_amount
        
        // 베팅 업데이트
        const { error: updateError } = await this.supabase
          .from('bustabit_bets')
          .update({
            cashout_multiplier: cashoutMultiplier,
            profit: profitAmount
          })
          .eq('id', bet.id)
        
        if (updateError) {
          console.error('Auto cashout update error:', updateError)
        }
      }
    } catch (error) {
      console.error('Error processing auto cashouts:', error)
    }
  }
  
  // 게임 종료
  private async crashGame() {
    try {
      if (!this.currentGameId) {
        throw new Error('No current game ID')
      }
      
      // 게임 상태 변경
      this.gameState = 'crashed'
      
      // 인터벌 정리
      if (this.updateInterval) {
        clearInterval(this.updateInterval)
        this.updateInterval = null
      }
      
      // 게임 종료 시간 업데이트
      const currentTime = new Date()
      const { error: updateError } = await this.supabase
        .from('bustabit_games')
        .update({
          crashed_at: currentTime
        })
        .eq('id', this.currentGameId)
      
      if (updateError) {
        console.error('Game update error:', updateError)
      }
      
      // 게임 상태 브로드캐스트
      await this.broadcastGameState('crashed', this.currentGameId, this.targetMultiplier)
      
      // 베팅 실패 처리
      await this.handleFailedBets()
      
      // 3초 후 새 게임 시작
      this.waitingTimeout = setTimeout(() => this.startGameCycle(), 3000)
    } catch (error) {
      console.error('Error crashing game:', error)
      // 오류 발생 시 게임 재시작
      this.resetGameState()
      this.waitingTimeout = setTimeout(() => this.startGameCycle(), 5000)
    }
  }
  
  // 베팅 실패 처리
  private async handleFailedBets() {
    try {
      if (!this.currentGameId) return
      
      // 실패한 베팅 조회 (캐시아웃하지 않은 베팅)
      const { data: failedBets, error } = await this.supabase
        .from('bustabit_bets')
        .select('id, bet_amount')
        .eq('game_id', this.currentGameId)
        .is('cashout_multiplier', null) // 캐시아웃하지 않은 베팅
      
      if (error) {
        console.error('Error fetching failed bets:', error)
        return
      }
      
      // 각 베팅에 대해 실패 처리
      for (const bet of failedBets || []) {
        const { error: updateError } = await this.supabase
          .from('bustabit_bets')
          .update({
            profit: -bet.bet_amount
          })
          .eq('id', bet.id)
        
        if (updateError) {
          console.error('Failed bet update error:', updateError)
        }
      }
    } catch (error) {
      console.error('Error handling failed bets:', error)
    }
  }
  
  // 게임 상태 브로드캐스트
  private async broadcastGameState(state: GameState, gameId: string | null, multiplier?: number) {
    try {
      await this.supabase
        .channel('bustabit_game_state')
        .send({
          type: 'broadcast',
          event: 'game_state',
          payload: {
            state,
            gameId,
            multiplier: multiplier ? parseFloat(multiplier.toFixed(2)) : undefined
          }
        })
    } catch (error) {
      console.error('Error broadcasting game state:', error)
    }
  }
  
  // 게임 상태 초기화
  private resetGameState() {
    this.gameState = 'waiting'
    this.currentGameId = null
    this.currentGameHash = null
    this.targetMultiplier = 1.00
    this.currentMultiplier = 1.00
    this.gameStartTime = 0
    
    // 타이머 정리
    if (this.updateInterval) {
      clearInterval(this.updateInterval)
      this.updateInterval = null
    }
    
    if (this.gameTimeout) {
      clearTimeout(this.gameTimeout)
      this.gameTimeout = null
    }
    
    if (this.waitingTimeout) {
      clearTimeout(this.waitingTimeout)
      this.waitingTimeout = null
    }
  }
  
  // 스케줄러 시작
  public async start() {
    if (!this.running) {
      // Supabase 클라이언트가 설정되지 않았으면 오류 반환
      if (!this.supabase) {
        console.error('Supabase client is not initialized');
        return;
      }
      
      this.running = true;
      
      // 스케줄러 상태 업데이트
      await this.updateSchedulerStatus(true);
      
      // 게임 사이클 시작
      await this.startGameCycle();
    }
  }
  
  // 스케줄러 중지
  public async stop() {
    // Supabase 클라이언트가 설정되지 않았으면 오류 반환
    if (!this.supabase) {
      console.error('Supabase client is not initialized');
      return;
    }
    
    this.running = false;
    
    // 스케줄러 상태 업데이트
    await this.updateSchedulerStatus(false);
    
    // 게임 상태 초기화
    this.resetGameState();
  }
  
  // 스케줄러 실행 상태 확인
  public isRunning(): boolean {
    return this.running;
  }
  
  // 스케줄러 상태 업데이트
  private async updateSchedulerStatus(isRunning: boolean) {
    try {
      // Supabase 클라이언트가 설정되지 않았으면 오류 반환
      if (!this.supabase) {
        console.error('Supabase client is not initialized');
        return;
      }
      
      // 기존 레코드 확인
      const { data } = await this.supabase
        .from('bustabit_scheduler_status')
        .select('*')
        .single();
      
      if (data) {
        // 레코드가 있으면 업데이트
        await this.supabase
          .from('bustabit_scheduler_status')
          .update({ is_running: isRunning, updated_at: new Date().toISOString() })
          .eq('id', data.id);
      } else {
        // 레코드가 없으면 생성
        await this.supabase
          .from('bustabit_scheduler_status')
          .insert({ is_running: isRunning });
      }
    } catch (error) {
      console.error('Error updating scheduler status:', error);
    }
  }
} 