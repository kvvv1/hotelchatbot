import type { ManualInventorySnapshot } from '@/lib/manual-inventory'

// ============================================================
// Tipos TypeScript do schema do banco de dados
// ============================================================

export type LeadStatus = 'active' | 'waiting_guest' | 'waiting_human' | 'human_active' | 'closed'

export type LeadStage =
  | 'new_contact'
  | 'in_attendance'
  | 'checking_availability'
  | 'proposal_sent'
  | 'negotiating'
  | 'booking_in_progress'
  | 'booked'
  | 'not_converted'

export type MessageSender = 'guest' | 'bot' | 'human'
export type MediaType = 'text' | 'audio' | 'image' | 'video' | 'document'
export type UserRole = 'admin' | 'attendant'

export type NotificationType =
  | 'new_lead'
  | 'lead_waiting_human'
  | 'human_requested'
  | 'lead_updated'
  | 'message_received'

// Contexto coletado pela IA durante a conversa
export interface LeadContext {
  checkIn?: string       // YYYY-MM-DD
  checkOut?: string      // YYYY-MM-DD
  guests?: number
  roomType?: string
  guestEmail?: string
  specialRequests?: string
  budgetRange?: string
  // Dados já enviados ao HITS PMS
  hitsRoomOptions?: HitsRoomOption[]
  hitsReservationId?: string
}

export interface HitsRoomOption {
  roomType: string
  roomName: string
  rate: number
  available: boolean
}

export interface Hotel {
  id: string
  name: string
  zapi_instance_id: string | null
  zapi_token: string | null
  zapi_client_token: string | null
  manual_inventory_snapshot?: ManualInventorySnapshot | null
  manual_inventory_updated_at?: string | null
  manual_inventory_source?: string | null
  created_at: string
}

export interface Profile {
  id: string
  hotel_id: string | null
  full_name: string
  role: UserRole
  created_at: string
}

export interface Lead {
  id: string
  hotel_id: string
  guest_phone: string
  guest_name: string | null
  status: LeadStatus
  stage: LeadStage
  bot_enabled: boolean
  context: LeadContext
  assigned_to: string | null
  notes: string | null
  tags: string[]
  last_message_at: string | null
  created_at: string
}

export interface Message {
  id: string
  lead_id: string
  sender: MessageSender
  content: string
  media_type: MediaType
  media_url: string | null
  transcription: string | null
  zapi_message_id: string | null
  created_at: string
}

export interface BotSettings {
  id: string
  hotel_id: string
  enabled: boolean
  system_prompt: string | null
  hotel_name: string
  hotel_description: string | null
  working_hours: WorkingHoursConfig
  auto_transfer_after_messages: number
  quick_templates: string[]
  created_at: string
  updated_at: string
}

export interface WorkingHoursConfig {
  enabled: boolean
  timezone: string
  days: WorkingHoursDay[]
}

export interface WorkingHoursDay {
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6
  enabled: boolean
  start: string
  end: string
}

export interface Notification {
  id: string
  hotel_id: string
  user_id: string | null
  type: NotificationType
  title: string
  message: string
  lead_id: string | null
  read: boolean
  read_at: string | null
  created_at: string
}

// Joined types (com dados relacionados)
export interface LeadWithProfile extends Lead {
  assignee?: Pick<Profile, 'id' | 'full_name'>
}

export interface MessageWithLead extends Message {
  lead?: Pick<Lead, 'id' | 'guest_name' | 'guest_phone'>
}
