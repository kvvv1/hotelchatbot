'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { KanbanBoard } from '@/components/dashboard/KanbanBoard'
import type { Lead, LeadStage } from '@/lib/types/database'

export default function LeadsPage() {
  const [leadsByStage, setLeadsByStage] = useState<Record<string, Lead[]>>({})
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const fetchLeads = useCallback(async () => {
    const res = await fetch('/api/leads?view=kanban')
    const json = await res.json()
    if (json.data) setLeadsByStage(json.data)
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Realtime
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('kanban-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [fetchLeads])

  async function handleStageChange(leadId: string, stage: LeadStage) {
    // Otimistic update
    setLeadsByStage(prev => {
      const updated = { ...prev }
      let movedLead: Lead | undefined

      for (const s of Object.keys(updated)) {
        const idx = updated[s].findIndex(l => l.id === leadId)
        if (idx !== -1) {
          movedLead = { ...updated[s][idx], stage }
          updated[s] = updated[s].filter(l => l.id !== leadId)
          break
        }
      }

      if (movedLead) {
        updated[stage] = [movedLead, ...(updated[stage] || [])]
      }

      return updated
    })

    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage }),
    })
  }

  function handleLeadClick(lead: Lead) {
    router.push(`/dashboard/atendimento?lead=${lead.id}`)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Carregando Kanban...</p>
      </div>
    )
  }

  const totalLeads = Object.values(leadsByStage).reduce((acc, leads) => acc + leads.length, 0)
  const booked = (leadsByStage['booked'] || []).length
  const notConverted = (leadsByStage['not_converted'] || []).length
  const inPipeline = totalLeads - booked - notConverted

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-5 border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Leads (Kanban)</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalLeads} total · {inPipeline} em andamento · {booked} convertidos
            </p>
          </div>
        </div>
      </div>

      {/* Kanban */}
      <div className="flex-1 overflow-hidden">
        <KanbanBoard
          leadsByStage={leadsByStage}
          onStageChange={handleStageChange}
          onLeadClick={handleLeadClick}
        />
      </div>
    </div>
  )
}
