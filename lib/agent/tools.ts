import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import { checkAvailability, mapToHitsRooms, getRoomingList, getFolio, checkInReservation, createSimpleReservation, type HitsCredentials } from '@/lib/hits/client'
import { updateStage, updateContext } from '@/lib/leads/service'
import type { HitsRoom } from '@/lib/hits/types'

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Verifica disponibilidade de quartos no HITS PMS para as datas e número de hóspedes informados.',
      parameters: {
        type: 'object',
        properties: {
          checkIn: { type: 'string', description: 'Data de check-in no formato YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'Data de check-out no formato YYYY-MM-DD' },
          guests: { type: 'number', description: 'Número de hóspedes' },
          roomType: { type: 'string', description: 'Tipo de quarto preferido (opcional)' },
        },
        required: ['checkIn', 'checkOut', 'guests'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_rates',
      description: 'Busca as tarifas detalhadas para um tipo de quarto e período específicos.',
      parameters: {
        type: 'object',
        properties: {
          roomType: { type: 'string', description: 'Código ou nome do tipo de quarto' },
          checkIn: { type: 'string', description: 'Data de check-in no formato YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'Data de check-out no formato YYYY-MM-DD' },
        },
        required: ['roomType', 'checkIn', 'checkOut'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_room_types',
      description: 'Lista todos os tipos de quartos disponíveis no hotel com suas descrições.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_stage',
      description: 'Atualiza o estágio do lead no Kanban conforme o progresso da conversa.',
      parameters: {
        type: 'object',
        properties: {
          stage: {
            type: 'string',
            enum: [
              'new_contact',
              'in_attendance',
              'checking_availability',
              'proposal_sent',
              'negotiating',
              'booking_in_progress',
              'booked',
              'not_converted',
            ],
            description: 'Novo estágio do lead',
          },
        },
        required: ['stage'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'collect_guest_info',
      description: 'Salva informações coletadas do hóspede durante a conversa (datas, preferências, etc).',
      parameters: {
        type: 'object',
        properties: {
          checkIn: { type: 'string', description: 'Data de check-in YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'Data de check-out YYYY-MM-DD' },
          guests: { type: 'number', description: 'Número de hóspedes' },
          roomType: { type: 'string', description: 'Tipo de quarto preferido' },
          guestEmail: { type: 'string', description: 'E-mail do hóspede' },
          specialRequests: { type: 'string', description: 'Pedidos especiais' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reservation',
      description: 'Cria uma reserva no HITS PMS com os dados coletados do hóspede. Use somente após confirmar: datas, tipo de quarto, número de hóspedes, nome e contato do hóspede principal, e o valor da diária.',
      parameters: {
        type: 'object',
        properties: {
          checkIn: { type: 'string', description: 'Data de check-in YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'Data de check-out YYYY-MM-DD' },
          roomTypeId: { type: 'number', description: 'ID do tipo de quarto (obtido via check_availability)' },
          ratePlanId: { type: 'number', description: 'ID do plano tarifário (obtido via check_availability)' },
          pax: { type: 'number', description: 'Número de adultos' },
          chd: { type: 'number', description: 'Número de crianças (0 se nenhuma)' },
          valueForThePeriod: { type: 'number', description: 'Valor total para o período (diárias × número de noites)' },
          mainGuestName: { type: 'string', description: 'Nome completo do hóspede principal' },
          mainGuestContactCellPhone: { type: 'string', description: 'Celular do hóspede (com DDD)' },
          mainGuestContactEmail: { type: 'string', description: 'E-mail do hóspede (opcional)' },
        },
        required: ['checkIn', 'checkOut', 'roomTypeId', 'ratePlanId', 'pax', 'chd', 'valueForThePeriod'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_guest_reservation',
      description: 'Busca reservas existentes de um hóspede no HITS PMS pelo nome ou número do quarto. Use quando o hóspede mencionar que já tem reserva e quiser confirmar detalhes ou fazer check-in.',
      parameters: {
        type: 'object',
        properties: {
          guestNameOrRoom: { type: 'string', description: 'Nome do hóspede ou número do quarto para buscar' },
          checkInDate: { type: 'string', description: 'Data de check-in para filtrar (YYYY-MM-DD, opcional)' },
        },
        required: ['guestNameOrRoom'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_reservation_details',
      description: 'Busca detalhes completos de uma reserva/folha pelo ID. Use após lookup_guest_reservation para ver consumos, valor total, status.',
      parameters: {
        type: 'object',
        properties: {
          folioId: { type: 'number', description: 'ID da folha/reserva obtido via lookup_guest_reservation' },
        },
        required: ['folioId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_to_human',
      description: 'Transfere o atendimento para um humano quando necessário. Use quando: o hóspede pedir, houver reclamação, ou a situação for complexa.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo da transferência' },
        },
        required: ['reason'],
      },
    },
  },
]

export interface ToolExecutionContext {
  leadId: string
  hitsCredentials?: HitsCredentials
  transferRequested?: boolean
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<string> {
  try {
    switch (toolName) {
      case 'check_availability': {
        if (!ctx.hitsCredentials) {
          return JSON.stringify({ error: 'Integração HITS PMS não configurada para este hotel' })
        }
        // Retorno real da API HITS PMS: HitsAvailabilityItem[]
        const rawItems = await checkAvailability(ctx.hitsCredentials, {
          checkIn: String(args.checkIn),
          checkOut: String(args.checkOut),
        })
        // Mapeia para formato interno
        const rooms: HitsRoom[] = mapToHitsRooms(rawItems)
        await updateStage(ctx.leadId, 'checking_availability')
        await updateContext(ctx.leadId, {
          checkIn: args.checkIn,
          checkOut: args.checkOut,
          guests: args.guests,
          hitsRoomOptions: rooms.filter(r => r.available).map(r => ({
            roomType: r.type,
            roomName: r.name,
            rate: r.rate,
            available: r.available,
          })),
        })
        return JSON.stringify({ rooms, count: rooms.filter(r => r.available).length })
      }

      case 'get_rates': {
        // HITS PMS não tem endpoint de tarifas separado — redireciona para availability
        if (!ctx.hitsCredentials) {
          return JSON.stringify({ error: 'Integração HITS PMS não configurada para este hotel' })
        }
        const rawItems = await checkAvailability(ctx.hitsCredentials, {
          checkIn: String(args.checkIn),
          checkOut: String(args.checkOut),
        })
        const rooms = mapToHitsRooms(rawItems)
        return JSON.stringify({ rates: rooms.map(r => ({ roomType: r.type, roomName: r.name, rate: r.rate, currency: r.currency })) })
      }

      case 'get_room_types': {
        // HITS PMS não tem endpoint de tipos de quarto separado — usa availability com range amplo
        if (!ctx.hitsCredentials) {
          return JSON.stringify({ error: 'Integração HITS PMS não configurada para este hotel' })
        }
        const today = new Date().toISOString().split('T')[0]
        const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        const rawItems = await checkAvailability(ctx.hitsCredentials, { checkIn: today, checkOut: nextMonth })
        const rooms = mapToHitsRooms(rawItems)
        const unique = [...new Map(rooms.map(r => [r.code, { code: r.code, name: r.name, description: r.name, maxGuests: r.maxGuests }])).values()]
        return JSON.stringify({ roomTypes: unique })
      }

      case 'update_lead_stage': {
        await updateStage(ctx.leadId, args.stage as import('@/lib/types/database').LeadStage)
        return JSON.stringify({ success: true, stage: args.stage })
      }

      case 'collect_guest_info': {
        const patch: Record<string, unknown> = {}
        if (args.checkIn) patch.checkIn = args.checkIn
        if (args.checkOut) patch.checkOut = args.checkOut
        if (args.guests) patch.guests = args.guests
        if (args.roomType) patch.roomType = args.roomType
        if (args.guestEmail) patch.guestEmail = args.guestEmail
        if (args.specialRequests) patch.specialRequests = args.specialRequests
        await updateContext(ctx.leadId, patch)
        return JSON.stringify({ success: true, saved: Object.keys(patch) })
      }

      case 'create_reservation': {
        if (!ctx.hitsCredentials) {
          return JSON.stringify({ error: 'Integração HITS PMS não configurada para este hotel' })
        }
        const result = await createSimpleReservation(ctx.hitsCredentials, {
          pax: Number(args.pax),
          chd: Number(args.chd ?? 0),
          roomQuantity: 1,
          roomTypeId: Number(args.roomTypeId),
          ratePlanId: Number(args.ratePlanId),
          checkIn: String(args.checkIn),
          checkOut: String(args.checkOut),
          valueForThePeriod: Number(args.valueForThePeriod),
          mainGuestName: args.mainGuestName ? String(args.mainGuestName) : undefined,
          mainGuestContactCellPhone: args.mainGuestContactCellPhone ? String(args.mainGuestContactCellPhone) : undefined,
          mainGuestContactEmail: args.mainGuestContactEmail ? String(args.mainGuestContactEmail) : undefined,
        })
        await updateStage(ctx.leadId, 'booked')
        await updateContext(ctx.leadId, { voucher: result.voucher, reservationCreated: true })
        return JSON.stringify({ success: true, voucher: result.voucher, warnings: result.warningMessages })
      }

      case 'lookup_guest_reservation': {
        if (!ctx.hitsCredentials) {
          return JSON.stringify({ error: 'Integração HITS PMS não configurada para este hotel' })
        }
        const guests = await getRoomingList(ctx.hitsCredentials, {
          guestNameOrRoom: String(args.guestNameOrRoom),
          checkInDate: args.checkInDate ? String(args.checkInDate) : undefined,
          mainGuestOnly: true,
          size: 10,
        })
        return JSON.stringify({ guests, count: guests.length })
      }

      case 'get_reservation_details': {
        if (!ctx.hitsCredentials) {
          return JSON.stringify({ error: 'Integração HITS PMS não configurada para este hotel' })
        }
        const folio = await getFolio(ctx.hitsCredentials, Number(args.folioId))
        return JSON.stringify({ folio })
      }

      case 'checkin_reservation': {
        if (!ctx.hitsCredentials) {
          return JSON.stringify({ error: 'Integração HITS PMS não configurada para este hotel' })
        }
        const result = await checkInReservation(ctx.hitsCredentials, Number(args.reservationId))
        return JSON.stringify({ success: true, result })
      }

      case 'transfer_to_human': {
        ctx.transferRequested = true
        return JSON.stringify({ success: true, reason: args.reason })
      }

      default:
        return JSON.stringify({ error: `Tool desconhecida: ${toolName}` })
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error(`[Agent Tools] Error in ${toolName}:`, error)
    return JSON.stringify({ error: msg })
  }
}
