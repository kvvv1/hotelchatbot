/**
 * Copilot API — Agente de gestão hoteleira
 * O gestor conversa com a IA no contexto de gestão (não atendimento ao hóspede).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { messages } = await req.json() as { messages: { role: 'user' | 'assistant'; content: string }[] }

    // Get hotel context
    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('hotel_id').eq('id', user.id).single()
    if (!profile?.hotel_id) return NextResponse.json({ error: 'No hotel' }, { status: 403 })

    const hotelId = profile.hotel_id

    // Fetch hotel data in parallel
    const [leadsRes, settingsRes, hotelRes] = await Promise.all([
      admin.from('leads').select('id, guest_name, guest_phone, status, stage, bot_enabled, last_message_at, created_at').eq('hotel_id', hotelId).order('last_message_at', { ascending: false }).limit(50),
      admin.from('bot_settings').select('*').eq('hotel_id', hotelId).single(),
      admin.from('hotels').select('name, hits_api_url, hits_tenant_name').eq('id', hotelId).single(),
    ])

    const leads = leadsRes.data ?? []
    const settings = settingsRes.data
    const hotel = hotelRes.data

    // Compute quick metrics
    const now = Date.now()
    const oneDayMs = 24 * 60 * 60 * 1000
    const total = leads.length
    const booked = leads.filter(l => l.stage === 'booked').length
    const active = leads.filter(l => l.status !== 'closed').length
    const botEnabled = leads.filter(l => l.bot_enabled).length
    const stale = leads.filter(l => l.last_message_at && (now - new Date(l.last_message_at).getTime()) > oneDayMs && l.status !== 'closed').length
    const convRate = total > 0 ? Math.round((booked / total) * 100) : 0

    const systemPrompt = `Você é o Copilot do HotelTalk — assistente de gestão do ${hotel?.name || 'hotel'}.

Você tem acesso aos dados em tempo real do hotel e ajuda o gestor a tomar decisões inteligentes.

DADOS ATUAIS DO HOTEL:
- Total de leads: ${total}
- Leads ativos (não encerrados): ${active}
- Reservas confirmadas: ${booked}
- Taxa de conversão: ${convRate}%
- Leads sem resposta há +24h: ${stale}
- Leads com agente IA ativo: ${botEnabled}
- Agente IA: ${settings?.enabled ? 'ATIVO' : 'DESATIVADO'}
- Integração HITS PMS: ${hotel?.hits_api_url ? 'Configurada' : 'Não configurada'}

LEADS RECENTES (últimos 10):
${leads.slice(0, 10).map(l => `• ${l.guest_name || l.guest_phone} — Estágio: ${l.stage} | Status: ${l.status} | IA: ${l.bot_enabled ? 'sim' : 'não'}`).join('\n')}

SUAS CAPACIDADES:
- Analisar performance do hotel e dos leads
- Identificar leads que precisam de atenção
- Sugerir campanhas de reativação para leads frios
- Orientar estratégias de pricing e disponibilidade
- Explicar métricas e tendências
- Ajudar a configurar e otimizar o agente IA
- Recomendar ações concretas baseadas nos dados

REGRAS DE FORMATAÇÃO (OBRIGATÓRIO):
- NUNCA use ### ou ## ou # para títulos
- NUNCA use * ou _ solto para itálico
- Use **texto** apenas para destacar palavras ou números importantes (negrito)
- Use - para listas com marcadores
- Use 1. 2. 3. para listas numeradas
- Separe seções com uma linha em branco
- Seja direto e objetivo — máximo 300 palavras por resposta
- Quando citar dados numéricos, destaque-os em **negrito**
- Termine sempre com uma ação concreta sugerida ao gestor

Data/hora atual: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`

    const chatMessages: ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map(m => ({ role: m.role, content: m.content } as ChatCompletionMessageParam)),
    ]

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: chatMessages,
      max_tokens: 800,
      temperature: 0.7,
    })

    const reply = response.choices[0]?.message?.content ?? 'Desculpe, não consegui processar sua pergunta.'
    return NextResponse.json({ reply })
  } catch (err) {
    console.error('[Copilot]', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
