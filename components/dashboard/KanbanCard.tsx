'use client'

import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Bot, User, Calendar } from 'lucide-react'
import type { Lead } from '@/lib/types/database'

interface KanbanCardProps {
  lead: Lead
}

export function KanbanCard({ lead }: KanbanCardProps) {
  const ctx = lead.context || {}
  const hasContext = ctx.checkIn || ctx.guests || ctx.roomType

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:shadow-md hover:border-blue-200 transition-all">
      {/* Nome e indicador IA/Humano */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="font-medium text-sm text-gray-900 truncate">
          {lead.guest_name || lead.guest_phone}
        </p>
        {lead.bot_enabled ? (
          <Bot className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" aria-label="IA ativa"/>
        ) : (
          <User className="w-3.5 h-3.5 text-orange-500 flex-shrink-0" aria-label="Humano ativo"/>
        )}
      </div>

      {/* Telefone */}
      <p className="text-xs text-gray-400 mb-2">{lead.guest_phone}</p>

      {/* Contexto coletado */}
      {hasContext && (
        <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
          <Calendar className="w-3 h-3" />
          <span>
            {ctx.checkIn ? `${formatDateShort(ctx.checkIn)}` : ''}
            {ctx.guests ? ` · ${ctx.guests} hósp.` : ''}
          </span>
        </div>
      )}

      {/* Tempo desde última mensagem */}
      {lead.last_message_at && (
        <p className="text-xs text-gray-400">
          {formatDistanceToNow(new Date(lead.last_message_at), { locale: ptBR, addSuffix: true })}
        </p>
      )}
    </div>
  )
}

function formatDateShort(dateStr: string): string {
  const [, month, day] = dateStr.split('-')
  return `${day}/${month}`
}
