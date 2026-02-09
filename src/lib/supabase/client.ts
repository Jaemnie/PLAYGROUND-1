import { createBrowserClient } from '@supabase/ssr'
import { SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null

export const createClientBrowser = () => {
    if (typeof window === 'undefined') {
      throw new Error('This client is for browser usage only')
    }
    
    if (!browserClient) {
      browserClient = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
    }
    return browserClient
  }