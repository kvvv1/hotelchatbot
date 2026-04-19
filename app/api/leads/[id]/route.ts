import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { updateLead, updateStage } from '@/lib/leads/service'
import type { LeadStage } from '@/lib/types/database'

type Params = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: lead, error } = await admin
    .from('leads')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !lead) return NextResponse.json({ error: 'Lead não encontrado' }, { status: 404 })

  // Buscar mensagens do lead
  const { data: messages } = await admin
    .from('messages')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: true })

  return NextResponse.json({ data: { ...lead, messages: messages || [] } })
}

export async function PATCH(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  try {
    if (body.stage) {
      await updateStage(id, body.stage as LeadStage)
    } else {
      await updateLead(id, body)
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
