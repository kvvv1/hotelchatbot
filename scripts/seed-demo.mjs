import fs from 'fs'
import path from 'path'
import { createClient } from '@supabase/supabase-js'

function loadEnvFile() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) return

  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    if (!process.env[key]) process.env[key] = value
  }
}

function isoHoursAgo(hoursAgo) {
  return new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString()
}

function isoDaysAgo(daysAgo, hour = 12, minute = 0) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - daysAgo)
  date.setUTCHours(hour, minute, 0, 0)
  return date.toISOString()
}

loadEnvFile()

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !serviceRoleKey) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function getHotelContext(explicitHotelId) {
  if (explicitHotelId) {
    const { data: hotel, error } = await supabase.from('hotels').select('id,name').eq('id', explicitHotelId).single()
    if (error || !hotel) throw new Error(`Hotel not found: ${explicitHotelId}`)
    const { data: adminProfile } = await supabase
      .from('profiles')
      .select('id,full_name')
      .eq('hotel_id', hotel.id)
      .eq('role', 'admin')
      .limit(1)
      .single()

    if (!adminProfile) throw new Error('No admin profile found for the selected hotel')
    return { hotel, adminProfile }
  }

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id,hotel_id,full_name,role')
    .not('hotel_id', 'is', null)
    .order('created_at', { ascending: true })
    .limit(1)

  if (error || !profiles?.length) throw new Error('No profile with hotel_id found')

  const adminProfile = profiles[0]
  const { data: hotel, error: hotelError } = await supabase
    .from('hotels')
    .select('id,name')
    .eq('id', adminProfile.hotel_id)
    .single()

  if (hotelError || !hotel) throw new Error('Hotel not found for first profile')
  return { hotel, adminProfile }
}

