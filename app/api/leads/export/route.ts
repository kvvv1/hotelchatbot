import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createServerClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('hotel_id')
      .eq('id', user.id)
      .single()

    if (!profile?.hotel_id) {
      return NextResponse.json({ error: 'No hotel associated' }, { status: 403 })
    }

    const { data: leads, error } = await supabase
      .from('leads')
      .select('id, guest_name, guest_phone, status, stage, bot_enabled, notes, last_message_at, created_at')
      .eq('hotel_id', profile.hotel_id)
      .order('created_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const headers = ['id', 'guest_name', 'guest_phone', 'status', 'stage', 'bot_enabled', 'notes', 'last_message_at', 'created_at']
    
    const escape = (val: unknown): string => {
      if (val === null || val === undefined) return ''
      const str = String(val)
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return `"${str.replace(/"/g, '""')}"`
      }
      return str
    }

    const rows = (leads ?? []).map(lead =>
      headers.map(h => escape(lead[h as keyof typeof lead])).join(',')
    )

    const csv = [headers.join(','), ...rows].join('\r\n')
    const filename = `leads_${new Date().toISOString().slice(0, 10)}.csv`

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
