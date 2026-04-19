'use client'

import { createBrowserClient } from '@supabase/ssr'

function getEnvOrThrow(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export function createClient() {
  const supabaseUrl = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
