/**
 * Agent Engine
 * Orquestra o GPT-4o Mini com tool calling para conduzir
 * atendimentos hoteleiros de forma humanizada e autônoma.
 */

import OpenAI from 'openai'
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildSystemPrompt, buildMessagesContext } from './prompts'
import { AGENT_TOOLS, executeTool, type ToolExecutionContext } from './tools'
import { toggleBotEnabled, updateStage, updateLead } from '@/lib/leads/service'
import type { Lead, BotSettings, Message } from '@/lib/types/database'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const MAX_TOOL_ITERATIONS = 5

export interface AgentResponse {
  message: string
  transferToHuman: boolean
}

/**
 * Processa uma mensagem do hóspede e retorna a resposta do agente.
 */
export async function processMessage(
  lead: Lead,
  incomingText: string
): Promise<AgentResponse> {
  const supabase = createAdminClient()

  // Buscar configurações do bot
  const { data: settingsData } = await supabase
    .from('bot_settings')
    .select('*')
    .eq('hotel_id', lead.hotel_id)
    .single()

  const settings = settingsData as BotSettings | null

  if (!settings?.enabled) {
    return { message: '', transferToHuman: false }
  }

  // Buscar credenciais HITS PMS completas do hotel
  const { data: hotelData } = await supabase
    .from('hotels')
    .select('hits_api_url, hits_api_key, hits_tenant_name, hits_property_code, hits_client_id')
    .eq('id', lead.hotel_id)
    .single()

  const hitsCredentials =
    hotelData?.hits_api_url &&
    hotelData?.hits_api_key &&
    hotelData?.hits_tenant_name &&
    hotelData?.hits_property_code
      ? {
          apiUrl: hotelData.hits_api_url as string,
          apiKey: hotelData.hits_api_key as string,
          tenantName: hotelData.hits_tenant_name as string,
          propertyCode: hotelData.hits_property_code as number,
          clientId: (hotelData.hits_client_id as string) || '',
        }
      : undefined

  // Buscar histórico de mensagens
  const { data: messagesData } = await supabase
    .from('messages')
    .select('sender, content')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: true })
    .limit(30)

  const history = (messagesData as Pick<Message, 'sender' | 'content'>[] | null) || []

  // Construir histórico no formato OpenAI
  const conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }> = history.map(msg => ({
    role: msg.sender === 'guest' ? 'user' : 'assistant',
    content: msg.content,
  }))

  // System prompt
  const systemPrompt = buildSystemPrompt(settings, lead.guest_name).replace(
    '{{CURRENT_DATETIME}}',
    new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })
  )

  // Atualizar estágio para "em atendimento" se ainda for novo
  if (lead.stage === 'new_contact') {
    await updateStage(lead.id, 'in_attendance')
  }

  // Montar mensagens para a API
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...buildMessagesContext(conversationHistory),
    { role: 'user', content: incomingText },
  ]

  const toolCtx: ToolExecutionContext = { leadId: lead.id, hitsCredentials, transferRequested: false }

  // Loop de tool calling
  let iterations = 0
  while (iterations < MAX_TOOL_ITERATIONS) {
    iterations++

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.7,
      max_tokens: 500,
    })

    const choice = response.choices[0]
    const assistantMessage = choice.message

    messages.push(assistantMessage as ChatCompletionMessageParam)

    // Se o modelo quer usar tools
    if (choice.finish_reason === 'tool_calls' && assistantMessage.tool_calls) {
      const toolResults: ChatCompletionMessageParam[] = []

      for (const toolCall of assistantMessage.tool_calls) {
        // Narrowing: apenas tool_calls com type 'function' têm .function
        if (toolCall.type !== 'function') continue

        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse((toolCall as { type: 'function'; function: { name: string; arguments: string }; id: string }).function.arguments)
        } catch {
          args = {}
        }

        const fn = (toolCall as { type: 'function'; function: { name: string; arguments: string }; id: string }).function
        const result = await executeTool(fn.name, args, toolCtx)

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }

      messages.push(...toolResults)
      continue
    }

    // Resposta final do modelo
    const finalMessage = assistantMessage.content?.trim() || ''

    // Se transferência foi solicitada via tool
    if (toolCtx.transferRequested) {
      await toggleBotEnabled(lead.id, false)
      await updateStage(lead.id, 'negotiating')
      return {
        message: finalMessage || 'Um momento, vou te conectar com um de nossos atendentes. Já estou avisando a equipe!',
        transferToHuman: true,
      }
    }

    return { message: finalMessage, transferToHuman: false }
  }

  // Fallback se atingiu limite de iterações
  return {
    message: 'Desculpe, tive um problema técnico. Um atendente vai te ajudar em instantes!',
    transferToHuman: true,
  }
}

/**
 * Verifica se o bot deve responder (considera horário de funcionamento).
 */
export function shouldBotRespond(settings: BotSettings | null): boolean {
  if (!settings?.enabled) return false
  if (!settings.working_hours?.enabled) return true

  const now = new Date()
  const tz = settings.working_hours.timezone || 'America/Sao_Paulo'
  const localNow = new Date(now.toLocaleString('en-US', { timeZone: tz }))

  const dayOfWeek = localNow.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6
  const currentTime = `${String(localNow.getHours()).padStart(2, '0')}:${String(localNow.getMinutes()).padStart(2, '0')}`

  const dayConfig = settings.working_hours.days?.find(d => d.day === dayOfWeek)
  if (!dayConfig?.enabled) return false

  return currentTime >= dayConfig.start && currentTime <= dayConfig.end
}
