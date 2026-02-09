import { createClient } from '@supabase/supabase-js'

/**
 * RLS를 우회하는 Supabase Admin 클라이언트
 * 크론 작업, 서버 백그라운드 작업 등 사용자 세션이 없는 환경에서 사용
 * 절대로 클라이언트 사이드에서 사용하지 말 것
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY가 설정되지 않았습니다.')
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
