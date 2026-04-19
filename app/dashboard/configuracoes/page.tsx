'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Save, Bot, Wifi, Database, Clock, CheckCircle, XCircle, Loader2, Eye, EyeOff, AlertTriangle, Image, Plus, Trash2, X } from 'lucide-react'

type Tab = 'agent' | 'integrations' | 'hours' | 'gallery' | 'templates'

interface BotSettingsForm {
  enabled: boolean
  hotel_name: string
  hotel_description: string
  system_prompt: string
  auto_transfer_after_messages: number
}

interface ZApiForm {
  zapi_instance_id: string
  zapi_token: string
  zapi_client_token: string
}

interface HitsForm {
  hits_api_url: string
  hits_tenant_name: string
  hits_property_code: string
  hits_client_id: string
  hits_api_key: string
}

interface DaySchedule {
  key: string
  active: boolean
  start: string
  end: string
}

interface MediaItem {
  id: string
  url: string
  storage_path: string | null
  category: string
  caption: string | null
  created_at: string
}

const MEDIA_CATEGORIES = [
  { key: 'standard', label: 'Quarto Standard' },
  { key: 'deluxe', label: 'Quarto Deluxe' },
  { key: 'suite', label: 'Suíte' },
  { key: 'pool', label: 'Piscina' },
  { key: 'restaurant', label: 'Restaurante / Café' },
  { key: 'common', label: 'Área Comum' },
  { key: 'exterior', label: 'Fachada / Exterior' },
  { key: 'general', label: 'Geral' },
]

const WEEKDAYS = [
  { key: 'mon', label: 'Segunda' },
  { key: 'tue', label: 'Terça' },
  { key: 'wed', label: 'Quarta' },
  { key: 'thu', label: 'Quinta' },
  { key: 'fri', label: 'Sexta' },
  { key: 'sat', label: 'Sábado' },
  { key: 'sun', label: 'Domingo' },
]

const DEFAULT_DAYS: DaySchedule[] = WEEKDAYS.map(d => ({
  key: d.key,
  active: !['sat', 'sun'].includes(d.key),
  start: '08:00',
  end: '18:00',
}))

