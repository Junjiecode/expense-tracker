import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isConfigured = Boolean(url && anonKey)

// 未配置时导出 null，App 会显示配置引导页
export const supabase: SupabaseClient = isConfigured
  ? createClient(url!, anonKey!)
  : (null as unknown as SupabaseClient)
