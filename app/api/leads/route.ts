import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveLeads } from '@/lib/leads/service'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('hotel_id')
    .eq('id', user.id)
    .single()

  if (!profile?.hotel_id) return NextResponse.json({ error: 'Hotel não encontrado' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const view = searchParams.get('view') || 'inbox'

  try {
    if (view === 'kanban') {
      const { getLeadsByStage } = await import('@/lib/leads/service')
      const grouped = await getLeadsByStage(profile.hotel_id)
      return NextResponse.json({ data: grouped })
    }

    const leads = await getActiveLeads(profile.hotel_id)
    return NextResponse.json({ data: leads })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
