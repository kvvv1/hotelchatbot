import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * POST /api/auth/setup
 * Cria o hotel e vincula ao perfil do usuário autenticado.
 * Body: { hotelName: string }
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

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
      console.error('[setup] hotel insert error:', hotelError)
      return NextResponse.json(
        { error: 'Erro ao criar hotel: ' + (hotelError?.message ?? 'desconhecido') },
        { status: 500 }
      )
    }

    // Update/upsert the profile with hotel_id
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: user.id,
        hotel_id: hotel.id,
        full_name: user.user_metadata?.full_name || hotelName,
        role: 'admin',
      })

    if (profileError) {
      console.error('[setup] profile upsert error:', profileError)
      // Try plain update as fallback
      const { error: updateError } = await admin
        .from('profiles')
        .update({ hotel_id: hotel.id, role: 'admin' })
        .eq('id', user.id)

      if (updateError) {
        console.error('[setup] profile update fallback error:', updateError)
        return NextResponse.json(
          { error: 'Erro ao vincular perfil: ' + updateError.message },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({ ok: true, hotelId: hotel.id })
  } catch (err) {
    console.error('[setup] unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erro interno' },
      { status: 500 }
    )
  }
}
