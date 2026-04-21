import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizeText(value: unknown): string | null {
  const text = String(value || '').trim()
  return text.length > 0 ? text : null
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('hotel_id')
      .eq('id', user.id)
      .single()

    if (profileError || !profile?.hotel_id) {
      return NextResponse.json({ error: 'Perfil sem hotel vinculado.' }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))

    const payload = {
      zapi_instance_id: normalizeText(body.zapi_instance_id),
      zapi_token: normalizeText(body.zapi_token),
      zapi_client_token: normalizeText(body.zapi_client_token),
      hits_api_url: normalizeText(body.hits_api_url),
      hits_tenant_name: normalizeText(body.hits_tenant_name),
      hits_property_code: normalizeText(body.hits_property_code)
        ? parseInt(String(body.hits_property_code).trim(), 10)
        : null,
      hits_client_id: normalizeText(body.hits_client_id),
      hits_api_key: normalizeText(body.hits_api_key),
    }

    if (payload.hits_property_code !== null && Number.isNaN(payload.hits_property_code)) {
      return NextResponse.json({ error: 'Property Code inválido.' }, { status: 400 })
    }

    const { data: updatedHotel, error: updateError } = await admin
      .from('hotels')
      .update(payload)
      .eq('id', profile.hotel_id)
      .select('zapi_instance_id,zapi_token,zapi_client_token,hits_api_url,hits_tenant_name,hits_property_code,hits_client_id,hits_api_key')
      .single()

    if (updateError || !updatedHotel) {
      return NextResponse.json(
        { error: updateError?.message || 'Não foi possível salvar as integrações.' },
        { status: 500 }
      )
    }

    return NextResponse.json({ ok: true, hotel: updatedHotel })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno.' },
      { status: 500 }
    )
  }
}
