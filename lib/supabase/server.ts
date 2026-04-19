import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

function getEnvOrThrow(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

export async function createClient() {
  const supabaseUrl = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
  const supabaseAnonKey = getEnvOrThrow('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Server Components não permitem set de cookies — ignorar
        }
      },
    },
  })
}
