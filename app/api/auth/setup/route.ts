import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/setup
 * Chamado logo após o signup para criar o hotel e vincular o perfil do usuário.
 * Body: { hotelName: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const hotelName: string = (body.hotelName || '').trim() || 'Meu Hotel'

  const admin = createAdminClient()

  // Check if user already has a profile with hotel_id
  const { data: existing } = await admin
    .from('profiles')
    .select('hotel_id')
    .eq('id', user.id)
    .single()

  if (existing?.hotel_id) {
    return NextResponse.json({ ok: true, hotelId: existing.hotel_id })
  }

  // Create the hotel
  const { data: hotel, error: hotelError } = await admin
    .from('hotels')
    .insert({ name: hotelName })
    .select('id')
    .single()

  if (hotelError || !hotel) {
    return NextResponse.json({ error: hotelError?.message ?? 'Erro ao criar hotel' }, { status: 500 })
  }

  // Upsert the profile
  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      hotel_id: hotel.id,
      full_name: user.user_metadata?.full_name || hotelName,
      role: 'admin',
    })

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, hotelId: hotel.id })
}
