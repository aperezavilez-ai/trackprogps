'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Mail, Phone, Send, XCircle, CheckCircle2 } from 'lucide-react'

interface Ticket {
  id: string
  email: string
  phone: string
  subject: string
  status: string
  source: string
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  body: string
  is_staff: boolean
  created_at: string
  author?: { full_name: string } | null
}

const STATUS_TABS = [
  { value: 'nuevo', label: 'Nuevos' },
  { value: 'en_proceso', label: 'En proceso' },
  { value: 'respondido', label: 'Respondidos' },
  { value: 'cerrado', label: 'Cerrados' },
  { value: 'todos', label: 'Todos' },
] as const

const STATUS_LABELS: Record<string, string> = {
  nuevo: 'Nuevo',
  en_proceso: 'En proceso',
  respondido: 'Respondido',
  cerrado: 'Cerrado',
}

const STATUS_COLORS: Record<string, string> = {
  nuevo: 'bg-orange-100 text-orange-700',
  en_proceso: 'bg-blue-100 text-blue-700',
  respondido: 'bg-green-100 text-green-700',
  cerrado: 'bg-gray-100 text-gray-600',
}

const SOURCE_LABELS: Record<string, string> = {
  login: 'Login',
  register: 'Registro',
  descargar: 'Descargar',
  other: 'Web',
}

interface Props {
  initialTicketId?: string | null
}

export function SupportInboxPanel({ initialTicketId }: Props) {
  const [tab, setTab] = useState<string>('nuevo')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(initialTicketId ?? null)
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [loadingList, setLoadingList] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const loadTickets = useCallback(async () => {
    setLoadingList(true)
    const res = await fetch(`/api/support/tickets?status=${tab}`)
    const json = await res.json()
    setTickets(json.data ?? [])
    setLoadingList(false)
  }, [tab])

  const loadTicket = useCallback(async (id: string) => {
    setLoadingDetail(true)
    setError('')
    const res = await fetch(`/api/support/tickets/${id}`)
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Error al cargar')
      setLoadingDetail(false)
      return
    }
    setSelectedTicket(json.data.ticket)
    setMessages(json.data.messages ?? [])
    setLoadingDetail(false)
    void loadTickets()
  }, [loadTickets])

  useEffect(() => { void loadTickets() }, [loadTickets])

  useEffect(() => {
    if (initialTicketId) {
      setSelectedId(initialTicketId)
      void loadTicket(initialTicketId)
    }
  }, [initialTicketId, loadTicket])

  function selectTicket(id: string) {
    setSelectedId(id)
    setReply('')
    setSuccess('')
    void loadTicket(id)
  }

  async function sendReply(close: boolean) {
    if (!selectedId || !reply.trim()) return
    setSending(true)
    setError('')
    setSuccess('')
    try {
      const res = await fetch(`/api/support/tickets/${selectedId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: reply.trim(), close }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error al enviar')
      setReply('')
      setSuccess(json.message ?? 'Enviado')
      await loadTicket(selectedId)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error')
    } finally {
      setSending(false)
    }
  }

  async function setStatus(status: string) {
    if (!selectedId) return
    await fetch(`/api/support/tickets/${selectedId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    await loadTicket(selectedId)
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 min-h-[560px]">
      {/* Lista */}
      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-2xl overflow-hidden flex flex-col">
        <div className="flex flex-wrap gap-1 p-3 border-b border-gray-100 bg-gray-50">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition ${
                tab === t.value ? 'bg-orange-500 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {loadingList ? (
            <div className="py-12 flex justify-center text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          ) : tickets.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-400">No hay consultas en este filtro</p>
          ) : (
            tickets.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => selectTicket(t.id)}
                className={`w-full text-left px-4 py-3 hover:bg-orange-50/50 transition ${
                  selectedId === t.id ? 'bg-orange-50 border-l-2 border-l-orange-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-gray-900 truncate">{t.subject}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[t.status] ?? ''}`}>
                    {STATUS_LABELS[t.status] ?? t.status}
                  </span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate">{t.email}</div>
                <div className="text-[10px] text-gray-400 mt-1">
                  {SOURCE_LABELS[t.source] ?? t.source} · {new Date(t.created_at).toLocaleString('es-MX')}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalle */}
      <div className="lg:col-span-3 bg-white border border-gray-200 rounded-2xl flex flex-col overflow-hidden">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 text-sm p-8">
            Selecciona una consulta de la lista
          </div>
        ) : loadingDetail ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
          </div>
        ) : selectedTicket ? (
          <>
            <div className="p-4 border-b border-gray-100">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-semibold text-gray-900">{selectedTicket.subject}</h3>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[selectedTicket.status] ?? ''}`}>
                  {STATUS_LABELS[selectedTicket.status]}
                </span>
              </div>
              <div className="flex flex-wrap gap-4 mt-2 text-sm text-gray-600">
                <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{selectedTicket.email}</span>
                <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{selectedTicket.phone}</span>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                {selectedTicket.status !== 'cerrado' && (
                  <button
                    type="button"
                    onClick={() => setStatus('cerrado')}
                    className="text-xs flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    <XCircle className="w-3 h-3" /> Cerrar ticket
                  </button>
                )}
                {selectedTicket.status === 'cerrado' && (
                  <button
                    type="button"
                    onClick={() => setStatus('en_proceso')}
                    className="text-xs flex items-center gap-1 px-2 py-1 border border-gray-200 rounded-lg hover:bg-gray-50"
                  >
                    Reabrir
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50/50">
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`max-w-[90%] rounded-xl px-4 py-3 text-sm ${
                    m.is_staff
                      ? 'ml-auto bg-orange-500 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}
                >
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className={`text-[10px] mt-2 ${m.is_staff ? 'text-orange-100' : 'text-gray-400'}`}>
                    {m.is_staff ? (m.author?.full_name ?? 'Soporte') : 'Cliente'} ·{' '}
                    {new Date(m.created_at).toLocaleString('es-MX')}
                  </p>
                </div>
              ))}
            </div>

            {selectedTicket.status !== 'cerrado' && (
              <div className="p-4 border-t border-gray-100 space-y-3">
                <textarea
                  value={reply}
                  onChange={e => setReply(e.target.value)}
                  rows={3}
                  placeholder="Escribe tu respuesta al cliente…"
                  className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                />
                {error && <p className="text-sm text-red-600">{error}</p>}
                {success && (
                  <p className="text-sm text-green-700 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> {success}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={sending || !reply.trim()}
                    onClick={() => sendReply(false)}
                    className="flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-orange-600 disabled:opacity-50"
                  >
                    {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Enviar respuesta
                  </button>
                  <button
                    type="button"
                    disabled={sending || !reply.trim()}
                    onClick={() => sendReply(true)}
                    className="text-sm px-4 py-2.5 border border-gray-300 rounded-xl hover:bg-gray-50 disabled:opacity-50"
                  >
                    Enviar y cerrar
                  </button>
                </div>
                <p className="text-[11px] text-gray-400">
                  La respuesta se envía por correo al cliente y queda guardada en el historial.
                </p>
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  )
}
