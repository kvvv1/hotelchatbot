import type { Lead, LeadStage, LeadStatus } from '@/lib/types/database'

export type { Lead, LeadStage, LeadStatus }

export interface CreateLeadInput {
  hotel_id: string
  guest_phone: string
  guest_name?: string
}

export interface UpdateLeadInput {
  guest_name?: string
  status?: LeadStatus
  stage?: LeadStage
  bot_enabled?: boolean
  context?: Record<string, unknown>
  assigned_to?: string | null
  notes?: string
  tags?: string[]
  last_message_at?: string
}

export interface LeadWithMessages extends Lead {
  messages?: import('@/lib/types/database').Message[]
}
