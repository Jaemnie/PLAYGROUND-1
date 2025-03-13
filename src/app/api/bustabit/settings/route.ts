import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'

// 게임 설정 테이블 확인 및 생성
async function ensureSettingsTable(supabase: any) {
  try {
    // 테이블 존재 여부 확인
    const { error } = await supabase.from('bustabit_settings').select('id').limit(1)
    
    if (error) {
      console.log('Creating bustabit_settings table...')
      
      // 테이블 생성
      await supabase.rpc('exec_sql', {
        sql_query: `
          CREATE TABLE IF NOT EXISTS bustabit_settings (
            id SERIAL PRIMARY KEY,
            min_bet INTEGER NOT NULL DEFAULT 100,
            max_bet INTEGER NOT NULL DEFAULT 10000,
            house_edge NUMERIC(5,2) NOT NULL DEFAULT 1.00,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          );
          
          INSERT INTO bustabit_settings (min_bet, max_bet, house_edge)
          SELECT 100, 10000, 1.00
          WHERE NOT EXISTS (SELECT 1 FROM bustabit_settings);
        `
      }).catch((err: any) => {
        console.error('Error creating table with RPC:', err)
        
        // RPC 방식이 실패하면 직접 쿼리 실행
        return supabase.from('bustabit_settings').insert({
          min_bet: 100,
          max_bet: 10000,
          house_edge: 1.00
        })
      })
    }
  } catch (error) {
    console.error('Error ensuring settings table:', error)
  }
}

export async function GET() {
  try {
    const supabase = await createClient()
    
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
    
    // 게임 설정 테이블 확인
    await ensureSettingsTable(supabase)
    
    // 게임 설정 가져오기
    const { data: settings, error: settingsError } = await supabase
      .from('bustabit_settings')
      .select('*')
      .single()
    
    if (settingsError) {
      console.error('Error fetching settings:', settingsError)
      return NextResponse.json(
        { error: '게임 설정을 가져오는 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching game settings:', error)
    return NextResponse.json(
      { error: '게임 설정을 가져오는 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
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
    
    // 게임 설정 테이블 확인
    await ensureSettingsTable(supabase)
    
    // 요청 본문 파싱
    const body = await request.json()
    const { min_bet, max_bet, house_edge } = body
    
    // 입력값 검증
    if (min_bet === undefined || max_bet === undefined || house_edge === undefined) {
      return NextResponse.json(
        { error: '필수 필드가 누락되었습니다.' },
        { status: 400 }
      )
    }
    
    if (min_bet <= 0 || max_bet <= 0 || house_edge <= 0) {
      return NextResponse.json(
        { error: '모든 값은 양수여야 합니다.' },
        { status: 400 }
      )
    }
    
    if (min_bet >= max_bet) {
      return NextResponse.json(
        { error: '최소 베팅 금액은 최대 베팅 금액보다 작아야 합니다.' },
        { status: 400 }
      )
    }
    
    if (house_edge > 10) {
      return NextResponse.json(
        { error: '하우스 엣지는 10% 이하여야 합니다.' },
        { status: 400 }
      )
    }
    
    // 첫 번째 레코드 ID 가져오기
    const { data: firstRecord, error: firstRecordError } = await supabase
      .from('bustabit_settings')
      .select('id')
      .limit(1)
      .single()
    
    if (firstRecordError) {
      console.error('Error fetching first record:', firstRecordError)
      return NextResponse.json(
        { error: '게임 설정 레코드를 찾을 수 없습니다.' },
        { status: 500 }
      )
    }
    
    // 게임 설정 업데이트
    const { data, error } = await supabase
      .from('bustabit_settings')
      .update({
        min_bet,
        max_bet,
        house_edge,
        updated_at: new Date().toISOString()
      })
      .eq('id', firstRecord.id)
      .select()
    
    if (error) {
      console.error('Error updating game settings:', error)
      return NextResponse.json(
        { error: '게임 설정 업데이트 중 오류가 발생했습니다.' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      message: '게임 설정이 성공적으로 업데이트되었습니다.',
      data: data[0]
    })
  } catch (error) {
    console.error('Error updating game settings:', error)
    return NextResponse.json(
      { error: '게임 설정 업데이트 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
} 