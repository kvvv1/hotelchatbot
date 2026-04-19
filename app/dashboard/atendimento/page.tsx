'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { InboxPanel } from '@/components/dashboard/InboxPanel'
import { ChatPanel } from '@/components/dashboard/ChatPanel'
import { LeadContextPanel } from '@/components/dashboard/LeadContextPanel'
import type { Lead, Message } from '@/lib/types/database'

export default function AtendimentoPage() {
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [loadingLeads, setLoadingLeads] = useState(true)

  const fetchLeads = useCallback(async () => {
    const res = await fetch('/api/leads')
    const json = await res.json()
    if (json.data) setLeads(json.data)
    setLoadingLeads(false)
  }, [])

  const fetchMessages = useCallback(async (leadId: string) => {
    const res = await fetch(`/api/leads/${leadId}`)
    const json = await res.json()
    if (json.data?.messages) setMessages(json.data.messages)
    if (json.data) {
      setSelectedLead(json.data)
    }
  }, [])

  useEffect(() => {
    fetchLeads()
  }, [fetchLeads])

  // Realtime: atualizar leads e mensagens
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('atendimento-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        fetchLeads()
        if (selectedLead) fetchMessages(selectedLead.id)
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const newMsg = payload.new as Message
        if (selectedLead && newMsg.lead_id === selectedLead.id) {
          setMessages(prev => [...prev, newMsg])
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedLead, fetchLeads, fetchMessages])

  async function handleSelectLead(lead: Lead) {
    setSelectedLead(lead)
    setMessages([])
    await fetchMessages(lead.id)
  }

  async function handleTakeover(action: 'take' | 'release') {
    if (!selectedLead) return

    await fetch(`/api/leads/${selectedLead.id}/takeover`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    await fetchMessages(selectedLead.id)
    await fetchLeads()
  }

  if (loadingLeads) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="flex h-full">
      <InboxPanel leads={leads} selectedId={selectedLead?.id || null} onSelect={handleSelectLead} />

      {selectedLead ? (
        <>
          <ChatPanel
            lead={selectedLead}
            messages={messages}
            onTakeover={handleTakeover}
            onMessageSent={() => fetchMessages(selectedLead.id)}
          />
          <LeadContextPanel lead={selectedLead} />
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center text-gray-400">
            <p className="text-lg font-medium mb-1">Selecione uma conversa</p>
            <p className="text-sm">Escolha um lead na lista à esquerda</p>
          </div>
        </div>
      )}
    </div>
  )
}
