import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildManualInventoryWarning,
  getManualInventoryRooms,
  importManualInventoryCsv,
  type ManualInventorySnapshot,
} from '@/lib/manual-inventory'

async function getHotelId() {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: 'Não autenticado.' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('hotel_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.hotel_id) {
    return { error: NextResponse.json({ error: 'Perfil sem hotel vinculado.' }, { status: 400 }) }
  }

  return { hotelId: profile.hotel_id, admin }
}

export async function GET(req: NextRequest) {
  const auth = await getHotelId()
  if (auth.error) return auth.error

  const { hotelId, admin } = auth
  const { data: hotel, error } = await admin
    .from('hotels')
    .select('manual_inventory_snapshot, manual_inventory_updated_at, manual_inventory_source')
    .eq('id', hotelId)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message || 'Não foi possível buscar o snapshot manual.' }, { status: 500 })
  }

  const snapshot = (hotel?.manual_inventory_snapshot || null) as ManualInventorySnapshot | null
  const url = new URL(req.url)
  const checkIn = url.searchParams.get('checkIn') || ''
  const checkOut = url.searchParams.get('checkOut') || ''

  return NextResponse.json({
    snapshot,
    hasSnapshot: getManualInventoryRooms(snapshot).length > 0,
    updatedAt: hotel?.manual_inventory_updated_at || snapshot?.importedAt || null,
    sourceFileName: hotel?.manual_inventory_source || snapshot?.sourceFileName || null,
    warning: checkIn && checkOut ? buildManualInventoryWarning(snapshot, checkIn, checkOut) : null,
  })
}

export async function POST(req: NextRequest) {
  const auth = await getHotelId()
  if (auth.error) return auth.error

  const { hotelId, admin } = auth
  const body = await req.json().catch(() => ({}))
  const csvText = String(body.csvText || '')
  const fileName = typeof body.fileName === 'string' ? body.fileName : null
  const checkIn = typeof body.checkIn === 'string' ? body.checkIn : null
  const checkOut = typeof body.checkOut === 'string' ? body.checkOut : null

  let parsed
  try {
    parsed = importManualInventoryCsv(csvText, { fileName, checkIn, checkOut })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Não foi possível importar o CSV.' },
      { status: 400 }
    )
  }

  const { data: updatedHotel, error } = await admin
    .from('hotels')
    .update({
      manual_inventory_snapshot: parsed.snapshot,
      manual_inventory_updated_at: parsed.snapshot.importedAt,
      manual_inventory_source: fileName,
    })
    .eq('id', hotelId)
    .select('manual_inventory_snapshot, manual_inventory_updated_at, manual_inventory_source')
    .single()

  if (error || !updatedHotel) {
    return NextResponse.json(
      { error: error?.message || 'Não foi possível salvar o snapshot manual.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    ok: true,
    snapshot: updatedHotel.manual_inventory_snapshot,
    updatedAt: updatedHotel.manual_inventory_updated_at,
    sourceFileName: updatedHotel.manual_inventory_source,
    summary: parsed.summary,
    warning: buildManualInventoryWarning(parsed.snapshot, checkIn || '', checkOut || ''),
  })
}

export async function DELETE() {
  const auth = await getHotelId()
  if (auth.error) return auth.error

  const { hotelId, admin } = auth
  const { error } = await admin
    .from('hotels')
    .update({
      manual_inventory_snapshot: null,
      manual_inventory_updated_at: null,
      manual_inventory_source: null,
    })
    .eq('id', hotelId)

  if (error) {
    return NextResponse.json({ error: error.message || 'Não foi possível limpar o snapshot manual.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
