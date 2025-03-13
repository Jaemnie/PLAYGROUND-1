import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { BustabitScheduler } from '@/services/bustabit-scheduler'

// 스케줄러 싱글톤 인스턴스
const scheduler = BustabitScheduler.getInstance()

// 스케줄러 상태 테이블 확인 및 생성
async function ensureSchedulerStatusTable(supabase: any) {
  try {
    // 테이블 존재 여부 확인
    const { error } = await supabase.from('bustabit_scheduler_status').select('id').limit(1)
    
    if (error) {
      // 테이블 생성 시도
      await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS bustabit_scheduler_status (
            id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
            is_running BOOLEAN NOT NULL DEFAULT FALSE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          INSERT INTO bustabit_scheduler_status (is_running)
          SELECT FALSE
          WHERE NOT EXISTS (SELECT 1 FROM bustabit_scheduler_status);
        `
      })
    }
  } catch (error) {
    console.error('Error ensuring scheduler status table:', error)
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
    // Supabase 클라이언트를 스케줄러에 설정
    scheduler.setSupabaseClient(supabase);
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      )
    }
    
    // 관리자 권한 확인
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (adminError || !adminUser) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }
    
    // 스케줄러 상태 테이블 확인
    await ensureSchedulerStatusTable(supabase)
    
    // 데이터베이스에서 상태 확인
    const { data: statusData } = await supabase
      .from('bustabit_scheduler_status')
      .select('*')
      .single()
    
    // 스케줄러 상태 확인
    const isRunning = scheduler.isRunning()
    
    // 메모리 상태와 DB 상태가 다르면 동기화
    if (statusData && statusData.is_running !== isRunning) {
      // DB 상태가 running이고 메모리 상태가 stopped이면 스케줄러 시작
      if (statusData.is_running && !isRunning) {
        await scheduler.start();
      } 
      // DB 상태가 stopped이고 메모리 상태가 running이면 스케줄러 중지
      else if (!statusData.is_running && isRunning) {
        await scheduler.stop();
      }
    }
    
    return NextResponse.json({
      status: isRunning ? 'running' : 'stopped'
    })
  } catch (error) {
    console.error('Error checking scheduler status:', error)
    return NextResponse.json(
      { error: '스케줄러 상태 확인 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Supabase 클라이언트를 스케줄러에 설정
    scheduler.setSupabaseClient(supabase);
    
    // 사용자 인증 확인
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: '인증되지 않은 사용자입니다.' },
        { status: 401 }
      )
    }
    
    // 관리자 권한 확인
    const { data: adminUser, error: adminError } = await supabase
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .single()
    
    if (adminError || !adminUser) {
      return NextResponse.json(
        { error: '관리자 권한이 필요합니다.' },
        { status: 403 }
      )
    }
    
    // 스케줄러 상태 테이블 확인
    await ensureSchedulerStatusTable(supabase)
    
    // 요청 본문 파싱
    const body = await request.json()
    const { action } = body
    
    if (!action || (action !== 'start' && action !== 'stop')) {
      return NextResponse.json(
        { error: '유효한 작업이 아닙니다. "start" 또는 "stop"을 지정하세요.' },
        { status: 400 }
      )
    }
    
    // 스케줄러 제어
    if (action === 'start') {
      if (scheduler.isRunning()) {
        return NextResponse.json({
          message: '스케줄러가 이미 실행 중입니다.'
        })
      }
      
      await scheduler.start()
      return NextResponse.json({
        message: '스케줄러가 시작되었습니다.'
      })
    } else {
      if (!scheduler.isRunning()) {
        return NextResponse.json({
          message: '스케줄러가 이미 중지되었습니다.'
        })
      }
      
      await scheduler.stop()
      return NextResponse.json({
        message: '스케줄러가 중지되었습니다.'
      })
    }
  } catch (error) {
    console.error('Error controlling scheduler:', error)
    return NextResponse.json(
      { error: '스케줄러 제어 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 