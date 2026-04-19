'use client'

import { Calendar, Users, BedDouble, Mail, MessageSquare } from 'lucide-react'
import type { Lead } from '@/lib/types/database'

const STAGE_LABELS: Record<string, string> = {
  new_contact: 'Novo contato',
  in_attendance: 'Em atendimento',
  checking_availability: 'Consultando disponib.',
  proposal_sent: 'Proposta enviada',
  negotiating: 'Em negociação',
  booking_in_progress: 'Reserva em andamento',
  booked: 'Reserva confirmada',
  not_converted: 'Não convertido',
}

const STAGE_COLORS: Record<string, string> = {
  new_contact: 'bg-gray-100 text-gray-700',
  in_attendance: 'bg-blue-100 text-blue-700',
  checking_availability: 'bg-yellow-100 text-yellow-700',
  proposal_sent: 'bg-purple-100 text-purple-700',
  negotiating: 'bg-orange-100 text-orange-700',
  booking_in_progress: 'bg-indigo-100 text-indigo-700',
  booked: 'bg-green-100 text-green-700',
  not_converted: 'bg-red-100 text-red-700',
}

interface LeadContextPanelProps {
  lead: Lead
}

export function LeadContextPanel({ lead }: LeadContextPanelProps) {
  const ctx = lead.context || {}

  function formatDate(dateStr?: string) {
    if (!dateStr) return '—'
    const [year, month, day] = dateStr.split('-')
    return `${day}/${month}/${year}`
  }

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col h-full">
      <div className="px-5 py-4 border-b border-gray-200">
        <h3 className="font-semibold text-gray-900 text-sm">Dados do Lead</h3>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Estágio */}
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Estágio</p>
          <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${STAGE_COLORS[lead.stage] || 'bg-gray-100 text-gray-700'}`}>
            {STAGE_LABELS[lead.stage] || lead.stage}
          </span>
        </div>

        {/* Informações coletadas */}
        <div>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Informações coletadas pela IA</p>
          <div className="space-y-3">
            {ctx.checkIn && (
              <div className="flex items-start gap-2.5">
                <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Check-in / Check-out</p>
                  <p className="text-sm text-gray-900 font-medium">
                    {formatDate(ctx.checkIn)} → {formatDate(ctx.checkOut)}
                  </p>
                </div>
              </div>
            )}

            {ctx.guests && (
              <div className="flex items-start gap-2.5">
                <Users className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Hóspedes</p>
                  <p className="text-sm text-gray-900 font-medium">{ctx.guests} pessoa(s)</p>
                </div>
              </div>
            )}

            {ctx.roomType && (
              <div className="flex items-start gap-2.5">
                <BedDouble className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Tipo de quarto</p>
                  <p className="text-sm text-gray-900 font-medium">{ctx.roomType}</p>
                </div>
              </div>
            )}

            {ctx.guestEmail && (
              <div className="flex items-start gap-2.5">
                <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">E-mail</p>
                  <p className="text-sm text-gray-900 font-medium">{ctx.guestEmail}</p>
                </div>
              </div>
            )}

            {ctx.specialRequests && (
              <div className="flex items-start gap-2.5">
                <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-500">Pedidos especiais</p>
                  <p className="text-sm text-gray-900">{ctx.specialRequests}</p>
                </div>
              </div>
            )}

            {!ctx.checkIn && !ctx.guests && !ctx.roomType && (
              <p className="text-sm text-gray-400 italic">Nenhuma informação coletada ainda</p>
            )}
          </div>
        </div>

        {/* Opções de quartos encontradas */}
        {ctx.hitsRoomOptions && ctx.hitsRoomOptions.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-3">Quartos disponíveis (HITS)</p>
            <div className="space-y-2">
              {ctx.hitsRoomOptions.map((room, i) => (
                <div key={i} className="p-2.5 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-900">{room.roomName}</p>
                  <p className="text-xs text-gray-500">R$ {room.rate?.toFixed(2)}/noite</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notas */}
        {lead.notes && (
          <div>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-2">Notas</p>
            <p className="text-sm text-gray-700 bg-yellow-50 p-3 rounded-lg">{lead.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
