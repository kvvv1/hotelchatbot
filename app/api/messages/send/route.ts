import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { saveMessage } from '@/lib/leads/service'
import { zapiSendText } from '@/lib/zapi/client'

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { leadId, message } = body

  if (!leadId || !message?.trim()) {
    return NextResponse.json({ error: 'leadId e message são obrigatórios' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Buscar lead com dados do hotel
  const { data: lead } = await admin
    .from('leads')
    .select('id, guest_phone, hotel_id')
    .eq('id', leadId)
    .single()

  if (!lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  // Buscar credenciais Z-API do hotel
  const { data: hotel } = await admin
    .from('hotels')
    .select('zapi_instance_id, zapi_token, zapi_client_token')
    .eq('id', lead.hotel_id)
    .single()

  if (!hotel?.zapi_instance_id || !hotel?.zapi_token) {
    return NextResponse.json({ error: 'WhatsApp não configurado' }, { status: 422 })
  }

  try {
    // Enviar via Z-API
    await zapiSendText(
      {
        instanceId: hotel.zapi_instance_id,
        token: hotel.zapi_token,
        clientToken: hotel.zapi_client_token || undefined,
      },
      lead.guest_phone,
      message.trim()
    )

    // Salvar mensagem no banco
    await saveMessage({
      lead_id: leadId,
      sender: 'human',
      content: message.trim(),
      media_type: 'text',
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro ao enviar mensagem'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