function buildLeadSeed(hotelId, adminId) {
  const leads = [
    {
      guest_phone: '5511991100101',
      guest_name: 'Juliana Castro',
      status: 'human_active',
      stage: 'booking_in_progress',
      bot_enabled: false,
      assigned_to: adminId,
      notes: 'Caso de demonstração: IA qualificou e humano assumiu para fechamento.',
      tags: ['casal', 'fim_de_semana', 'alto_potencial'],
      context: {
        checkIn: '2026-05-15',
        checkOut: '2026-05-18',
        guests: 2,
        roomType: 'Quarto Deluxe',
      },
      created_at: isoDaysAgo(0, 13, 10),
      last_message_at: isoHoursAgo(1.5),
      messages: [
        ['guest', 'Oi, tudo bem? Gostaria de ver um quarto para casal no próximo fim de semana.', isoHoursAgo(2.2)],
        ['bot', 'Oi, Juliana! Claro, posso te ajudar. Para qual data de entrada e saída você quer consultar?', isoHoursAgo(2.15)],
        ['guest', 'De sexta a segunda, para 2 pessoas.', isoHoursAgo(2.1)],
        ['bot', 'Perfeito. Temos opção de Quarto Deluxe a partir de R$ 459 a diária, com ambiente bem gostoso para descanso e acesso à área de lazer, piscina e trilhas.', isoHoursAgo(1.8)],
        ['bot', 'Se quiser, já posso te adiantar mais fotos e deixar essa opção separada para você.', isoHoursAgo(1.5)],
        ['guest', 'Gostei! Consigo fazer o pagamento de entrada agora e tirar uma dúvida sobre cancelamento?', isoHoursAgo(1.2)],
        ['human', 'Oi, Juliana! Eu assumi seu atendimento por aqui para te explicar certinho as condições de pagamento e cancelamento. Se quiser, já seguimos com a sua pré-reserva.', isoHoursAgo(0.9)],
      ],
    },
    {
      guest_phone: '5511982200202',
      guest_name: 'Rafael Mendes',
      status: 'human_active',
      stage: 'booking_in_progress',
      bot_enabled: false,
      assigned_to: adminId,
      notes: 'Quer fechar hoje, pediu apoio humano para pagamento por pix e política de cancelamento.',
      tags: ['urgente', 'pagamento', 'familia'],
      context: {
        checkIn: '2026-05-03',
        checkOut: '2026-05-05',
        guests: 3,
        roomType: 'Suite Familia',
      },
      created_at: isoDaysAgo(0, 10, 30),
      last_message_at: isoHoursAgo(0.6),
      messages: [
        ['guest', 'Bom dia! Vocês têm opção para casal com uma criança pequena?', isoHoursAgo(4)],
        ['bot', 'Temos sim. Para eu te indicar a melhor opção, me confirma as datas e a quantidade total de hóspedes?', isoHoursAgo(3.9)],
        ['guest', 'Seríamos 3 pessoas, de sábado para segunda.', isoHoursAgo(3.7)],
        ['bot', 'Perfeito. A Suite Familia atende bem esse perfil e está saindo por R$ 619 a diária.', isoHoursAgo(3.5)],
        ['guest', 'Consigo pagar metade agora e metade no check-in?', isoHoursAgo(1)],
        ['human', 'Oi, Rafael! Assumi seu atendimento aqui. Vou te explicar certinho as opções de pagamento e já seguimos com a reserva.', isoHoursAgo(0.6)],
      ],
    },
    {
      guest_phone: '5511973300303',
      guest_name: 'Patricia Nunes',
      status: 'active',
      stage: 'checking_availability',
      bot_enabled: true,
      assigned_to: null,
      notes: 'Grupo de amigas avaliando feriado.',
      tags: ['grupo', 'feriado'],
      context: {
        checkIn: '2026-06-03',
        checkOut: '2026-06-06',
        guests: 4,
      },
      created_at: isoDaysAgo(1, 16, 15),
      last_message_at: isoHoursAgo(5),
      messages: [
        ['guest', 'Olá! Vocês têm algo para 4 pessoas no feriado?', isoHoursAgo(6)],
        ['bot', 'Oi! Temos algumas opções sim. Você já tem as datas certinhas para eu consultar?', isoHoursAgo(5.8)],
        ['guest', 'Do dia 3 ao dia 6.', isoHoursAgo(5.4)],
        ['bot', 'Perfeito. Estou verificando as melhores opções para esse período e já te passo um resumo.', isoHoursAgo(5)],
      ],
    },
    {
      guest_phone: '5511964400404',
      guest_name: 'Fernando e Ana',
      status: 'closed',
      stage: 'booked',
      bot_enabled: false,
      assigned_to: adminId,
      notes: 'Reserva confirmada para aniversario de casamento.',
      tags: ['reservado', 'casal', 'aniversario'],
      context: {
        checkIn: '2026-05-09',
        checkOut: '2026-05-11',
        guests: 2,
        roomType: 'Chale Natureza',
      },
      created_at: isoDaysAgo(2, 14, 20),
      last_message_at: isoHoursAgo(10),
      messages: [
        ['guest', 'Gostaria de uma hospedagem especial para aniversário de casamento.', isoHoursAgo(30)],
        ['bot', 'Que especial! Temos um chale bem reservado e com ótima experiência para casal.', isoHoursAgo(29.8)],
        ['guest', 'Gostei. Pode me mandar valores?', isoHoursAgo(29.5)],
        ['bot', 'Para as datas desejadas, o Chalé Natureza está em R$ 549 a diária.', isoHoursAgo(29.2)],
        ['human', 'Consegui confirmar sua reserva. Vou te mandar os detalhes finais por aqui.', isoHoursAgo(10)],
      ],
    },
    {
      guest_phone: '5511955500505',
      guest_name: 'Camila Rocha',
      status: 'waiting_human',
      stage: 'negotiating',
      bot_enabled: false,
      assigned_to: adminId,
      notes: 'Cliente corporativa pediu condição para grupo pequeno.',
      tags: ['corporativo', 'negociacao'],
      context: {
        checkIn: '2026-05-20',
        checkOut: '2026-05-22',
        guests: 6,
        specialRequests: 'Precisa de nota e cafe cedo',
      },
      created_at: isoDaysAgo(3, 11, 5),
      last_message_at: isoHoursAgo(30),
      messages: [
        ['guest', 'Boa tarde! Estou vendo hospedagem para uma pequena equipe da empresa.', isoHoursAgo(42)],
        ['bot', 'Claro! Me informa por favor as datas e a quantidade de pessoas para eu te orientar melhor.', isoHoursAgo(41.7)],
        ['guest', 'Seriam 6 pessoas, por 2 noites.', isoHoursAgo(41.2)],
        ['bot', 'Perfeito. Posso te apresentar as opções, e para condição especial vou encaminhar para a equipe comercial.', isoHoursAgo(40.9)],
        ['human', 'Camila, já estou com seu caso aqui e vou te mandar uma proposta fechada ainda hoje.', isoHoursAgo(30)],
      ],
    },
    {
      guest_phone: '5511946600606',
      guest_name: 'Bruna Salles',
      status: 'closed',
      stage: 'not_converted',
      bot_enabled: true,
      assigned_to: null,
      notes: 'Perdeu timing, achou a diária acima do orçamento.',
      tags: ['nao_convertido', 'orcamento'],
      context: {
        checkIn: '2026-05-01',
        checkOut: '2026-05-03',
        guests: 2,
        budgetRange: 'ate_350',
      },
      created_at: isoDaysAgo(4, 15, 40),
      last_message_at: isoHoursAgo(54),
      messages: [
        ['guest', 'Vocês têm algo para casal até 350 a diária?', isoHoursAgo(60)],
        ['bot', 'Hoje nossas opções começam um pouco acima disso, mas posso te mostrar a melhor condição disponível.', isoHoursAgo(59.5)],
        ['guest', 'Entendi, vou pensar aqui. Obrigada!', isoHoursAgo(54)],
      ],
    },
    {
      guest_phone: '5511937700707',
      guest_name: 'Marcelo Pires',
      status: 'active',
      stage: 'in_attendance',
      bot_enabled: true,
      assigned_to: null,
      notes: 'Quer fotos antes de decidir.',
      tags: ['fotos', 'piscina'],
      context: {
        guests: 2,
      },
      created_at: isoDaysAgo(5, 17, 0),
      last_message_at: isoHoursAgo(8),
      messages: [
        ['guest', 'Oi! Vi vocês no Instagram. Pode me mostrar fotos da piscina e dos quartos?', isoHoursAgo(9)],
        ['bot', 'Posso sim. Temos piscina, cachoeira, trilhas e opções de quartos bem confortáveis. Se quiser, também te passo as faixas de valores conforme a data.', isoHoursAgo(8.8)],
        ['guest', 'Legal, me manda por favor.', isoHoursAgo(8.2)],
        ['bot', 'Separei algumas imagens para você e, se me disser as datas, já te passo as melhores opções disponíveis.', isoHoursAgo(8)],
      ],
    },
    {
      guest_phone: '5511928800808',
      guest_name: 'Luciana Vieira',
      status: 'waiting_guest',
      stage: 'proposal_sent',
      bot_enabled: true,
      assigned_to: null,
      notes: 'Lead frio ideal para reativacao na demo.',
      tags: ['reativacao', 'lead_frio'],
      context: {
        checkIn: '2026-05-28',
        checkOut: '2026-06-01',
        guests: 2,
        roomType: 'Quarto Standard',
      },
      created_at: isoDaysAgo(6, 9, 30),
      last_message_at: isoHoursAgo(52),
      messages: [
        ['guest', 'Olá! Quero saber valores para o fim do mês.', isoHoursAgo(58)],
        ['bot', 'Oi, Luciana! Para eu te passar a melhor opção, me confirma suas datas e quantas pessoas serão?', isoHoursAgo(57.8)],
        ['guest', 'Seremos 2, do dia 28 ao dia 1.', isoHoursAgo(57.3)],
        ['bot', 'Perfeito. Hoje temos Quarto Standard a partir de R$ 329 a diária para esse período.', isoHoursAgo(56.9)],
        ['bot', 'Se você quiser, eu também posso te sugerir uma opção mais confortável com melhor vista e área externa.', isoHoursAgo(52)],
      ],
    },
  ]

  return leads.map((lead) => ({
    ...lead,
    hotel_id: hotelId,
  }))
}

