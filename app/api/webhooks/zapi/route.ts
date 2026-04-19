import { NextRequest, NextResponse } from 'next/server'
import { parseWebhookPayload, shouldProcessWebhook } from '@/lib/zapi/webhookParser'
import { transcribeAudio } from '@/lib/agent/whisper'
import { processMessage, shouldBotRespond } from '@/lib/agent/engine'
import {
  createOrGetLead,
  saveMessage,
  updateLead,
  getHotelByZapiInstance,
} from '@/lib/leads/service'
import { zapiSendText } from '@/lib/zapi/client'
import { createAdminClient } from '@/lib/supabase/admin'
import type { BotSettings } from '@/lib/types/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()

    // Parse do payload Z-API
    let parsed
    try {
      parsed = parseWebhookPayload(body)
    } catch (err) {
      // Payloads de status de conexão ou inválidos — ignorar silenciosamente
      return NextResponse.json({ ok: true })
    }

    // Ignorar mensagens enviadas por nós ou inválidas
    if (!shouldProcessWebhook(parsed)) {
      return NextResponse.json({ ok: true })
    }

    // Buscar hotel pela instância Z-API
    const hotel = await getHotelByZapiInstance(parsed.instanceId)
    if (!hotel) {
      console.warn('[Webhook] Instância não encontrada:', parsed.instanceId)
      return NextResponse.json({ ok: true })
    }

    // Criar ou buscar lead
    const lead = await createOrGetLead({
      hotel_id: hotel.id,
      guest_phone: parsed.phone,
      guest_name: parsed.name || undefined,
    })

    // Atualizar nome do hóspede se obtido e ainda não salvo
    if (parsed.name && !lead.guest_name) {
      await updateLead(lead.id, { guest_name: parsed.name })
    }

    // Processar áudio se necessário
    let finalText = parsed.messageText
    let transcription: string | undefined

    if (parsed.isAudio && parsed.audioUrl) {
      try {
        transcription = await transcribeAudio(parsed.audioUrl)
        finalText = transcription
      } catch (err) {
        console.error('[Webhook] Erro na transcrição de áudio:', err)
        finalText = '[Áudio não transcrito]'
      }
    }

    // Salvar mensagem do hóspede
    await saveMessage({
      lead_id: lead.id,
      sender: 'guest',
      content: finalText,
      media_type: parsed.isAudio ? 'audio' : 'text',
      media_url: parsed.audioUrl || undefined,
      transcription,
      zapi_message_id: parsed.messageId || undefined,
    })

    // Verificar se bot está habilitado para este lead
    if (!lead.bot_enabled) {
      // Bot desabilitado (humano está atendendo) — notificar equipe
      await notifyTeam(hotel.id, lead.id, finalText)
      return NextResponse.json({ ok: true })
    }

    // Verificar configurações do bot
    const supabase = createAdminClient()
    const { data: settingsData } = await supabase
      .from('bot_settings')
      .select('*')
      .eq('hotel_id', hotel.id)
      .single()

    const settings = settingsData as BotSettings | null

    if (!shouldBotRespond(settings)) {
      // Fora do horário de atendimento
      const outOfHoursMsg =
        'Olá! Estamos fora do horário de atendimento no momento. Em breve nossa equipe retornará seu contato. 😊'
      await sendAndSaveReply(lead.id, hotel, outOfHoursMsg, parsed.phone)
      return NextResponse.json({ ok: true })
    }

    // Processar com o agente IA
    const agentResponse = await processMessage(lead, finalText)

    if (!agentResponse.message) {
      return NextResponse.json({ ok: true })
    }

    // Enviar resposta pelo WhatsApp
    await sendAndSaveReply(lead.id, hotel, agentResponse.message, parsed.phone)

    // Se transferiu para humano, notificar equipe
    if (agentResponse.transferToHuman) {
      await notifyTeam(hotel.id, lead.id, 'Hóspede solicitou atendimento humano')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Webhook] Erro não tratado:', error)
    return NextResponse.json({ ok: false, error: 'Internal error' }, { status: 500 })
  }
}

async function sendAndSaveReply(
  leadId: string,
  hotel: { id: string; zapi_token: string | null; zapi_client_token: string | null },
  message: string,
  phone: string
): Promise<void> {
  // Buscar instância da Z-API
  const supabase = createAdminClient()
  const { data: hotelData } = await supabase
    .from('hotels')
    .select('zapi_instance_id, zapi_token, zapi_client_token')
    .eq('id', hotel.id)
    .single()

  if (!hotelData?.zapi_instance_id || !hotelData?.zapi_token) {
    console.warn('[Webhook] Credenciais Z-API não configuradas para o hotel:', hotel.id)
    return
  }

  try {
    await zapiSendText(
      {
        instanceId: hotelData.zapi_instance_id,
        token: hotelData.zapi_token,
        clientToken: hotelData.zapi_client_token || undefined,
      },
      phone,
      message
    )
  } catch (err) {
    console.error('[Webhook] Erro ao enviar mensagem Z-API:', err)
  }

  await saveMessage({
    lead_id: leadId,
    sender: 'bot',
    content: message,
    media_type: 'text',
  })
}

async function notifyTeam(hotelId: string, leadId: string, messagePreview: string): Promise<void> {
  try {
    const supabase = createAdminClient()
    await supabase.from('notifications').insert({
      hotel_id: hotelId,
      type: 'message_received',
      title: 'Nova mensagem de hóspede',
      message: messagePreview.slice(0, 100),
      lead_id: leadId,
    })
  } catch (err) {
    console.error('[Webhook] Erro ao criar notificação:', err)
  }
}

// Z-API envia GET para verificar se o webhook está ativo
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: true, service: 'hotel-agent-webhook' })
}