function TestBadge({ status }: { status: 'idle' | 'testing' | 'ok' | 'error' }) {
  if (status === 'idle') return null
  if (status === 'testing') return <span className="flex items-center gap-1 text-xs text-gray-500"><Loader2 className="w-3 h-3 animate-spin" /> Testando…</span>
  if (status === 'ok') return <span className="flex items-center gap-1 text-xs text-green-600"><CheckCircle className="w-3 h-3" /> Conectado!</span>
  return <span className="flex items-center gap-1 text-xs text-red-600"><XCircle className="w-3 h-3" /> Falhou</span>
}

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>('agent')
  const [hotelId, setHotelId] = useState<string | null>(null)
  const [settingsId, setSettingsId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Agent tab
  const [agentForm, setAgentForm] = useState<BotSettingsForm>({
    enabled: true,
    hotel_name: '',
    hotel_description: '',
    system_prompt: '',
    auto_transfer_after_messages: 10,
  })
  const [savingAgent, setSavingAgent] = useState(false)
  const [savedAgent, setSavedAgent] = useState(false)

  // Integrations tab
  const [zapiForm, setZapiForm] = useState<ZApiForm>({ zapi_instance_id: '', zapi_token: '', zapi_client_token: '' })
  const [hitsForm, setHitsForm] = useState<HitsForm>({ hits_api_url: '', hits_tenant_name: '', hits_property_code: '', hits_client_id: '', hits_api_key: '' })
  const [showZapiToken, setShowZapiToken] = useState(false)
  const [showHitsKey, setShowHitsKey] = useState(false)
  const [savingCreds, setSavingCreds] = useState(false)
  const [savedCreds, setSavedCreds] = useState(false)
  const [testZapi, setTestZapi] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')
  const [testHits, setTestHits] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle')

  // Hours tab
  const [hoursEnabled, setHoursEnabled] = useState(false)
  const [timezone, setTimezone] = useState('America/Sao_Paulo')
  const [days, setDays] = useState<DaySchedule[]>(DEFAULT_DAYS)
  const [savingHours, setSavingHours] = useState(false)
  const [savedHours, setSavedHours] = useState(false)

  // Gallery tab
  const [media, setMedia] = useState<MediaItem[]>([])
  const [uploadCategory, setUploadCategory] = useState('general')
  const [uploadCaption, setUploadCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  // Templates tab
  const [templates, setTemplates] = useState<string[]>([])
  const [newTemplate, setNewTemplate] = useState('')
  const [savingTemplates, setSavingTemplates] = useState(false)
  const [savedTemplates, setSavedTemplates] = useState(false)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('hotel_id').eq('id', user.id).single()
      if (!profile?.hotel_id) return
      setHotelId(profile.hotel_id)

      const [{ data: settings }, { data: hotel }] = await Promise.all([
        supabase.from('bot_settings').select('*').eq('hotel_id', profile.hotel_id).single(),
        supabase.from('hotels').select('zapi_instance_id,zapi_token,zapi_client_token,hits_api_url,hits_tenant_name,hits_property_code,hits_client_id,hits_api_key').eq('id', profile.hotel_id).single(),
      ])

      if (settings) {
        setSettingsId(settings.id)
        setAgentForm({
          enabled: settings.enabled,
          hotel_name: settings.hotel_name || '',
          hotel_description: settings.hotel_description || '',
          system_prompt: settings.system_prompt || '',
          auto_transfer_after_messages: settings.auto_transfer_after_messages || 10,
        })
        const wh = settings.working_hours
        if (wh) {
          setHoursEnabled(wh.enabled ?? false)
          setTimezone(wh.timezone || 'America/Sao_Paulo')
          if (Array.isArray(wh.days) && wh.days.length > 0) setDays(wh.days)
        }
        if (Array.isArray(settings.quick_templates)) {
          setTemplates(settings.quick_templates as string[])
        }
      }

      if (hotel) {
        setZapiForm({
          zapi_instance_id: hotel.zapi_instance_id || '',
          zapi_token: hotel.zapi_token || '',
          zapi_client_token: hotel.zapi_client_token || '',
        })
        setHitsForm({
          hits_api_url: hotel.hits_api_url || '',
          hits_tenant_name: hotel.hits_tenant_name || '',
          hits_property_code: hotel.hits_property_code?.toString() || '',
          hits_client_id: hotel.hits_client_id || '',
          hits_api_key: hotel.hits_api_key || '',
        })
      }

      // Gallery
      const { data: mediaData } = await supabase
        .from('hotel_media')
        .select('*')
        .eq('hotel_id', profile.hotel_id)
        .order('created_at', { ascending: false })
      if (mediaData) setMedia(mediaData as MediaItem[])

      setLoading(false)
    }
    load()
  }, [])

  async function handleSaveAgent(e: React.FormEvent) {
    e.preventDefault()
    if (!hotelId) return
    setSavingAgent(true)
    const supabase = createClient()
    if (settingsId) {
      await supabase.from('bot_settings').update(agentForm).eq('id', settingsId)
    } else {
      const { data } = await supabase.from('bot_settings').insert({ ...agentForm, hotel_id: hotelId }).select('id').single()
      if (data) setSettingsId(data.id)
    }
    setSavingAgent(false)
    setSavedAgent(true)
    setTimeout(() => setSavedAgent(false), 2500)
  }

  async function handleSaveCredentials(e: React.FormEvent) {
    e.preventDefault()
    if (!hotelId) return
    setSavingCreds(true)
    const supabase = createClient()
    await supabase.from('hotels').update({
      ...zapiForm,
      hits_api_url: hitsForm.hits_api_url || null,
      hits_tenant_name: hitsForm.hits_tenant_name || null,
      hits_property_code: hitsForm.hits_property_code ? parseInt(hitsForm.hits_property_code) : null,
      hits_client_id: hitsForm.hits_client_id || null,
      hits_api_key: hitsForm.hits_api_key || null,
    }).eq('id', hotelId)
    setSavingCreds(false)
    setSavedCreds(true)
    setTimeout(() => setSavedCreds(false), 2500)
  }

  async function handleSaveHours(e: React.FormEvent) {
    e.preventDefault()
    if (!hotelId) return
    setSavingHours(true)
    const supabase = createClient()
    const wh = { enabled: hoursEnabled, timezone, days }
    if (settingsId) {
      await supabase.from('bot_settings').update({ working_hours: wh }).eq('id', settingsId)
    } else {
      const { data } = await supabase.from('bot_settings').insert({
        hotel_id: hotelId, enabled: true, hotel_name: '', working_hours: wh,
      }).select('id').single()
      if (data) setSettingsId(data.id)
    }
    setSavingHours(false)
    setSavedHours(true)
    setTimeout(() => setSavedHours(false), 2500)
  }

  async function handleUploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !hotelId) return
    setUploading(true)
    setUploadError(null)
    try {
      const supabase = createClient()
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${hotelId}/${uploadCategory}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('hotel-media').upload(path, file, { upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: { publicUrl } } = supabase.storage.from('hotel-media').getPublicUrl(path)
      const { data: inserted, error: insErr } = await supabase
        .from('hotel_media')
        .insert({ hotel_id: hotelId, url: publicUrl, storage_path: path, category: uploadCategory, caption: uploadCaption || null })
        .select('*')
        .single()
      if (insErr) throw new Error(insErr.message)
      setMedia(prev => [inserted as MediaItem, ...prev])
      setUploadCaption('')
      e.target.value = ''
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Erro ao enviar foto')
    } finally {
      setUploading(false)
    }
  }

  async function handleDeletePhoto(item: MediaItem) {
    const supabase = createClient()
    if (item.storage_path) {
      await supabase.storage.from('hotel-media').remove([item.storage_path])
    }
    await supabase.from('hotel_media').delete().eq('id', item.id)
    setMedia(prev => prev.filter(m => m.id !== item.id))
  }

  async function handleSaveTemplates(e: React.FormEvent) {
    e.preventDefault()
    if (!hotelId) return
    setSavingTemplates(true)
    const supabase = createClient()
    if (settingsId) {
      await supabase.from('bot_settings').update({ quick_templates: templates }).eq('id', settingsId)
    } else {
      const { data } = await supabase.from('bot_settings').insert({
        hotel_id: hotelId, enabled: true, hotel_name: '', quick_templates: templates,
      }).select('id').single()
      if (data) setSettingsId(data.id)
    }
    setSavingTemplates(false)
    setSavedTemplates(true)
    setTimeout(() => setSavedTemplates(false), 2500)
  }

  async function handleTestZapi() {
    if (!zapiForm.zapi_instance_id || !zapiForm.zapi_token) return
    setTestZapi('testing')
    try {
      const res = await fetch('/api/health/zapi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zapiForm),
      })
      setTestZapi(res.ok ? 'ok' : 'error')
    } catch { setTestZapi('error') }
    setTimeout(() => setTestZapi('idle'), 6000)
  }

  async function handleTestHits() {
    if (!hitsForm.hits_api_url || !hitsForm.hits_tenant_name) return
    setTestHits('testing')
    try {
      const res = await fetch('/api/health/hits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hitsForm),
      })
      setTestHits(res.ok ? 'ok' : 'error')
    } catch { setTestHits('error') }
    setTimeout(() => setTestHits('idle'), 6000)
  }

  function updateDay(key: string, patch: Partial<DaySchedule>) {
    setDays(prev => prev.map(d => d.key === key ? { ...d, ...patch } : d))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
      </div>
    )
  }

  const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
    { key: 'agent', label: 'Agente IA', icon: Bot },
    { key: 'integrations', label: 'Integrações', icon: Wifi },
    { key: 'hours', label: 'Horários', icon: Clock },
    { key: 'gallery', label: 'Galeria', icon: Image },
    { key: 'templates', label: 'Templates', icon: Save },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Configurações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Configure o agente, WhatsApp e HITS PMS</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: AGENTE ── */}
      {tab === 'agent' && (
        <form onSubmit={handleSaveAgent} className="space-y-5">
          {/* Toggle */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Bot className="w-5 h-5 text-violet-500" />
                <div>
                  <p className="font-medium text-gray-900">Agente IA</p>
                  <p className="text-sm text-gray-500">Atendimento automático via WhatsApp</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAgentForm(f => ({ ...f, enabled: !f.enabled }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${agentForm.enabled ? 'bg-violet-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${agentForm.enabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>

          {/* Hotel info */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-medium text-gray-900">Informações do Hotel</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do hotel</label>
              <input type="text" value={agentForm.hotel_name}
                onChange={e => setAgentForm(f => ({ ...f, hotel_name: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Hotel Macuco" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição (usada pelo agente)</label>
              <textarea value={agentForm.hotel_description}
                onChange={e => setAgentForm(f => ({ ...f, hotel_description: e.target.value }))}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                placeholder="Localizado em..., contamos com piscina, café da manhã incluso..." />
            </div>
          </div>

          {/* Behavior */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <h3 className="font-medium text-gray-900">Comportamento do Agente</h3>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instruções adicionais (system prompt)</label>
              <textarea value={agentForm.system_prompt}
                onChange={e => setAgentForm(f => ({ ...f, system_prompt: e.target.value }))}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                placeholder="Seja sempre gentil e profissional. Ofereça desconto de 10% para estadias acima de 3 noites..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Transferir para humano após mensagens sem conversão</label>
              <div className="flex items-center gap-3">
                <input type="number" min={3} max={50} value={agentForm.auto_transfer_after_messages}
                  onChange={e => setAgentForm(f => ({ ...f, auto_transfer_after_messages: parseInt(e.target.value) || 10 }))}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                <span className="text-sm text-gray-500">mensagens</span>
              </div>
            </div>
          </div>

          <button type="submit" disabled={savingAgent}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-lg text-sm transition-colors">
            {savingAgent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingAgent ? 'Salvando…' : savedAgent ? '✓ Salvo!' : 'Salvar'}
          </button>
        </form>
      )}

      {/* ── TAB: INTEGRAÇÕES ── */}
      {tab === 'integrations' && (
        <form onSubmit={handleSaveCredentials} className="space-y-5">
          {/* Z-API */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wifi className="w-5 h-5 text-green-500" />
                <h3 className="font-medium text-gray-900">WhatsApp via Z-API</h3>
              </div>
              {zapiForm.zapi_instance_id && zapiForm.zapi_token ? (
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">Configurado</span>
              ) : (
                <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">Não configurado</span>
              )}
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              Crie uma instância em <span className="font-medium text-gray-700">app.z-api.io</span>, conecte seu WhatsApp e cole as credenciais abaixo.
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Instance ID</label>
              <input type="text" value={zapiForm.zapi_instance_id}
                onChange={e => setZapiForm(f => ({ ...f, zapi_instance_id: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 font-mono"
                placeholder="3A1B2C3D4E5F..." />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Token</label>
              <div className="relative">
                <input type={showZapiToken ? 'text' : 'password'} value={zapiForm.zapi_token}
                  onChange={e => setZapiForm(f => ({ ...f, zapi_token: e.target.value }))}
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="Token da instância" />
                <button type="button" onClick={() => setShowZapiToken(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showZapiToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Client Token <span className="text-gray-400 font-normal">(opcional)</span></label>
              <input type="password" value={zapiForm.zapi_client_token}
                onChange={e => setZapiForm(f => ({ ...f, zapi_client_token: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                placeholder="Security token do plano Business" />
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleTestZapi}
                disabled={!zapiForm.zapi_instance_id || !zapiForm.zapi_token || testZapi === 'testing'}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Testar conexão
              </button>
              <TestBadge status={testZapi} />
            </div>
          </div>

          {/* HITS PMS */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-5 h-5 text-blue-500" />
                <h3 className="font-medium text-gray-900">HITS PMS</h3>
              </div>
              {hitsForm.hits_api_url && hitsForm.hits_tenant_name ? (
                <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-medium">Configurado</span>
              ) : (
                <span className="text-xs bg-yellow-50 text-yellow-700 border border-yellow-200 px-2 py-0.5 rounded-full font-medium">Não configurado</span>
              )}
            </div>

            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-3">
              Credenciais fornecidas pela HITS para integração via API. Consulte seu gerente de conta.
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">API URL</label>
                <input type="url" value={hitsForm.hits_api_url}
                  onChange={e => setHitsForm(f => ({ ...f, hits_api_url: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="https://api.hitspms.net" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tenant Name</label>
                <input type="text" value={hitsForm.hits_tenant_name}
                  onChange={e => setHitsForm(f => ({ ...f, hits_tenant_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="meuhotel" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Property Code</label>
                <input type="number" value={hitsForm.hits_property_code}
                  onChange={e => setHitsForm(f => ({ ...f, hits_property_code: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="1" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
                <input type="text" value={hitsForm.hits_client_id}
                  onChange={e => setHitsForm(f => ({ ...f, hits_client_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                  placeholder="partner_id" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                <div className="relative">
                  <input type={showHitsKey ? 'text' : 'password'} value={hitsForm.hits_api_key}
                    onChange={e => setHitsForm(f => ({ ...f, hits_api_key: e.target.value }))}
                    className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500"
                    placeholder="secret_key" />
                  <button type="button" onClick={() => setShowHitsKey(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showHitsKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={handleTestHits}
                disabled={!hitsForm.hits_api_url || !hitsForm.hits_tenant_name || testHits === 'testing'}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                Testar credenciais
              </button>
              <TestBadge status={testHits} />
            </div>
          </div>

          <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <span>As credenciais são armazenadas com segurança e usadas apenas para consultas de disponibilidade e tarifas.</span>
          </div>

          <button type="submit" disabled={savingCreds}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-lg text-sm transition-colors">
            {savingCreds ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingCreds ? 'Salvando…' : savedCreds ? '✓ Salvo!' : 'Salvar credenciais'}
          </button>
        </form>
      )}

      {/* ── TAB: HORÁRIOS ── */}
      {tab === 'hours' && (
        <form onSubmit={handleSaveHours} className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Clock className="w-5 h-5 text-violet-500" />
                <div>
                  <p className="font-medium text-gray-900">Horário de atendimento</p>
                  <p className="text-sm text-gray-500">Fora do horário, o agente avisará que retornará em breve</p>
                </div>
              </div>
              <button type="button" onClick={() => setHoursEnabled(v => !v)}
                className={`relative w-12 h-6 rounded-full transition-colors ${hoursEnabled ? 'bg-violet-500' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${hoursEnabled ? 'translate-x-7' : 'translate-x-1'}`} />
              </button>
            </div>

            {hoursEnabled && (
              <div className="space-y-4 pt-2 border-t border-gray-100">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fuso horário</label>
                  <select value={timezone} onChange={e => setTimezone(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500">
                    <option value="America/Sao_Paulo">América/São Paulo (BRT)</option>
                    <option value="America/Manaus">América/Manaus (AMT)</option>
                    <option value="America/Belem">América/Belém (BRT)</option>
                    <option value="America/Fortaleza">América/Fortaleza (BRT-3)</option>
                    <option value="America/Recife">América/Recife (BRT-3)</option>
                    <option value="America/Cuiaba">América/Cuiabá (AMT)</option>
                    <option value="America/Porto_Velho">América/Porto Velho (AMT)</option>
                    <option value="America/Noronha">Fernando de Noronha (FNT)</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700 mb-2">Dias e horários</p>
                  {days.map((day) => {
                    const label = WEEKDAYS.find(w => w.key === day.key)?.label || day.key
                    return (
                      <div key={day.key} className={`flex items-center gap-3 py-2 px-3 rounded-lg transition-colors ${day.active ? 'bg-violet-50' : 'bg-gray-50'}`}>
                        <button type="button"
                          onClick={() => updateDay(day.key, { active: !day.active })}
                          className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${day.active ? 'bg-violet-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${day.active ? 'translate-x-4' : 'translate-x-0.5'}`} />
                        </button>
                        <span className={`w-20 text-sm font-medium ${day.active ? 'text-gray-900' : 'text-gray-400'}`}>{label}</span>
                        {day.active && (
                          <div className="flex items-center gap-2 flex-1">
                            <input type="time" value={day.start}
                              onChange={e => updateDay(day.key, { start: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
                            <span className="text-gray-400 text-sm">às</span>
                            <input type="time" value={day.end}
                              onChange={e => updateDay(day.key, { end: e.target.value })}
                              className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-violet-500" />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button type="submit" disabled={savingHours}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-lg text-sm transition-colors">
            {savingHours ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingHours ? 'Salvando…' : savedHours ? '✓ Salvo!' : 'Salvar horários'}
          </button>
        </form>
      )}
      {/* ── TAB: GALERIA ── */}
      {tab === 'gallery' && (
        <div className="space-y-5">
          {/* Upload */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <Image className="w-5 h-5 text-violet-500" />
              <h3 className="font-medium text-gray-900">Adicionar foto</h3>
            </div>
            <p className="text-xs text-gray-500">
              Fotos organizadas por categoria. O agente pode enviá-las automaticamente ao WhatsApp quando o hóspede pedir.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={uploadCategory}
                  onChange={e => setUploadCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                >
                  {MEDIA_CATEGORIES.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legenda (opcional)</label>
                <input
                  type="text"
                  value={uploadCaption}
                  onChange={e => setUploadCaption(e.target.value)}
                  placeholder="Ex: Vista panorâmica da piscina"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                />
              </div>
            </div>
            <label className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${uploading ? 'border-violet-300 bg-violet-50' : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50'}`}>
              {uploading
                ? <><Loader2 className="w-4 h-4 text-violet-500 animate-spin" /><span className="text-sm text-violet-600">Enviando…</span></>
                : <><Plus className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-500">Clique para selecionar uma foto</span></>
              }
              <input type="file" accept="image/*" className="hidden" onChange={handleUploadPhoto} disabled={uploading} />
            </label>
            {uploadError && (
              <p className="text-xs text-red-600 flex items-center gap-1"><X className="w-3 h-3" />{uploadError}</p>
            )}
          </div>

          {/* Gallery by category */}
          {MEDIA_CATEGORIES.filter(c => media.some(m => m.category === c.key)).map(cat => (
            <div key={cat.key} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h4 className="font-medium text-gray-900 mb-3 text-sm">{cat.label} <span className="text-gray-400 font-normal">({media.filter(m => m.category === cat.key).length})</span></h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {media.filter(m => m.category === cat.key).map(item => (
                  <div key={item.id} className="relative group rounded-lg overflow-hidden border border-gray-200 aspect-video bg-gray-100">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.url} alt={item.caption || cat.label} className="w-full h-full object-cover" />
                    {item.caption && (
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                        <p className="text-[10px] text-white truncate">{item.caption}</p>
                      </div>
                    )}
                    <button
                      onClick={() => handleDeletePhoto(item)}
                      className="absolute top-1 right-1 w-6 h-6 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {media.length === 0 && (
            <div className="flex flex-col items-center py-12 text-gray-400 gap-2 bg-white rounded-xl border border-gray-200">
              <Image className="w-10 h-10 opacity-20" />
              <p className="text-sm">Nenhuma foto ainda</p>
              <p className="text-xs text-center">Adicione fotos dos quartos e áreas do hotel para o agente usar no atendimento</p>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: TEMPLATES ── */}
      {tab === 'templates' && (
        <form onSubmit={handleSaveTemplates} className="space-y-5">
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-4">
            <div>
              <h3 className="font-medium text-gray-900 mb-1">Templates de mensagem rápida</h3>
              <p className="text-xs text-gray-500">Mensagens prontas que aparecem no painel de atendimento. Clique em uma para preenchê-la automaticamente.</p>
            </div>

            {/* Add new */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTemplate}
                onChange={e => setNewTemplate(e.target.value)}
                placeholder="Digite um novo template…"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const t = newTemplate.trim()
                    if (t && !templates.includes(t)) {
                      setTemplates(prev => [...prev, t])
                      setNewTemplate('')
                    }
                  }
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const t = newTemplate.trim()
                  if (t && !templates.includes(t)) {
                    setTemplates(prev => [...prev, t])
                    setNewTemplate('')
                  }
                }}
                className="px-3 py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="space-y-2">
              {templates.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum template ainda. Adicione um acima.</p>
              )}
              {templates.map((t, i) => (
                <div key={i} className="flex items-start gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <p className="flex-1 text-sm text-gray-800 leading-relaxed">{t}</p>
                  <button
                    type="button"
                    onClick={() => setTemplates(prev => prev.filter((_, idx) => idx !== i))}
                    className="flex-shrink-0 text-gray-400 hover:text-red-500 transition-colors mt-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <button type="submit" disabled={savingTemplates}
            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:bg-violet-300 text-white font-medium rounded-lg text-sm transition-colors">
            {savingTemplates ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingTemplates ? 'Salvando…' : savedTemplates ? '✓ Salvo!' : 'Salvar templates'}
          </button>
        </form>
      )}
    </div>
  )
}
