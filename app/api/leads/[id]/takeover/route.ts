import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { toggleBotEnabled, assignAttendant } from '@/lib/leads/service'

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/leads/:id/takeover
 * body: { action: 'take' | 'release' }
 * take   → humano assume, bot é desabilitado
 * release → devolve para a IA, bot é reabilitado
 */
export async function POST(request: NextRequest, { params }: Params): Promise<NextResponse> {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const action = body.action as 'take' | 'release'

  if (!['take', 'release'].includes(action)) {
    return NextResponse.json({ error: 'action deve ser "take" ou "release"' }, { status: 400 })
  }

  try {
    if (action === 'take') {
      await toggleBotEnabled(id, false)
      await assignAttendant(id, user.id)
    } else {
      await toggleBotEnabled(id, true)
      await assignAttendant(id, null)
    }

    return NextResponse.json({ ok: true, botEnabled: action === 'release' })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Erro interno'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
