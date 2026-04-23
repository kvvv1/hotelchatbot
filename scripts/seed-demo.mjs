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

function lead({
  phone,
  name,
  status,
  stage,
  botEnabled,
  assignedTo = null,
  notes,
  tags,
  context,
  createdAt,
  lastMessageAt,
  messages,
}) {
  return {
    guest_phone: phone,
    guest_name: name,
    status,
    stage,
    bot_enabled: botEnabled,
    assigned_to: assignedTo,
    notes,
    tags,
    context,
    created_at: createdAt,
    last_message_at: lastMessageAt,
    messages,
  }
}

function buildLeadSeed(hotelId, adminId) {
  const leads = [
    lead({
      phone: '5511991100101',
      name: 'Juliana Castro',
      status: 'human_active',
      stage: 'booking_in_progress',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Caso de demonstracao: IA qualificou e humano assumiu para fechamento.',
      tags: ['casal', 'fim_de_semana', 'alto_potencial'],
      context: { checkIn: '2026-05-15', checkOut: '2026-05-18', guests: 2, roomType: 'Quarto Deluxe' },
      createdAt: isoDaysAgo(0, 13, 10),
      lastMessageAt: isoHoursAgo(0.9),
      messages: [
        ['guest', 'Oi, tudo bem? Gostaria de ver um quarto para casal no proximo fim de semana.', isoHoursAgo(2.2)],
        ['bot', 'Oi, Juliana! Claro, posso te ajudar. Para qual data de entrada e saida voce quer consultar?', isoHoursAgo(2.15)],
        ['guest', 'De sexta a segunda, para 2 pessoas.', isoHoursAgo(2.1)],
        ['bot', 'Perfeito. Temos opcao de Quarto Deluxe a partir de R$ 459 a diaria, com ambiente muito gostoso para descanso e acesso a piscina e trilhas.', isoHoursAgo(1.8)],
        ['bot', 'Se quiser, ja posso te adiantar mais fotos e deixar essa opcao separada para voce.', isoHoursAgo(1.5)],
        ['guest', 'Gostei! Consigo fazer o pagamento de entrada agora e tirar uma duvida sobre cancelamento?', isoHoursAgo(1.2)],
        ['human', 'Oi, Juliana! Eu assumi seu atendimento por aqui para te explicar certinho as condicoes de pagamento e cancelamento. Se quiser, ja seguimos com a sua pre-reserva.', isoHoursAgo(0.9)],
      ],
    }),
    lead({
      phone: '5511982200202',
      name: 'Rafael Mendes',
      status: 'human_active',
      stage: 'booking_in_progress',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Quer fechar hoje, pediu apoio humano para pagamento por pix.',
      tags: ['urgente', 'pagamento', 'familia'],
      context: { checkIn: '2026-05-03', checkOut: '2026-05-05', guests: 3, roomType: 'Suite Familia' },
      createdAt: isoDaysAgo(0, 10, 30),
      lastMessageAt: isoHoursAgo(0.6),
      messages: [
        ['guest', 'Bom dia! Voces tem opcao para casal com uma crianca pequena?', isoHoursAgo(4)],
        ['bot', 'Temos sim. Para eu te indicar a melhor opcao, me confirma as datas e a quantidade total de hospedes?', isoHoursAgo(3.9)],
        ['guest', 'Seriamos 3 pessoas, de sabado para segunda.', isoHoursAgo(3.7)],
        ['bot', 'Perfeito. A Suite Familia atende bem esse perfil e esta saindo por R$ 619 a diaria.', isoHoursAgo(3.5)],
        ['guest', 'Consigo pagar metade agora e metade no check-in?', isoHoursAgo(1)],
        ['human', 'Oi, Rafael! Assumi seu atendimento aqui. Vou te explicar as opcoes de pagamento e ja seguimos com a reserva.', isoHoursAgo(0.6)],
      ],
    }),
    lead({
      phone: '5511973300303',
      name: 'Patricia Nunes',
      status: 'active',
      stage: 'checking_availability',
      botEnabled: true,
      notes: 'Grupo de amigas avaliando feriado.',
      tags: ['grupo', 'feriado'],
      context: { checkIn: '2026-06-03', checkOut: '2026-06-06', guests: 4 },
      createdAt: isoDaysAgo(1, 16, 15),
      lastMessageAt: isoHoursAgo(5),
      messages: [
        ['guest', 'Ola! Voces tem algo para 4 pessoas no feriado?', isoHoursAgo(6)],
        ['bot', 'Oi! Temos algumas opcoes sim. Voce ja tem as datas certinhas para eu consultar?', isoHoursAgo(5.8)],
        ['guest', 'Do dia 3 ao dia 6.', isoHoursAgo(5.4)],
        ['bot', 'Perfeito. Estou verificando as melhores opcoes para esse periodo e ja te passo um resumo.', isoHoursAgo(5)],
      ],
    }),
    lead({
      phone: '5511964400404',
      name: 'Fernando e Ana',
      status: 'closed',
      stage: 'booked',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Reserva confirmada para aniversario de casamento.',
      tags: ['reservado', 'casal', 'aniversario'],
      context: { checkIn: '2026-05-09', checkOut: '2026-05-11', guests: 2, roomType: 'Chale Natureza' },
      createdAt: isoDaysAgo(2, 14, 20),
      lastMessageAt: isoHoursAgo(10),
      messages: [
        ['guest', 'Gostaria de uma hospedagem especial para aniversario de casamento.', isoHoursAgo(30)],
        ['bot', 'Que especial! Temos um chale bem reservado e com otima experiencia para casal.', isoHoursAgo(29.8)],
        ['guest', 'Gostei. Pode me mandar valores?', isoHoursAgo(29.5)],
        ['bot', 'Para as datas desejadas, o Chale Natureza esta em R$ 549 a diaria.', isoHoursAgo(29.2)],
        ['human', 'Consegui confirmar sua reserva. Vou te mandar os detalhes finais por aqui.', isoHoursAgo(10)],
      ],
    }),
    lead({
      phone: '5511955500505',
      name: 'Camila Rocha',
      status: 'waiting_human',
      stage: 'negotiating',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Cliente corporativa pediu condicao para grupo pequeno.',
      tags: ['corporativo', 'negociacao'],
      context: { checkIn: '2026-05-20', checkOut: '2026-05-22', guests: 6, specialRequests: 'Precisa de nota e cafe cedo' },
      createdAt: isoDaysAgo(3, 11, 5),
      lastMessageAt: isoHoursAgo(30),
      messages: [
        ['guest', 'Boa tarde! Estou vendo hospedagem para uma pequena equipe da empresa.', isoHoursAgo(42)],
        ['bot', 'Claro! Me informa por favor as datas e a quantidade de pessoas para eu te orientar melhor.', isoHoursAgo(41.7)],
        ['guest', 'Seriam 6 pessoas, por 2 noites.', isoHoursAgo(41.2)],
        ['bot', 'Perfeito. Posso te apresentar as opcoes, e para condicao especial vou encaminhar para a equipe comercial.', isoHoursAgo(40.9)],
        ['human', 'Camila, ja estou com seu caso aqui e vou te mandar uma proposta fechada ainda hoje.', isoHoursAgo(30)],
      ],
    }),
    lead({
      phone: '5511946600606',
      name: 'Bruna Salles',
      status: 'closed',
      stage: 'not_converted',
      botEnabled: true,
      notes: 'Perdeu timing, achou a diaria acima do orcamento.',
      tags: ['nao_convertido', 'orcamento'],
      context: { checkIn: '2026-05-01', checkOut: '2026-05-03', guests: 2, budgetRange: 'ate_350' },
      createdAt: isoDaysAgo(4, 15, 40),
      lastMessageAt: isoHoursAgo(54),
      messages: [
        ['guest', 'Voces tem algo para casal ate 350 a diaria?', isoHoursAgo(60)],
        ['bot', 'Hoje nossas opcoes comecam um pouco acima disso, mas posso te mostrar a melhor condicao disponivel.', isoHoursAgo(59.5)],
        ['guest', 'Entendi, vou pensar aqui. Obrigada!', isoHoursAgo(54)],
      ],
    }),
    lead({
      phone: '5511937700707',
      name: 'Marcelo Pires',
      status: 'active',
      stage: 'in_attendance',
      botEnabled: true,
      notes: 'Quer fotos antes de decidir.',
      tags: ['fotos', 'piscina'],
      context: { guests: 2 },
      createdAt: isoDaysAgo(5, 17, 0),
      lastMessageAt: isoHoursAgo(8),
      messages: [
        ['guest', 'Oi! Vi voces no Instagram. Pode me mostrar fotos da piscina e dos quartos?', isoHoursAgo(9)],
        ['bot', 'Posso sim. Temos piscina, cachoeira, trilhas e opcoes de quartos bem confortaveis. Se quiser, tambem te passo as faixas de valores conforme a data.', isoHoursAgo(8.8)],
        ['guest', 'Legal, me manda por favor.', isoHoursAgo(8.2)],
        ['bot', 'Separei algumas imagens para voce e, se me disser as datas, ja te passo as melhores opcoes disponiveis.', isoHoursAgo(8)],
      ],
    }),
    lead({
      phone: '5511928800808',
      name: 'Luciana Vieira',
      status: 'waiting_guest',
      stage: 'proposal_sent',
      botEnabled: true,
      notes: 'Lead frio ideal para reativacao na demo.',
      tags: ['reativacao', 'lead_frio'],
      context: { checkIn: '2026-05-28', checkOut: '2026-06-01', guests: 2, roomType: 'Quarto Standard' },
      createdAt: isoDaysAgo(6, 9, 30),
      lastMessageAt: isoHoursAgo(52),
      messages: [
        ['guest', 'Ola! Quero saber valores para o fim do mes.', isoHoursAgo(58)],
        ['bot', 'Oi, Luciana! Para eu te passar a melhor opcao, me confirma suas datas e quantas pessoas serao?', isoHoursAgo(57.8)],
        ['guest', 'Seremos 2, do dia 28 ao dia 1.', isoHoursAgo(57.3)],
        ['bot', 'Perfeito. Hoje temos Quarto Standard a partir de R$ 329 a diaria para esse periodo.', isoHoursAgo(56.9)],
        ['bot', 'Se voce quiser, eu tambem posso te sugerir uma opcao mais confortavel com melhor vista e area externa.', isoHoursAgo(52)],
      ],
    }),
    lead({
      phone: '5511919900909',
      name: 'Eduardo Lima',
      status: 'closed',
      stage: 'booked',
      botEnabled: true,
      notes: 'Reserva de 2 noites concluida sem apoio humano.',
      tags: ['reserva_online', 'agente_converteu'],
      context: { checkIn: '2026-04-30', checkOut: '2026-05-02', guests: 2, roomType: 'Quarto Standard' },
      createdAt: isoDaysAgo(7, 13, 20),
      lastMessageAt: isoHoursAgo(72),
      messages: [
        ['guest', 'Boa noite, tem opcao de quarto mais economico para casal?', isoHoursAgo(80)],
        ['bot', 'Temos sim. Para qual periodo voce quer consultar?', isoHoursAgo(79.8)],
        ['guest', 'Para o fim da proxima semana.', isoHoursAgo(79.5)],
        ['bot', 'Consegui uma opcao de Quarto Standard a partir de R$ 329 a diaria.', isoHoursAgo(79.1)],
        ['guest', 'Perfeito, pode seguir.', isoHoursAgo(78.7)],
        ['bot', 'Reserva registrada por aqui. Vou te enviar a confirmacao e as proximas orientacoes.', isoHoursAgo(72)],
      ],
    }),
    lead({
      phone: '5511901101010',
      name: 'Aline Prado',
      status: 'active',
      stage: 'proposal_sent',
      botEnabled: true,
      notes: 'Quer algo mais premium com boa vista.',
      tags: ['upsell', 'premium'],
      context: { checkIn: '2026-05-22', checkOut: '2026-05-25', guests: 2, roomType: 'Chale Natureza' },
      createdAt: isoDaysAgo(7, 9, 40),
      lastMessageAt: isoHoursAgo(26),
      messages: [
        ['guest', 'Quero uma opcao mais especial para um fim de semana a dois.', isoHoursAgo(28)],
        ['bot', 'Perfeito. Posso te indicar o Chale Natureza, que costuma agradar bastante casais.', isoHoursAgo(27.8)],
        ['guest', 'Gostei, me manda a faixa de valor.', isoHoursAgo(26.9)],
        ['bot', 'Hoje ele esta em R$ 549 a diaria para esse perfil de estadia.', isoHoursAgo(26)],
      ],
    }),
    lead({
      phone: '5511892201111',
      name: 'Sergio Matos',
      status: 'waiting_human',
      stage: 'proposal_sent',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Quer fechar 3 quartos juntos para familia.',
      tags: ['familia', 'grupo', 'quartos_multiplos'],
      context: { checkIn: '2026-05-12', checkOut: '2026-05-14', guests: 7 },
      createdAt: isoDaysAgo(8, 14, 15),
      lastMessageAt: isoHoursAgo(33),
      messages: [
        ['guest', 'Somos uma familia grande. Voces conseguem 3 quartos proximos?', isoHoursAgo(38)],
        ['bot', 'Posso verificar sim. Me confirma por favor as datas e a quantidade total de pessoas.', isoHoursAgo(37.8)],
        ['guest', 'Seremos 7 pessoas, por 2 noites.', isoHoursAgo(37.3)],
        ['bot', 'Perfeito. Vou encaminhar para a equipe para montarmos a melhor composicao de quartos.', isoHoursAgo(36.8)],
        ['human', 'Oi, Sergio! Ja estou organizando uma proposta para a sua familia.', isoHoursAgo(33)],
      ],
    }),
    lead({
      phone: '5511883301212',
      name: 'Renata Gomes',
      status: 'closed',
      stage: 'not_converted',
      botEnabled: true,
      notes: 'Cliente desistiu por preferir ficar mais perto do centro.',
      tags: ['nao_convertido', 'localizacao'],
      context: { checkIn: '2026-05-18', checkOut: '2026-05-20', guests: 2 },
      createdAt: isoDaysAgo(9, 11, 10),
      lastMessageAt: isoHoursAgo(90),
      messages: [
        ['guest', 'Estou procurando algo mais perto do centro. Voces ficam muito afastados?', isoHoursAgo(95)],
        ['bot', 'Estamos em uma area mais voltada a natureza e descanso. Se esse for o estilo que voce busca, vale muito a pena.', isoHoursAgo(94.7)],
        ['guest', 'Entendi. Acho que para esta viagem vou ficar mais perto da cidade.', isoHoursAgo(90)],
      ],
    }),
    lead({
      phone: '5511874401313',
      name: 'Monica Esteves',
      status: 'active',
      stage: 'negotiating',
      botEnabled: true,
      notes: 'Comparando com outra pousada.',
      tags: ['negociacao', 'comparativo'],
      context: { checkIn: '2026-05-17', checkOut: '2026-05-19', guests: 2, roomType: 'Quarto Deluxe' },
      createdAt: isoDaysAgo(10, 16, 45),
      lastMessageAt: isoHoursAgo(20),
      messages: [
        ['guest', 'Estou comparando voces com outra pousada. O que mais diferencia o hotel?', isoHoursAgo(22)],
        ['bot', 'Nosso diferencial esta muito na experiencia de natureza, com piscina, cachoeira, trilhas e uma estadia bem tranquila.', isoHoursAgo(21.7)],
        ['guest', 'Entendi. E o Deluxe, em quanto fica?', isoHoursAgo(20.8)],
        ['bot', 'Hoje ele esta em R$ 459 a diaria e costuma ser uma das opcoes mais procuradas para casal.', isoHoursAgo(20)],
      ],
    }),
    lead({
      phone: '5511865501414',
      name: 'Thiago Rezende',
      status: 'closed',
      stage: 'booked',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Reserva para ferias em familia confirmada.',
      tags: ['familia', 'reserva_confirmada'],
      context: { checkIn: '2026-06-10', checkOut: '2026-06-14', guests: 4, roomType: 'Suite Familia' },
      createdAt: isoDaysAgo(11, 13, 0),
      lastMessageAt: isoHoursAgo(120),
      messages: [
        ['guest', 'Queria organizar umas ferias curtas com a familia.', isoHoursAgo(128)],
        ['bot', 'Que legal! Para quantas pessoas e em qual periodo voce esta pensando?', isoHoursAgo(127.8)],
        ['guest', 'Seremos 4 pessoas por 4 noites.', isoHoursAgo(127.2)],
        ['bot', 'A Suite Familia atende muito bem esse perfil. Posso te apresentar a condicao.', isoHoursAgo(126.9)],
        ['human', 'Thiago, proposta aprovada e reserva confirmada. Obrigado pela preferencia!', isoHoursAgo(120)],
      ],
    }),
    lead({
      phone: '5511856601515',
      name: 'Paula Siqueira',
      status: 'waiting_guest',
      stage: 'proposal_sent',
      botEnabled: true,
      notes: 'Interessada em pacote de 3 noites.',
      tags: ['pacote', 'casal'],
      context: { checkIn: '2026-05-24', checkOut: '2026-05-27', guests: 2, roomType: 'Quarto Deluxe' },
      createdAt: isoDaysAgo(12, 8, 45),
      lastMessageAt: isoHoursAgo(110),
      messages: [
        ['guest', 'Tem pacote para 3 noites?', isoHoursAgo(114)],
        ['bot', 'Posso montar uma sugestao sim. Me confirma as datas e se sao 2 adultos.', isoHoursAgo(113.8)],
        ['guest', 'Isso, seriam 2 adultos.', isoHoursAgo(113.1)],
        ['bot', 'Perfeito. Ja te passei a melhor opcao para esse perfil e fico aguardando seu retorno.', isoHoursAgo(110)],
      ],
    }),
    lead({
      phone: '5511847701616',
      name: 'Gustavo Aranha',
      status: 'active',
      stage: 'new_contact',
      botEnabled: true,
      notes: 'Lead novo entrando agora para alimentar a inbox.',
      tags: ['novo', 'site'],
      context: {},
      createdAt: isoDaysAgo(0, 15, 10),
      lastMessageAt: isoHoursAgo(0.3),
      messages: [
        ['guest', 'Oi, gostaria de saber se voces aceitam pet.', isoHoursAgo(0.3)],
      ],
    }),
    lead({
      phone: '5511838801717',
      name: 'Larissa Faria',
      status: 'closed',
      stage: 'booked',
      botEnabled: true,
      notes: 'Reserva automatizada para casal em baixa friccao.',
      tags: ['automacao', 'conversao_ia'],
      context: { checkIn: '2026-05-06', checkOut: '2026-05-08', guests: 2, roomType: 'Quarto Standard' },
      createdAt: isoDaysAgo(13, 10, 20),
      lastMessageAt: isoHoursAgo(150),
      messages: [
        ['guest', 'Consigo fazer uma reserva rapida para 2 noites?', isoHoursAgo(154)],
        ['bot', 'Consegue sim. Me confirma por favor as datas e a quantidade de pessoas.', isoHoursAgo(153.8)],
        ['guest', 'Do dia 6 ao dia 8, para 2 pessoas.', isoHoursAgo(153.2)],
        ['bot', 'Perfeito. Quarto Standard disponivel e posso seguir com a reserva.', isoHoursAgo(152.8)],
        ['guest', 'Pode sim.', isoHoursAgo(152.3)],
        ['bot', 'Reserva encaminhada com sucesso. Ja te passo os proximos detalhes.', isoHoursAgo(150)],
      ],
    }),
    lead({
      phone: '5511829901818',
      name: 'Diego Tavares',
      status: 'waiting_human',
      stage: 'negotiating',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Pediu desconto para fechar mais rapido.',
      tags: ['desconto', 'followup'],
      context: { checkIn: '2026-05-26', checkOut: '2026-05-28', guests: 2, roomType: 'Quarto Deluxe' },
      createdAt: isoDaysAgo(14, 16, 10),
      lastMessageAt: isoHoursAgo(46),
      messages: [
        ['guest', 'Gostei do Deluxe, mas queria entender se tem alguma condicao melhor.', isoHoursAgo(50)],
        ['bot', 'Posso encaminhar isso para a equipe para avaliarmos a melhor condicao comercial.', isoHoursAgo(49.6)],
        ['human', 'Diego, vou olhar isso com carinho e te responder ainda hoje.', isoHoursAgo(46)],
      ],
    }),
    lead({
      phone: '5511811101919',
      name: 'Vanessa Moura',
      status: 'closed',
      stage: 'not_converted',
      botEnabled: false,
      assignedTo: adminId,
      notes: 'Perdido por data indisponivel.',
      tags: ['nao_convertido', 'sem_disponibilidade'],
      context: { checkIn: '2026-05-01', checkOut: '2026-05-04', guests: 2 },
      createdAt: isoDaysAgo(15, 12, 30),
      lastMessageAt: isoHoursAgo(175),
      messages: [
        ['guest', 'Voces ainda tem vaga para o feriado do inicio do mes?', isoHoursAgo(180)],
        ['bot', 'Nesse periodo estamos com disponibilidade bem limitada e posso verificar a melhor alternativa.', isoHoursAgo(179.7)],
        ['human', 'Vanessa, para essas datas especificas ja estamos sem disponibilidade. Se quiser, posso sugerir outra janela.', isoHoursAgo(175)],
      ],
    }),
  ]

  return leads.map(item => ({
    ...item,
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
    'Se preferir, tambem posso te mandar fotos da piscina, quartos e area externa.',
    'Para seguir com a reserva, me confirma nome completo, datas e quantidade de hospedes.',
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

  const { error: settingsError } = await supabase.from('bot_settings').upsert(
    {
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
    },
    { onConflict: 'hotel_id' }
  )

  if (settingsError) throw settingsError

  const leadSeed = buildLeadSeed(hotelId, adminProfile.id)

  const { data: insertedLeads, error: leadsError } = await supabase
    .from('leads')
    .insert(leadSeed.map(({ messages, ...item }) => item))
    .select('id, guest_phone, guest_name')

  if (leadsError || !insertedLeads) throw leadsError || new Error('Failed to insert leads')

  const leadIdByPhone = new Map(insertedLeads.map(item => [item.guest_phone, item.id]))
  const messageRows = []

  for (const item of leadSeed) {
    const leadId = leadIdByPhone.get(item.guest_phone)
    for (const [sender, content, createdAt] of item.messages) {
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
      title: 'Novo lead no funil',
      message: 'Gustavo Tavares acabou de perguntar sobre politica pet e disponibilidade.',
      lead_id: leadIdByPhone.get('5511847701616'),
      read: false,
      created_at: isoHoursAgo(0.2),
    },
    {
      hotel_id: hotelId,
      user_id: null,
      type: 'new_lead',
      title: 'Lead premium aquecido',
      message: 'Juliana Castro avancou para pre-reserva e precisa de fechamento.',
      lead_id: leadIdByPhone.get('5511991100101'),
      read: false,
      created_at: isoHoursAgo(0.8),
    },
    {
      hotel_id: hotelId,
      user_id: adminProfile.id,
      type: 'human_requested',
      title: 'Atendimento humano solicitado',
      message: 'Rafael Mendes pediu apoio para fechamento com pagamento especial.',
      lead_id: leadIdByPhone.get('5511982200202'),
      read: false,
      created_at: isoHoursAgo(0.6),
    },
    {
      hotel_id: hotelId,
      user_id: null,
      type: 'lead_waiting_human',
      title: 'Fila humana com proposta corporativa',
      message: 'Camila Rocha aguarda retorno comercial ainda hoje.',
      lead_id: leadIdByPhone.get('5511955500505'),
      read: false,
      created_at: isoHoursAgo(4),
    },
    {
      hotel_id: hotelId,
      user_id: adminProfile.id,
      type: 'message_received',
      title: 'Pedido de fotos da estrutura',
      message: 'Marcelo Pires quer ver mais imagens da piscina e dos quartos.',
      lead_id: leadIdByPhone.get('5511937700707'),
      read: false,
      created_at: isoHoursAgo(7.8),
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
      user_id: null,
      type: 'lead_updated',
      title: 'Conversao automatica',
      message: 'Larissa Faria confirmou uma reserva conduzida pela IA.',
      lead_id: leadIdByPhone.get('5511838801717'),
      read: true,
      read_at: isoHoursAgo(120),
      created_at: isoHoursAgo(150),
    },
    {
      hotel_id: hotelId,
      user_id: adminProfile.id,
      type: 'lead_waiting_human',
      title: 'Pedido de desconto em analise',
      message: 'Diego Tavares esta aguardando retorno sobre condicao comercial.',
      lead_id: leadIdByPhone.get('5511829901818'),
      read: false,
      created_at: isoHoursAgo(46),
    },
    {
      hotel_id: hotelId,
      user_id: null,
      type: 'message_received',
      title: 'Lead comparando concorrencia',
      message: 'Monica Esteves pediu argumentos de valor para comparar com outra pousada.',
      lead_id: leadIdByPhone.get('5511874401313'),
      read: false,
      created_at: isoHoursAgo(20),
    },
    {
      hotel_id: hotelId,
      user_id: null,
      type: 'lead_updated',
      title: 'Equipe familiar confirmada',
      message: 'Thiago Rezende fechou a estada de ferias para 4 pessoas.',
      lead_id: leadIdByPhone.get('5511865501414'),
      read: true,
      read_at: isoHoursAgo(118),
      created_at: isoHoursAgo(120),
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
        { roomTypeId: 105, roomTypeCode: 'SUP', roomTypeName: 'Suite Superior', availableRooms: 2, totalRooms: 3, rate: 689, currency: 'BRL' },
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

seed().catch(error => {
  console.error(error)
  process.exit(1)
})
