import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente admin com service role — bypassa RLS.
 * Usar apenas em code server-side não acessível pelo cliente.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl) throw new Error('Missing env var: NEXT_PUBLIC_SUPABASE_URL')
  if (!serviceRoleKey) throw new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY')

  return createSupabaseClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
