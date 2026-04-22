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

    const { data: hotel } = await admin
      .from('hotels')
      .select('hits_api_url, hits_api_key, hits_tenant_name, hits_property_code, hits_client_id, manual_inventory_snapshot, manual_inventory_updated_at, manual_inventory_source')
      .eq('id', profile.hotel_id)
      .single()

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

      return NextResponse.json(
        {
          error: 'HITS nÃ£o configurado',
          notConfigured: true,
          manualSnapshotAvailable: false,
          availability: [],
          occupation: [],
          checkIn,
          checkOut,
          availabilityError: null,
          occupationError: null,
        },
        { status: 200 }
      )
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

    return NextResponse.json({
      availability: availability.status === 'fulfilled' ? availability.value : [],
      occupation: occupation.status === 'fulfilled' ? occupation.value : [],
      checkIn,
      checkOut,
      source: 'hits',
      manualSnapshotAvailable: manualAvailability.length > 0,
      importedAt: hotel?.manual_inventory_updated_at || manualSnapshot?.importedAt || null,
      importedFileName: hotel?.manual_inventory_source || manualSnapshot?.sourceFileName || null,
      manualWarning: null,
      availabilityError: availability.status === 'rejected' ? String(availability.reason) : null,
      occupationError: occupation.status === 'rejected' ? String(occupation.reason) : null,
    })
  } catch (err) {
    console.error('[Rooms API]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
