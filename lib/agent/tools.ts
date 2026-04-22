import type { ChatCompletionTool } from 'openai/resources/chat/completions'
import {
  checkAvailability,
  mapToHitsRooms,
  getRoomingList,
  getFolio,
  checkInReservation,
  createSimpleReservation,
  type HitsCredentials,
} from '@/lib/hits/client'
import { updateStage, updateContext } from '@/lib/leads/service'
import type { HitsRoom } from '@/lib/hits/types'
import { zapiSendImage, type ZapiCredentials } from '@/lib/zapi/client'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  filterRoomsBySearch,
  mapManualInventoryToHitsRooms,
  type ManualInventorySnapshot,
} from '@/lib/manual-inventory'

export const AGENT_TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description:
        'Verifica disponibilidade de quartos no HITS PMS ou no snapshot manual importado para as datas e numero de hospedes informados.',
      parameters: {
        type: 'object',
        properties: {
          checkIn: { type: 'string', description: 'Data de check-in no formato YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'Data de check-out no formato YYYY-MM-DD' },
          guests: { type: 'number', description: 'Numero de hospedes' },
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
      description:
        'Busca as tarifas detalhadas para um tipo de quarto e periodo especificos no HITS PMS ou no snapshot manual importado.',
      parameters: {
        type: 'object',
        properties: {
          roomType: { type: 'string', description: 'Codigo ou nome do tipo de quarto' },
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
      description:
        'Lista todos os tipos de quartos disponiveis no hotel com suas descricoes usando HITS PMS ou snapshot manual importado.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_lead_stage',
      description: 'Atualiza o estagio do lead no Kanban conforme o progresso da conversa.',
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
            description: 'Novo estagio do lead',
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
      description: 'Salva informacoes coletadas do hospede durante a conversa (datas, preferencias, etc).',
      parameters: {
        type: 'object',
        properties: {
          checkIn: { type: 'string', description: 'Data de check-in YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'Data de check-out YYYY-MM-DD' },
          guests: { type: 'number', description: 'Numero de hospedes' },
          roomType: { type: 'string', description: 'Tipo de quarto preferido' },
          guestEmail: { type: 'string', description: 'E-mail do hospede' },
          specialRequests: { type: 'string', description: 'Pedidos especiais' },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_reservation',
      description:
        'Cria uma reserva no HITS PMS com os dados coletados do hospede. Use somente apos confirmar datas, tipo de quarto, numero de hospedes, nome, contato e valor da diaria.',
      parameters: {
        type: 'object',
        properties: {
          checkIn: { type: 'string', description: 'Data de check-in YYYY-MM-DD' },
          checkOut: { type: 'string', description: 'Data de check-out YYYY-MM-DD' },
          roomTypeId: { type: 'number', description: 'ID do tipo de quarto (obtido via check_availability)' },
          ratePlanId: { type: 'number', description: 'ID do plano tarifario (obtido via check_availability)' },
          pax: { type: 'number', description: 'Numero de adultos' },
          chd: { type: 'number', description: 'Numero de criancas (0 se nenhuma)' },
          valueForThePeriod: { type: 'number', description: 'Valor total para o periodo' },
          mainGuestName: { type: 'string', description: 'Nome completo do hospede principal' },
          mainGuestContactCellPhone: { type: 'string', description: 'Celular do hospede (com DDD)' },
          mainGuestContactEmail: { type: 'string', description: 'E-mail do hospede (opcional)' },
        },
        required: ['checkIn', 'checkOut', 'roomTypeId', 'ratePlanId', 'pax', 'chd', 'valueForThePeriod'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_guest_reservation',
      description:
        'Busca reservas existentes de um hospede no HITS PMS pelo nome ou numero do quarto. Use quando o hospede mencionar que ja tem reserva.',
      parameters: {
        type: 'object',
        properties: {
          guestNameOrRoom: { type: 'string', description: 'Nome do hospede ou numero do quarto para buscar' },
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
      description: 'Busca detalhes completos de uma reserva ou folha pelo ID.',
      parameters: {
        type: 'object',
        properties: {
          folioId: { type: 'number', description: 'ID da folha ou reserva obtido via lookup_guest_reservation' },
        },
        required: ['folioId'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'transfer_to_human',
      description:
        'Transfere o atendimento para um humano quando necessario. Use quando o hospede pedir, houver reclamacao ou a situacao for complexa.',
      parameters: {
        type: 'object',
        properties: {
          reason: { type: 'string', description: 'Motivo da transferencia' },
        },
        required: ['reason'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'send_photos',
      description:
        'Envia fotos do hotel para o hospede via WhatsApp. Sempre pergunte qual categoria o hospede quer ver antes de enviar.',
      parameters: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: ['standard', 'deluxe', 'suite', 'pool', 'restaurant', 'common', 'exterior', 'general'],
            description: 'Categoria das fotos a enviar (tipo de quarto ou area do hotel)',
          },
        },
        required: ['category'],
      },
    },
  },
]

export interface ToolExecutionContext {
  leadId: string
  hotelId?: string
  hitsCredentials?: HitsCredentials
  manualInventorySnapshot?: ManualInventorySnapshot | null
  zapiCredentials?: ZapiCredentials
  guestPhone?: string
  transferRequested?: boolean
}

function getManualRooms(ctx: ToolExecutionContext): HitsRoom[] {
  return mapManualInventoryToHitsRooms(ctx.manualInventorySnapshot)
}

async function getAvailabilityRooms(args: Record<string, unknown>, ctx: ToolExecutionContext) {
  if (ctx.hitsCredentials) {
    const rawItems = await checkAvailability(ctx.hitsCredentials, {
      checkIn: String(args.checkIn),
      checkOut: String(args.checkOut),
    })

    return {
      rooms: mapToHitsRooms(rawItems),
      source: 'hits' as const,
    }
  }

  const manualRooms = getManualRooms(ctx)
  if (manualRooms.length === 0) {
    throw new Error('Integracao HITS PMS nao configurada e nenhum snapshot manual foi importado.')
  }

  return {
    rooms: filterRoomsBySearch(manualRooms, String(args.roomType || '')),
    source: 'manual' as const,
  }
}

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<string> {
  try {
    switch (toolName) {
      case 'check_availability': {
        const { rooms, source } = await getAvailabilityRooms(args, ctx)

        await updateStage(ctx.leadId, 'checking_availability')
        await updateContext(ctx.leadId, {
          checkIn: args.checkIn,
          checkOut: args.checkOut,
          guests: args.guests,
          hitsRoomOptions: rooms
            .filter(room => room.available)
            .map(room => ({
              roomType: room.type,
              roomName: room.name,
              rate: room.rate,
              available: room.available,
            })),
        })

        return JSON.stringify({
          rooms,
          count: rooms.filter(room => room.available).length,
          source,
        })
      }

      case 'get_rates': {
        const { rooms, source } = await getAvailabilityRooms(args, ctx)
        const filteredRooms = filterRoomsBySearch(rooms, String(args.roomType || ''))

        return JSON.stringify({
          rates: filteredRooms.map(room => ({
            roomType: room.type,
            roomName: room.name,
            rate: room.rate,
            currency: room.currency,
          })),
          source,
        })
      }

      case 'get_room_types': {
        let rooms: HitsRoom[] = []
        let source: 'hits' | 'manual' = 'manual'

        if (ctx.hitsCredentials) {
          const today = new Date().toISOString().split('T')[0]
          const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
          const rawItems = await checkAvailability(ctx.hitsCredentials, { checkIn: today, checkOut: nextMonth })
          rooms = mapToHitsRooms(rawItems)
          source = 'hits'
        } else {
          rooms = getManualRooms(ctx)
          if (rooms.length === 0) {
            throw new Error('Integracao HITS PMS nao configurada e nenhum snapshot manual foi importado.')
          }
        }

        const unique = [
          ...new Map(
            rooms.map(room => [
              room.code,
              {
                code: room.code,
                name: room.name,
                description: room.name,
                maxGuests: room.maxGuests,
              },
            ])
          ).values(),
        ]

        return JSON.stringify({ roomTypes: unique, source })
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
          return JSON.stringify({
            error: 'Modo manual ativo: posso consultar disponibilidade, mas a criacao automatica de reserva exige a integracao oficial do PMS.',
          })
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
          mainGuestContactCellPhone: args.mainGuestContactCellPhone
            ? String(args.mainGuestContactCellPhone)
            : undefined,
          mainGuestContactEmail: args.mainGuestContactEmail ? String(args.mainGuestContactEmail) : undefined,
        })

        await updateStage(ctx.leadId, 'booked')
        await updateContext(ctx.leadId, { voucher: result.voucher, reservationCreated: true })

        return JSON.stringify({
          success: true,
          voucher: result.voucher,
          warnings: result.warningMessages,
        })
      }

      case 'lookup_guest_reservation': {
        if (!ctx.hitsCredentials) {
          return JSON.stringify({
            error: 'Modo manual ativo: a busca de reservas existentes exige a integracao oficial do PMS.',
          })
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
          return JSON.stringify({
            error: 'Modo manual ativo: os detalhes completos da reserva exigem a integracao oficial do PMS.',
          })
        }

        const folio = await getFolio(ctx.hitsCredentials, Number(args.folioId))
        return JSON.stringify({ folio })
      }

      case 'checkin_reservation': {
        if (!ctx.hitsCredentials) {
          return JSON.stringify({
            error: 'Modo manual ativo: o check-in automatico exige a integracao oficial do PMS.',
          })
        }

        const result = await checkInReservation(ctx.hitsCredentials, Number(args.reservationId))
        return JSON.stringify({ success: true, result })
      }

      case 'transfer_to_human': {
        ctx.transferRequested = true
        return JSON.stringify({ success: true, reason: args.reason })
      }

      case 'send_photos': {
        if (!ctx.zapiCredentials || !ctx.guestPhone || !ctx.hotelId) {
          return JSON.stringify({ error: 'Configuracao de WhatsApp nao encontrada' })
        }

        const category = String(args.category || 'general')
        const supabase = createAdminClient()
        const { data: photos } = await supabase
          .from('hotel_media')
          .select('url, caption')
          .eq('hotel_id', ctx.hotelId)
          .eq('category', category)
          .limit(5)

        if (!photos || photos.length === 0) {
          return JSON.stringify({ error: 'Nenhuma foto encontrada para esta categoria', category })
        }

        let sentCount = 0
        for (const photo of photos) {
          try {
            await zapiSendImage(ctx.zapiCredentials, ctx.guestPhone, photo.url, photo.caption || '')
            sentCount += 1
          } catch {
            // Continua enviando as demais imagens.
          }
        }

        return JSON.stringify({ success: true, sent: sentCount, total: photos.length, category })
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
