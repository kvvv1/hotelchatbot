'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { BedDouble, MessageSquare, LayoutGrid, Sparkles } from 'lucide-react'

type Mode = 'login' | 'signup'
type View = 'login' | 'forgot' | 'forgot-sent'

export default function LoginPage() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('login')
  const [view, setView] = useState<View>('login')

  // login fields
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [forgotEmail, setForgotEmail] = useState('')

  // signup fields
  const [hotelName, setHotelName] = useState('')
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [signupConfirm, setSignupConfirm] = useState('')

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  function switchMode(next: Mode) {
    if (next === mode) return
    setMode(next)
    setError(null)
    setNotice(null)
    try { window.history.replaceState({}, '', next === 'login' ? '/login' : '/signup') } catch {}
  }

  async function onLoginSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError(signInError.message); return }
      if (!data.session) { setError('Sessão não iniciada. Tente novamente.'); return }
      router.replace('/dashboard')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  async function onForgotSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (resetError) { setError(resetError.message); return }
      setView('forgot-sent')
    } finally {
      setLoading(false)
    }
  }

  async function onSignupSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    if (signupPassword !== signupConfirm) {
      setError('As senhas não coincidem.')
      return
    }
    if (signupPassword.length < 6) {
      setError('A senha precisa ter no mínimo 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      const supabase = createClient()
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: signupEmail,
        password: signupPassword,
        options: { data: { full_name: hotelName } },
      })
      if (signUpError) { setError(signUpError.message); return }

      if (!data.session) {
        setNotice('Conta criada! Verifique seu email para confirmar e depois faça login.')
        return
      }

      // Create hotel + profile via server-side API
      const setupRes = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hotelName }),
      })
      if (!setupRes.ok) {
        const err = await setupRes.json().catch(() => ({}))
        setError(err.error || 'Erro ao configurar o hotel. Tente novamente.')
        return
      }

      router.replace('/dashboard')
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  const isLogin = mode === 'login'

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden overflow-y-auto lg:h-screen lg:overflow-hidden bg-gradient-to-br from-violet-50 via-white to-purple-50">
      {/* Background blobs — kept inside overflow-x-hidden so they don't shift the layout */}
      <div className="pointer-events-none absolute left-0 -top-16 size-64 sm:size-80 rounded-full bg-violet-200/45 blur-3xl float-slow -translate-x-1/2" />
      <div className="pointer-events-none absolute right-0 bottom-0 size-72 sm:size-96 rounded-full bg-purple-200/35 blur-3xl float translate-x-1/3 translate-y-1/3" />
      <div className="pointer-events-none absolute left-1/2 top-8 size-48 -translate-x-1/2 rounded-full bg-violet-200/25 blur-3xl float-fast" />

      {/* Grid overlay */}
      <div className="pointer-events-none absolute inset-0 auth-grid" aria-hidden />

      <main className="mx-auto flex min-h-[100dvh] w-full max-w-7xl items-center px-4 py-6 sm:px-6 sm:py-8 lg:h-screen lg:px-4 lg:py-4" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}>
        <div className="grid w-full items-center gap-4 sm:gap-6 lg:grid-cols-[minmax(0,0.38fr)_minmax(0,0.62fr)] lg:gap-6 lg:h-full">

          {/* ── Left: Form ── */}
          <section className="lg:h-full lg:flex lg:items-center">
            <div className="group relative rounded-2xl border border-white/60 bg-white/60 p-4 shadow-[0_20px_60px_-40px_rgba(2,6,23,0.45)] ring-1 ring-black/5 backdrop-blur-xl transition-all duration-300 hover:bg-white/70 sm:p-5 lg:p-6 w-full">
              <div className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-br from-white/55 to-transparent" />
              <div className="pointer-events-none absolute inset-0 rounded-2xl auth-shimmer" />
              <div className="pointer-events-none absolute -inset-[2px] rounded-[18px] bg-gradient-to-r from-violet-200/0 via-violet-200/35 to-purple-200/0 opacity-0 blur transition-opacity duration-500 group-hover:opacity-100" />

              {/* Header */}
              <header className="relative">
                <div className="inline-flex items-center gap-1.5 rounded-full border border-violet-200/60 bg-gradient-to-r from-violet-50/80 to-purple-50/60 px-2.5 py-1 shadow-sm backdrop-blur-sm">
                  <Sparkles className="size-3 text-violet-600" strokeWidth={2.5} />
                  <span className="text-[10px] font-semibold text-violet-700">Portal do hotel</span>
                </div>

                <div className="mt-2.5 flex items-center gap-2.5">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-violet-500/30">
                    <BedDouble className="size-5 text-white" strokeWidth={2} />
                  </div>
                  <div>
                    <h1 className="text-xl font-bold tracking-tight">
                      <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                        HotelTalk
                      </span>
                    </h1>
                  </div>
                </div>

                <p className="mt-1.5 text-xs font-medium text-neutral-600">
                  Agente de IA que atende hóspedes no WhatsApp e fecha reservas.
                </p>
              </header>

              {/* Tabs */}
              <nav className="relative mt-4">
                <div className="relative grid grid-cols-2 rounded-xl border border-neutral-200/80 bg-white/70 p-1">
                  <div
                    className="pointer-events-none absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-sm transition-transform duration-300"
                    style={{ transform: isLogin ? 'translateX(0%)' : 'translateX(100%)' }}
                  />
                  <button type="button" onClick={() => switchMode('login')}
                    className={`relative rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${isLogin ? 'text-white' : 'text-neutral-700 hover:text-neutral-900'}`}>
                    Entrar
                  </button>
                  <button type="button" onClick={() => switchMode('signup')}
                    className={`relative rounded-xl px-3 py-2 text-xs sm:text-sm font-semibold transition-colors ${!isLogin ? 'text-white' : 'text-neutral-700 hover:text-neutral-900'}`}>
                    Criar conta
                  </button>
                </div>
                <p className="mt-2 text-[10px] sm:text-xs text-neutral-500">
                  {isLogin ? 'Entre com seu email e senha para acessar.' : 'Crie sua conta e comece a atender hóspedes.'}
                </p>
              </nav>

              {/* Form section */}
              <section className="relative mt-3">
                {/* ── LOGIN ── */}
                <div className={`transition-all duration-300 ease-out ${isLogin ? 'opacity-100 translate-y-0' : 'pointer-events-none absolute inset-0 opacity-0 translate-y-2'}`} aria-hidden={!isLogin}>
                  {view === 'forgot-sent' ? (
                    <div className="space-y-4">
                      <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
                        <p className="font-semibold mb-1">Email enviado!</p>
                        <p>Verifique sua caixa de entrada em <span className="font-medium">{forgotEmail}</span> e clique no link para redefinir sua senha.</p>
                      </div>
                      <button type="button" onClick={() => { setView('login'); setError(null) }}
                        className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50">
                        Voltar ao login
                      </button>
                    </div>
                  ) : view === 'forgot' ? (
                    <form onSubmit={onForgotSubmit} className="space-y-4">
                      <div>
                        <p className="text-sm text-neutral-600 mb-3">Digite seu email e enviaremos um link para redefinir sua senha.</p>
                        <label className="text-sm font-medium" htmlFor="forgot-email">Email</label>
                        <input id="forgot-email" type="email" autoComplete="email" required value={forgotEmail}
                          onChange={e => setForgotEmail(e.target.value)}
                          className="mt-1.5 w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none ring-1 ring-transparent transition focus:border-violet-400 focus:ring-violet-200" />
                      </div>
                      {error && <p className="auth-fade-up rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
                      <button type="submit" disabled={loading}
                        className="w-full rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200/40 transition-transform active:scale-[0.99] disabled:opacity-60">
                        {loading ? 'Enviando…' : 'Enviar link de recuperação'}
                      </button>
                      <button type="button" onClick={() => { setView('login'); setError(null) }}
                        className="w-full text-center text-sm text-neutral-500 hover:text-neutral-700 underline-offset-4 hover:underline">
                        Voltar ao login
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={onLoginSubmit} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="email">Email</label>
                        <input id="email" type="email" autoComplete="email" required value={email}
                          onChange={e => setEmail(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none ring-1 ring-transparent transition focus:border-violet-400 focus:ring-violet-200"
                          placeholder="seu@email.com" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-sm font-medium" htmlFor="password">Senha</label>
                        <input id="password" type="password" autoComplete="current-password" required value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none ring-1 ring-transparent transition focus:border-violet-400 focus:ring-violet-200"
                          placeholder="••••••••" />
                        <div className="flex justify-end">
                          <button type="button" onClick={() => { setForgotEmail(email); setView('forgot'); setError(null) }}
                            className="text-xs font-medium text-neutral-500 underline-offset-4 hover:text-neutral-700 hover:underline">
                            Esqueci minha senha
                          </button>
                        </div>
                      </div>
                      {error && <p className="auth-fade-up rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
                      <button type="submit" disabled={loading}
                        className="w-full rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200/40 transition-transform active:scale-[0.99] disabled:opacity-60">
                        {loading ? 'Acessando…' : 'Acessar painel'}
                      </button>
                    </form>
                  )}
                </div>

                {/* ── SIGNUP ── */}
                <div className={`transition-all duration-300 ease-out ${!isLogin ? 'opacity-100 translate-y-0' : 'pointer-events-none absolute inset-0 opacity-0 translate-y-2'}`} aria-hidden={isLogin}>
                  <form onSubmit={onSignupSubmit} className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="hotel-name">Nome do hotel</label>
                      <input id="hotel-name" type="text" required value={hotelName}
                        onChange={e => setHotelName(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none ring-1 ring-transparent transition focus:border-violet-400 focus:ring-violet-200"
                        placeholder="Ex.: Hotel Macuco" />
                      <p className="text-[10px] text-neutral-500">Usaremos esse nome para configurar seu painel.</p>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="signup-email">Email</label>
                      <input id="signup-email" type="email" autoComplete="email" required value={signupEmail}
                        onChange={e => setSignupEmail(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none ring-1 ring-transparent transition focus:border-violet-400 focus:ring-violet-200"
                        placeholder="seu@email.com" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="signup-password">Senha</label>
                      <input id="signup-password" type="password" autoComplete="new-password" required value={signupPassword}
                        onChange={e => setSignupPassword(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none ring-1 ring-transparent transition focus:border-violet-400 focus:ring-violet-200"
                        placeholder="Mínimo 6 caracteres" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium" htmlFor="signup-confirm">Confirmar senha</label>
                      <input id="signup-confirm" type="password" autoComplete="new-password" required value={signupConfirm}
                        onChange={e => setSignupConfirm(e.target.value)}
                        className="w-full rounded-xl border border-neutral-200 bg-white/90 px-4 py-3 text-sm text-neutral-900 shadow-sm outline-none ring-1 ring-transparent transition focus:border-violet-400 focus:ring-violet-200"
                        placeholder="Repita a senha" />
                    </div>
                    {error && <p className="auth-fade-up rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
                    {notice && <p className="auth-fade-up rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}
                    <button type="submit" disabled={loading}
                      className="w-full rounded-xl bg-gradient-to-br from-violet-600 to-purple-700 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-violet-200/40 transition-transform active:scale-[0.99] disabled:opacity-60">
                      {loading ? 'Criando conta…' : 'Criar conta'}
                    </button>
                  </form>
                </div>
              </section>

              <footer className="relative mt-5 text-center text-xs text-neutral-400">
                © {new Date().getFullYear()} HotelTalk
              </footer>
            </div>
          </section>

          {/* ── Right: Showcase ── */}
          <section className="hidden lg:flex lg:h-full lg:items-center">
            <div className="relative overflow-hidden rounded-2xl border border-white/60 bg-gradient-to-br from-white/60 via-white/50 to-white/40 p-4 shadow-[0_20px_70px_-40px_rgba(139,92,246,0.35)] ring-1 ring-black/5 backdrop-blur-xl lg:p-5 w-full">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-violet-50/40 via-transparent to-purple-50/30" />
              <div className="pointer-events-none absolute -right-24 -top-24 size-64 rounded-full bg-violet-300/20 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-12 -left-12 size-48 rounded-full bg-purple-300/15 blur-2xl" />

              <div className="relative">
                <h2 className="max-w-lg text-xl font-bold leading-tight tracking-tight lg:text-2xl">
                  <span className="bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                    Um agente de IA
                  </span>{' '}
                  <span className="text-neutral-900">
                    que atende, negocia e fecha reservas pelo WhatsApp.
                  </span>
                </h2>

                {/* Feature cards */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <div className="group relative overflow-hidden rounded-lg border border-white/70 bg-gradient-to-br from-white/90 to-white/70 p-2 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md">
                    <div className="pointer-events-none absolute -right-8 -top-8 size-20 rounded-full bg-violet-400/10 blur-2xl transition-all group-hover:bg-violet-400/20" />
                    <div className="relative">
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-violet-600 shadow-md shadow-violet-500/30">
                          <LayoutGrid className="size-3 text-white" strokeWidth={2.5} />
                        </div>
                        <p className="font-bold text-neutral-900 text-xs">Kanban</p>
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-600 leading-relaxed">
                        Organize conversas por status e nunca perca uma reserva.
                      </p>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-lg border border-white/70 bg-gradient-to-br from-white/90 to-white/70 p-2 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md">
                    <div className="pointer-events-none absolute -right-8 -top-8 size-20 rounded-full bg-purple-400/10 blur-2xl transition-all group-hover:bg-purple-400/20" />
                    <div className="relative">
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-md shadow-purple-500/30">
                          <MessageSquare className="size-3 text-white" strokeWidth={2.5} />
                        </div>
                        <p className="font-bold text-neutral-900 text-xs">Agente 24/7</p>
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-600 leading-relaxed">
                        Entende contexto, negocia e fecha reservas no automático.
                      </p>
                    </div>
                  </div>

                  <div className="group relative overflow-hidden rounded-lg border border-white/70 bg-gradient-to-br from-white/90 to-white/70 p-2 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-md">
                    <div className="pointer-events-none absolute -right-8 -top-8 size-20 rounded-full bg-purple-400/10 blur-2xl transition-all group-hover:bg-purple-400/20" />
                    <div className="relative">
                      <div className="flex items-center gap-1.5">
                        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-md shadow-purple-500/30">
                          <BedDouble className="size-3 text-white" strokeWidth={2.5} />
                        </div>
                        <p className="font-bold text-neutral-900 text-xs">HITS PMS</p>
                      </div>
                      <p className="mt-1 text-[10px] text-neutral-600 leading-relaxed">
                        Consulta quartos e tarifas em tempo real.
                      </p>
                    </div>
                  </div>
                </div>

                {/* WhatsApp chat simulation */}
                <div className="mt-3 rounded-lg border border-white/70 bg-gradient-to-br from-white/95 to-white/85 shadow-md backdrop-blur-md overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-2.5 py-2">
                    <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-white/20 ring-2 ring-white/40 text-white text-xs font-bold">A</div>
                    <div>
                      <p className="text-[11px] font-semibold text-white">Ana Rodrigues</p>
                      <p className="text-[9px] text-violet-100">online</p>
                    </div>
                  </div>

                  {/* Messages */}
                  <div className="bg-gradient-to-br from-violet-50/80 via-purple-50/40 to-fuchsia-50/60 p-2.5 space-y-2">
                    <div className="flex justify-start">
                      <div className="relative max-w-[80%] rounded-lg rounded-tl-sm bg-white px-3 py-2 shadow-sm border border-neutral-200/50">
                        <p className="text-[10px] text-neutral-800">Oi! Quero reservar um quarto para o fim de semana de 10/05. Tem disponibilidade?</p>
                        <span className="text-[8px] text-neutral-400 block text-right mt-0.5">14:20</span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="relative max-w-[85%]">
                        <div className="rounded-lg rounded-tr-sm bg-gradient-to-br from-violet-100 to-purple-100 shadow-sm border border-violet-200/50 px-3 py-2">
                          <p className="text-[10px] text-neutral-800 leading-relaxed">
                            Olá Ana! 😊 Que ótimo! Consultei aqui e temos sim disponibilidade para 10 e 11/05. Você prefere algo mais simples ou quer um quarto superior com vista?
                          </p>
                          <span className="text-[8px] text-neutral-500 block text-right mt-1">14:20 ✓✓</span>
                        </div>
                        <div className="absolute -right-1.5 top-0 w-0 h-0 border-t-[6px] border-t-violet-100 border-l-[6px] border-l-transparent" />
                      </div>
                    </div>

                    <div className="flex justify-start">
                      <div className="relative max-w-[75%] rounded-lg rounded-tl-sm bg-white px-3 py-2 shadow-sm border border-neutral-200/50">
                        <p className="text-[10px] text-neutral-800">Superior com vista! Quanto fica?</p>
                        <span className="text-[8px] text-neutral-400 block text-right mt-0.5">14:21</span>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <div className="relative max-w-[85%]">
                        <div className="rounded-lg rounded-tr-sm bg-gradient-to-br from-violet-100 to-purple-100 shadow-sm border border-violet-200/50 px-3 py-2">
                          <p className="text-[10px] text-neutral-800 leading-relaxed">
                            Fica R$ 450/noite, café da manhã incluso 🍳 Para as 2 noites dá R$ 900. Posso já separar para você?
                          </p>
                          <span className="text-[8px] text-neutral-500 block text-right mt-1">14:21 ✓✓</span>
                        </div>
                        <div className="absolute -right-1.5 top-0 w-0 h-0 border-t-[6px] border-t-violet-100 border-l-[6px] border-l-transparent" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[
                    { label: 'Conversas', value: '48', color: 'text-violet-600', bg: 'bg-violet-400/10' },
                    { label: 'Reservas', value: '12', color: 'text-purple-600', bg: 'bg-purple-400/10' },
                    { label: 'Atend. humano', value: '5', color: 'text-fuchsia-600', bg: 'bg-fuchsia-400/10' },
                  ].map(m => (
                    <div key={m.label} className="group relative overflow-hidden rounded-lg border border-white/70 bg-gradient-to-br from-white/90 to-white/70 p-2 shadow-sm backdrop-blur-sm transition-all hover:scale-[1.03]">
                      <div className={`pointer-events-none absolute -right-6 -top-6 size-16 rounded-full ${m.bg} blur-xl`} />
                      <p className={`text-[8px] font-bold uppercase tracking-wider ${m.color}`}>{m.label}</p>
                      <p className="mt-0.5 text-xl font-bold text-neutral-900">{m.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

        </div>
      </main>
    </div>
  )
}
