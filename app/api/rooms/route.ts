import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkAvailability, getOccupationInventory } from '@/lib/hits/client'
import type { HitsCredentials } from '@/lib/hits/client'
import {
  buildManualInventoryWarning,
  getManualInventoryRooms,
  type ManualInventorySnapshot,
} from '@/lib/manual-inventory'

const DEMO_AVAILABILITY = [
  { roomTypeId: 101, roomTypeCode: 'STD', roomTypeName: 'Quarto Standard', availableRooms: 4, totalRooms: 8, rate: 329, currency: 'BRL', available: true },
  { roomTypeId: 102, roomTypeCode: 'DLX', roomTypeName: 'Quarto Deluxe', availableRooms: 2, totalRooms: 4, rate: 459, currency: 'BRL', available: true },
  { roomTypeId: 103, roomTypeCode: 'FAM', roomTypeName: 'Suite Familia', availableRooms: 1, totalRooms: 2, rate: 619, currency: 'BRL', available: true },
  { roomTypeId: 104, roomTypeCode: 'NAT', roomTypeName: 'Chale Natureza', availableRooms: 3, totalRooms: 5, rate: 549, currency: 'BRL', available: true },
]

type HotelRecord = {
  hits_api_url?: string | null
  hits_api_key?: string | null
  hits_tenant_name?: string | null
  hits_property_code?: number | null
  hits_client_id?: string | null
  manual_inventory_snapshot?: ManualInventorySnapshot | null
  manual_inventory_updated_at?: string | null
  manual_inventory_source?: string | null
}

async function loadHotel(admin: ReturnType<typeof createAdminClient>, hotelId: string): Promise<HotelRecord | null> {
  const extendedSelect =
    'hits_api_url, hits_api_key, hits_tenant_name, hits_property_code, hits_client_id, manual_inventory_snapshot, manual_inventory_updated_at, manual_inventory_source'

  const extended = await admin
    .from('hotels')
    .select(extendedSelect)
    .eq('id', hotelId)
    .single()

  if (!extended.error) return extended.data as HotelRecord

  const fallback = await admin
    .from('hotels')
    .select('hits_api_url, hits_api_key, hits_tenant_name, hits_property_code, hits_client_id')
    .eq('id', hotelId)
    .single()

  if (fallback.error) throw fallback.error

  return {
    ...(fallback.data as HotelRecord),
    manual_inventory_snapshot: null,
    manual_inventory_updated_at: null,
    manual_inventory_source: null,
  }
}

function buildDemoResponse(checkIn: string, checkOut: string) {
  return {
    availability: DEMO_AVAILABILITY,
    occupation: [],
    checkIn,
    checkOut,
    source: 'manual' as const,
    manualSnapshotAvailable: true,
    importedAt: new Date().toISOString(),
    importedFileName: 'demo-apresentacao-hotel-macuco',
    manualWarning: 'Exibindo disponibilidade demonstrativa para apresentacao comercial.',
    availabilityError: null,
    occupationError: null,
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile?.hotel_id) return NextResponse.json({ error: 'No hotel' }, { status: 403 })

    const url = new URL(req.url)
    const checkIn = url.searchParams.get('checkIn') || new Date().toISOString().slice(0, 10)
    const checkOut =
      url.searchParams.get('checkOut') ||
      new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const hotel = await loadHotel(admin, profile.hotel_id)

    const manualSnapshot = (hotel?.manual_inventory_snapshot || null) as ManualInventorySnapshot | null
    const manualAvailability = getManualInventoryRooms(manualSnapshot)
    const manualWarning = buildManualInventoryWarning(manualSnapshot, checkIn, checkOut)
    const hasHitsCredentials = Boolean(
      hotel?.hits_api_url && hotel?.hits_api_key && hotel?.hits_tenant_name && hotel?.hits_property_code
    )

    if (!hasHitsCredentials) {
      if (manualAvailability.length > 0) {
        return NextResponse.json({
          availability: manualAvailability,
          occupation: [],
          checkIn,
          checkOut,
          source: 'manual',
          manualSnapshotAvailable: true,
          importedAt: hotel?.manual_inventory_updated_at || manualSnapshot?.importedAt || null,
          importedFileName: hotel?.manual_inventory_source || manualSnapshot?.sourceFileName || null,
          manualWarning,
          availabilityError: null,
          occupationError: null,
        })
      }

      return NextResponse.json(buildDemoResponse(checkIn, checkOut))
    }

    const credentials: HitsCredentials = {
      apiUrl: hotel?.hits_api_url as string,
      apiKey: (hotel?.hits_api_key as string) ?? '',
      tenantName: hotel?.hits_tenant_name as string,
      propertyCode: Number(hotel?.hits_property_code ?? 0),
      clientId: (hotel?.hits_client_id as string) ?? '',
    }

    const [availability, occupation] = await Promise.allSettled([
      checkAvailability(credentials, { checkIn, checkOut }),
      getOccupationInventory(credentials, { checkIn, checkOut }),
    ])

    if (availability.status === 'rejected' && manualAvailability.length > 0) {
      return NextResponse.json({
        availability: manualAvailability,
        occupation: [],
        checkIn,
        checkOut,
        source: 'manual',
        manualSnapshotAvailable: true,
        importedAt: hotel?.manual_inventory_updated_at || manualSnapshot?.importedAt || null,
        importedFileName: hotel?.manual_inventory_source || manualSnapshot?.sourceFileName || null,
        manualWarning,
        availabilityError: String(availability.reason),
        occupationError: occupation.status === 'rejected' ? String(occupation.reason) : null,
      })
    }

    if (availability.status === 'rejected') {
      return NextResponse.json({
        ...buildDemoResponse(checkIn, checkOut),
        availabilityError: String(availability.reason),
        occupationError: occupation.status === 'rejected' ? String(occupation.reason) : null,
      })
    }

    return NextResponse.json({
      availability: availability.value,
      occupation: occupation.status === 'fulfilled' ? occupation.value : [],
      checkIn,
      checkOut,
      source: 'hits',
      manualSnapshotAvailable: manualAvailability.length > 0,
      importedAt: hotel?.manual_inventory_updated_at || manualSnapshot?.importedAt || null,
      importedFileName: hotel?.manual_inventory_source || manualSnapshot?.sourceFileName || null,
      manualWarning: null,
      availabilityError: null,
      occupationError: occupation.status === 'rejected' ? String(occupation.reason) : null,
    })
  } catch (err) {
    console.error('[Rooms API]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