async function hasColumn(table, column) {
  const { data, error } = await supabase
    .from('information_schema.columns')
    .select('column_name')
    .eq('table_schema', 'public')
    .eq('table_name', table)
    .eq('column_name', column)
    .limit(1)

  if (error) return false
  return Boolean(data?.length)
}

async function seed() {
  const explicitHotelId = process.argv[2]
  const { hotel, adminProfile } = await getHotelContext(explicitHotelId)
  const hotelId = hotel.id

  console.log(`Preparing demo data for hotel: ${hotel.name} (${hotelId})`)

  await supabase.from('notifications').delete().eq('hotel_id', hotelId)
  await supabase.from('leads').delete().eq('hotel_id', hotelId)

  const quickTemplates = [
    'Posso te enviar agora as melhores opcoes para a sua data.',
    'Se quiser, ja deixo essa opcao separada para voce por alguns minutos.',
    'Vou te passar um resumo com valores, estrutura e o que esta incluso.',
    'Posso te mostrar primeiro a opcao mais economica ou a mais procurada.',
    'Acionei a equipe aqui para te ajudar com essa parte e seguimos por este numero.',
  ]

  const systemPrompt =
    'Voce integra o atendimento digital do Hotel Macuco no WhatsApp. Seu tom deve ser acolhedor, natural, profissional e parecido com o de alguem da equipe do hotel.\n\n' +
    'Objetivos:\n' +
    '- responder duvidas sobre hospedagem e estrutura\n' +
    '- conduzir a conversa com naturalidade\n' +
    '- ajudar o cliente a avancar para reserva\n' +
    '- coletar dados essenciais sem parecer roteiro\n' +
    '- encaminhar casos sensiveis para a equipe responsavel\n\n' +
    'Contexto do hotel:\n' +
    '- ambiente de natureza, descanso e lazer\n' +
    '- piscina\n' +
    '- cachoeira\n' +
    '- area de lazer\n' +
    '- quadra de volei\n' +
    '- trilhas\n\n' +
    'Estilo:\n' +
    '- responder sempre em portugues do Brasil\n' +
    '- usar mensagens curtas, claras e humanas\n' +
    '- variar a forma de escrever para nao soar repetitivo\n' +
    '- nao repetir a mesma descricao do hotel em mensagens seguidas\n' +
    '- primeiro responder a pergunta do cliente, depois conduzir o proximo passo\n\n' +
    'Regras:\n' +
    '- nao inventar precos, disponibilidade ou regras\n' +
    '- se faltar informacao, pedir apenas o necessario\n' +
    '- se o cliente quiser reservar, pedir nome, data de entrada, data de saida e quantidade de hospedes\n' +
    '- em pagamento, cancelamento, excecoes ou reclamacoes, informar que a equipe vai assumir'

  const { error: settingsError } = await supabase.from('bot_settings').upsert({
    hotel_id: hotelId,
    enabled: true,
    hotel_name: hotel.name,
    hotel_description:
      'Hotel em meio a natureza, ideal para descanso, lazer e experiencias memoraveis. Estrutura com piscina, cachoeira, area de lazer, quadra de volei e trilhas.',
    system_prompt: systemPrompt,
    auto_transfer_after_messages: 8,
    working_hours: {
      enabled: true,
      timezone: 'America/Sao_Paulo',
      days: [
        { key: 'mon', active: true, start: '07:00', end: '22:00' },
        { key: 'tue', active: true, start: '07:00', end: '22:00' },
        { key: 'wed', active: true, start: '07:00', end: '22:00' },
        { key: 'thu', active: true, start: '07:00', end: '22:00' },
        { key: 'fri', active: true, start: '07:00', end: '22:00' },
        { key: 'sat', active: true, start: '07:00', end: '22:00' },
        { key: 'sun', active: true, start: '07:00', end: '22:00' },
      ],
    },
    quick_templates: quickTemplates,
  }, { onConflict: 'hotel_id' })

  if (settingsError) throw settingsError

  const leadSeed = buildLeadSeed(hotelId, adminProfile.id)

  const { data: insertedLeads, error: leadsError } = await supabase
    .from('leads')
    .insert(leadSeed.map(({ messages, ...lead }) => lead))
    .select('id, guest_phone, guest_name')

  if (leadsError || !insertedLeads) throw leadsError || new Error('Failed to insert leads')

  const leadIdByPhone = new Map(insertedLeads.map(lead => [lead.guest_phone, lead.id]))
  const messageRows = []

  for (const lead of leadSeed) {
    const leadId = leadIdByPhone.get(lead.guest_phone)
    for (const [sender, content, createdAt] of lead.messages) {
      messageRows.push({
        lead_id: leadId,
        sender,
        content,
        media_type: 'text',
        created_at: createdAt,
      })
    }
  }

  const { error: messagesError } = await supabase.from('messages').insert(messageRows)
  if (messagesError) throw messagesError

  const notifications = [
    {
      hotel_id: hotelId,
      user_id: null,
      type: 'new_lead',
      title: 'Novo lead com interesse em Chalé Natureza',
      message: 'Juliana Castro pediu valores para um fim de semana de 3 noites.',
      lead_id: leadIdByPhone.get('5511991100101'),
      read: false,
      created_at: isoHoursAgo(1.4),
    },
    {
      hotel_id: hotelId,
      user_id: adminProfile.id,
      type: 'human_requested',
      title: 'Atendimento humano solicitado',
      message: 'Rafael Mendes pediu apoio para fechamento com pagamento especial.',
      lead_id: leadIdByPhone.get('5511982200202'),
      read: false,
      created_at: isoHoursAgo(0.8),
    },
    {
      hotel_id: hotelId,
      user_id: null,
      type: 'lead_waiting_human',
      title: 'Lead corporativo aguardando retorno',
      message: 'Camila Rocha espera proposta comercial ainda hoje.',
      lead_id: leadIdByPhone.get('5511955500505'),
      read: false,
      created_at: isoHoursAgo(4),
    },
    {
      hotel_id: hotelId,
      user_id: null,
      type: 'lead_updated',
      title: 'Reserva confirmada',
      message: 'Fernando e Ana concluiram a reserva para aniversario de casamento.',
      lead_id: leadIdByPhone.get('5511964400404'),
      read: true,
      read_at: isoHoursAgo(8),
      created_at: isoHoursAgo(10),
    },
    {
      hotel_id: hotelId,
      user_id: adminProfile.id,
      type: 'message_received',
      title: 'Cliente pedindo fotos da estrutura',
      message: 'Marcelo Pires quer ver mais imagens da piscina e dos quartos.',
      lead_id: leadIdByPhone.get('5511937700707'),
      read: false,
      created_at: isoHoursAgo(7.8),
    },
  ]

  const { error: notificationsError } = await supabase.from('notifications').insert(notifications)
  if (notificationsError) throw notificationsError

  const hasManualSnapshotColumns =
    await hasColumn('hotels', 'manual_inventory_snapshot') &&
    await hasColumn('hotels', 'manual_inventory_updated_at') &&
    await hasColumn('hotels', 'manual_inventory_source')

  if (hasManualSnapshotColumns) {
    const manualSnapshot = {
      source: 'manual_csv',
      importedAt: new Date().toISOString(),
      sourceFileName: 'demo-apresentacao-hotel-macuco.csv',
      checkIn: '2026-05-01',
      checkOut: '2026-05-31',
      rows: [
        { roomTypeId: 101, roomTypeCode: 'STD', roomTypeName: 'Quarto Standard', availableRooms: 4, totalRooms: 8, rate: 329, currency: 'BRL' },
        { roomTypeId: 102, roomTypeCode: 'DLX', roomTypeName: 'Quarto Deluxe', availableRooms: 2, totalRooms: 4, rate: 459, currency: 'BRL' },
        { roomTypeId: 103, roomTypeCode: 'FAM', roomTypeName: 'Suite Familia', availableRooms: 1, totalRooms: 2, rate: 619, currency: 'BRL' },
        { roomTypeId: 104, roomTypeCode: 'NAT', roomTypeName: 'Chale Natureza', availableRooms: 3, totalRooms: 5, rate: 549, currency: 'BRL' },
      ],
    }

    const { error: hotelUpdateError } = await supabase
      .from('hotels')
      .update({
        manual_inventory_snapshot: manualSnapshot,
        manual_inventory_updated_at: manualSnapshot.importedAt,
        manual_inventory_source: manualSnapshot.sourceFileName,
      })
      .eq('id', hotelId)

    if (hotelUpdateError) throw hotelUpdateError
  }

  console.log(`Demo ready: ${leadSeed.length} leads, ${messageRows.length} messages, ${notifications.length} notifications.`)
}

seed().catch((error) => {
  console.error(error)
  process.exit(1)
})
