import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAvailability, getOccupationInventory } from '@/lib/hits/client'
import type { HitsCredentials } from '@/lib/hits/client'

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile?.hotel_id) return NextResponse.json({ error: 'No hotel' }, { status: 403 })

    const { data: hotel } = await admin
      .from('hotels')
      .select('hits_api_url, hits_api_key, hits_tenant_name, hits_property_code, hits_client_id')
      .eq('id', profile.hotel_id)
      .single()

    if (!hotel?.hits_api_url || !hotel?.hits_tenant_name) {
      return NextResponse.json({ error: 'HITS não configurado', notConfigured: true }, { status: 200 })
    }

    const credentials: HitsCredentials = {
      apiUrl: hotel.hits_api_url,
      apiKey: hotel.hits_api_key ?? '',
      tenantName: hotel.hits_tenant_name,
      propertyCode: Number(hotel.hits_property_code ?? 0),
      clientId: hotel.hits_client_id ?? '',
    }

    const url = new URL(req.url)
    const checkIn = url.searchParams.get('checkIn') || new Date().toISOString().slice(0, 10)
    const checkOut = url.searchParams.get('checkOut') || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const [availability, occupation] = await Promise.allSettled([
      checkAvailability(credentials, { checkIn, checkOut }),
      getOccupationInventory(credentials, { checkIn, checkOut }),
    ])

    return NextResponse.json({
      availability: availability.status === 'fulfilled' ? availability.value : [],
      occupation: occupation.status === 'fulfilled' ? occupation.value : [],
      checkIn,
      checkOut,
      availabilityError: availability.status === 'rejected' ? String(availability.reason) : null,
      occupationError: occupation.status === 'rejected' ? String(occupation.reason) : null,
    })
  } catch (err) {
    console.error('[Rooms API]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
