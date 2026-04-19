import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAvailability } from '@/lib/hits/client'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('hotel_id').eq('id', user.id).single()
  if (!profile?.hotel_id) return NextResponse.json({ error: 'Hotel não encontrado' }, { status: 404 })

  const admin = createAdminClient()
  const { data: hotel } = await admin
    .from('hotels')
    .select('hits_api_url, hits_api_key, hits_tenant_name, hits_property_code, hits_client_id')
    .eq('id', profile.hotel_id)
    .single()

  if (!hotel?.hits_api_url || !hotel?.hits_api_key || !hotel?.hits_tenant_name || !hotel?.hits_property_code) {
    return NextResponse.json({ error: 'Integração HITS PMS não configurada' }, { status: 422 })
  }

  const creds = {
    apiUrl: hotel.hits_api_url as string,
    apiKey: hotel.hits_api_key as string,
    tenantName: hotel.hits_tenant_name as string,
    propertyCode: hotel.hits_property_code as number,
    clientId: (hotel.hits_client_id as string) || '',
  }

  const { searchParams } = new URL(request.url)
  const checkIn = searchParams.get('checkIn')
  const checkOut = searchParams.get('checkOut')
  const guests = searchParams.get('guests')

  if (!checkIn || !checkOut || !guests) {
    return NextResponse.json({ error: 'checkIn, checkOut e guests são obrigatórios' }, { status: 400 })
  }

  try {
    const rooms = await checkAvailability(creds, { checkIn, checkOut })
    return NextResponse.json({ data: rooms })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao consultar disponibilidade'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
