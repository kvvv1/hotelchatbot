'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Bot, Wifi } from 'lucide-react'

interface BotSettingsForm {
  enabled: boolean
  hotel_name: string
  hotel_description: string
  system_prompt: string
  auto_transfer_after_messages: number
}

export default function ConfiguracoesPage() {
  const [form, setForm] = useState<BotSettingsForm>({
    enabled: true,
    hotel_name: '',
    hotel_description: '',
    system_prompt: '',
    auto_transfer_after_messages: 10,
  })
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles')
        .select('hotel_id')
        .eq('id', user.id)
        .single()

      if (!profile?.hotel_id) return
      setHotelId(profile.hotel_id)

      const { data: settings } = await supabase
        .from('bot_settings')
        .select('*')
        .eq('hotel_id', profile.hotel_id)
        .single()

      if (settings) {
        setSettingsId(settings.id)
        setForm({
          enabled: settings.enabled,
          hotel_name: settings.hotel_name || '',
          hotel_description: settings.hotel_description || '',
          system_prompt: settings.system_prompt || '',
          auto_transfer_after_messages: settings.auto_transfer_after_messages || 10,
        })
      }

      setLoading(false)
    }

    load()
  }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!hotelId) return
    setSaving(true)

    const supabase = createClient()

    if (settingsId) {
      await supabase.from('bot_settings').update(form).eq('id', settingsId)
    } else {
      await supabase.from('bot_settings').insert({ ...form, hotel_id: hotelId })
    }

    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400">Carregando...</p>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configurações do agente IA e do hotel</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Bot Enable */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bot className="w-5 h-5 text-violet-500" />
              <div>
                <p className="font-medium text-gray-900">Agente IA</p>
                <p className="text-sm text-gray-500">Ligar/desligar o atendimento automático</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, enabled: !f.enabled }))}
              className={`relative w-12 h-6 rounded-full transition-colors ${form.enabled ? 'bg-violet-500' : 'bg-gray-300'}`}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* Hotel info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="font-medium text-gray-900">Informações do Hotel</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do hotel</label>
            <input
              type="text"
              value={form.hotel_name}
              onChange={e => setForm(f => ({ ...f, hotel_name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Hotel Macuco"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (para o agente)</label>
            <textarea
              value={form.hotel_description}
              onChange={e => setForm(f => ({ ...f, hotel_description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Localizado em..., contamos com piscina, café da manhã incluso..."
            />
          </div>
        </div>

        {/* Agent behavior */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
          <h3 className="font-medium text-gray-900">Comportamento do Agente</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Instruções adicionais (system prompt)
            </label>
            <textarea
              value={form.system_prompt}
              onChange={e => setForm(f => ({ ...f, system_prompt: e.target.value }))}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Adicione instruções específicas para o comportamento do agente..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Transferir para humano após (mensagens sem conversão)
            </label>
            <input
              type="number"
              min={3}
              max={50}
              value={form.auto_transfer_after_messages}
              onChange={e => setForm(f => ({ ...f, auto_transfer_after_messages: parseInt(e.target.value) }))}
              className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <p className="text-xs text-gray-400 mt-1">mensagens</p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-lg text-sm transition-colors"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar configurações'}
        </button>
      </form>
    </div>
  )
}
