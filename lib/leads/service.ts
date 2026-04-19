import { createAdminClient } from '@/lib/supabase/admin'
import type { Lead, LeadStage, LeadStatus } from '@/lib/types/database'
import type { CreateLeadInput, UpdateLeadInput } from './types'

/**
 * Busca ou cria um lead pelo número de telefone.
 * Idempotente: se já existe, retorna o existente.
 */
export async function createOrGetLead(input: CreateLeadInput): Promise<Lead> {
  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('leads')
    .select('*')
    .eq('hotel_id', input.hotel_id)
    .eq('guest_phone', input.guest_phone)
    .single()

  if (existing) return existing as Lead

  const { data, error } = await supabase
    .from('leads')
    .insert({
      hotel_id: input.hotel_id,
      guest_phone: input.guest_phone,
      guest_name: input.guest_name || null,
      status: 'active',
      stage: 'new_contact',
      bot_enabled: true,
      context: {},
      last_message_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw new Error(`Erro ao criar lead: ${error.message}`)
  return data as Lead
}

/**
 * Atualiza o estágio Kanban do lead.
 */
export async function updateStage(leadId: string, stage: LeadStage): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('leads')
    .update({ stage })
    .eq('id', leadId)

  if (error) throw new Error(`Erro ao atualizar estágio: ${error.message}`)
}

/**
 * Atualiza o status operacional do lead.
 */
export async function updateStatus(leadId: string, status: LeadStatus): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('leads')
    .update({ status })
    .eq('id', leadId)

  if (error) throw new Error(`Erro ao atualizar status: ${error.message}`)
}

/**
 * Liga/desliga o bot para este lead (handoff IA ↔ humano).
 */
export async function toggleBotEnabled(leadId: string, enabled: boolean): Promise<void> {
  const supabase = createAdminClient()

  const newStatus: LeadStatus = enabled ? 'active' : 'human_active'

  const { error } = await supabase
    .from('leads')
    .update({ bot_enabled: enabled, status: newStatus })
    .eq('id', leadId)

  if (error) throw new Error(`Erro ao alternar bot: ${error.message}`)
}

/**
 * Atribui um atendente humano ao lead.
 */
export async function assignAttendant(leadId: string, profileId: string | null): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('leads')
    .update({ assigned_to: profileId })
    .eq('id', leadId)

  if (error) throw new Error(`Erro ao atribuir atendente: ${error.message}`)
}

/**
 * Atualiza o contexto (dados coletados pela IA) do lead.
 */
export async function updateContext(leadId: string, contextPatch: Record<string, unknown>): Promise<void> {
  const supabase = createAdminClient()

  // Buscar contexto atual para merge
  const { data: lead } = await supabase
    .from('leads')
    .select('context')
    .eq('id', leadId)
    .single()

  const merged = { ...(lead?.context || {}), ...contextPatch }

  const { error } = await supabase
    .from('leads')
    .update({ context: merged })
    .eq('id', leadId)

  if (error) throw new Error(`Erro ao atualizar contexto: ${error.message}`)
}

/**
 * Atualiza campos diversos do lead.
 */
export async function updateLead(leadId: string, input: UpdateLeadInput): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('leads')
    .update({ ...input })
    .eq('id', leadId)

  if (error) throw new Error(`Erro ao atualizar lead: ${error.message}`)
}

/**
 * Lista leads agrupados por estágio (para Kanban).
 */
export async function getLeadsByStage(hotelId: string): Promise<Record<LeadStage, Lead[]>> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('hotel_id', hotelId)
    .neq('status', 'closed')
    .order('last_message_at', { ascending: false })

  if (error) throw new Error(`Erro ao buscar leads: ${error.message}`)

  const grouped: Record<string, Lead[]> = {}
  for (const lead of (data as Lead[]) || []) {
    if (!grouped[lead.stage]) grouped[lead.stage] = []
    grouped[lead.stage].push(lead)
  }

  return grouped as Record<LeadStage, Lead[]>
}

/**
 * Lista leads ativos para o inbox.
 */
export async function getActiveLeads(hotelId: string): Promise<Lead[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('hotel_id', hotelId)
    .in('status', ['active', 'waiting_guest', 'waiting_human', 'human_active'])
    .order('last_message_at', { ascending: false })

  if (error) throw new Error(`Erro ao buscar leads ativos: ${error.message}`)
  return (data as Lead[]) || []
}

/**
 * Busca um lead por ID.
 */
export async function getLeadById(leadId: string): Promise<Lead | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('leads')
    .select('*')
    .eq('id', leadId)
    .single()

  return (data as Lead) || null
}

/**
 * Registra o timestamp da última mensagem.
 */
export async function touchLastMessageAt(leadId: string): Promise<void> {
  const supabase = createAdminClient()

  await supabase
    .from('leads')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', leadId)
}

/**
 * Salva uma mensagem e atualiza last_message_at do lead.
 */
export async function saveMessage(input: {
  lead_id: string
  sender: 'guest' | 'bot' | 'human'
  content: string
  media_type?: 'text' | 'audio' | 'image' | 'video' | 'document'
  media_url?: string
  transcription?: string
  zapi_message_id?: string
}): Promise<void> {
  const supabase = createAdminClient()

  await supabase.from('messages').insert({
    lead_id: input.lead_id,
    sender: input.sender,
    content: input.content,
    media_type: input.media_type || 'text',
    media_url: input.media_url || null,
    transcription: input.transcription || null,
    zapi_message_id: input.zapi_message_id || null,
  })

  await touchLastMessageAt(input.lead_id)
}

/**
 * Busca o hotel de uma instância Z-API.
 */
export async function getHotelByZapiInstance(instanceId: string): Promise<{ id: string; zapi_token: string; zapi_client_token: string | null } | null> {
  const supabase = createAdminClient()

  const { data } = await supabase
    .from('hotels')
    .select('id, zapi_token, zapi_client_token')
    .eq('zapi_instance_id', instanceId)
    .single()

  return data || null
}
