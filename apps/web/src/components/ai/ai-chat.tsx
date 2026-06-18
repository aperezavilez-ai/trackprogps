'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Loader2, X } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

const SUGGESTED_QUESTIONS = [
  '¿Dónde está la unidad ECO-001?',
  '¿Qué vehículos excedieron velocidad hoy?',
  '¿Cuántos kilómetros recorrió la flota hoy?',
  '¿Qué alertas se generaron en la última hora?',
  '¿Qué vehículos están detenidos?',
]

interface AIChatProps {
  onClose?: () => void
}

export function AIChat({ onClose }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      role:      'assistant',
      content:   'Hola, soy tu asistente de flota. Puedo consultarte información en tiempo real sobre tus vehículos, alertas y kilómetros. ¿En qué te puedo ayudar?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput]       = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return

    const userMessage: Message = { role: 'user', content, timestamp: new Date() }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          messages: [...messages, userMessage]
            .filter(m => m.role !== 'assistant' || messages.indexOf(m) > 0) // skip greeting
            .map(m => ({ role: m.role, content: m.content })),
        }),
      })

      const data = await response.json()

      setMessages(prev => [
        ...prev,
        {
          role:      'assistant',
          content:   data.message,
          timestamp: new Date(),
        },
      ])
    } catch {
      setMessages(prev => [
        ...prev,
        {
          role:      'assistant',
          content:   'Lo siento, no pude conectarme al asistente. Por favor intenta de nuevo.',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-white" />
          <span className="text-sm font-semibold text-white">Asistente de Flota</span>
          <span className="text-xs text-orange-200">• IA</span>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-orange-200 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot className="w-4 h-4 text-orange-500" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-orange-500 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-900 rounded-tl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-orange-200' : 'text-gray-400'}`}>
                {msg.timestamp.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {msg.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <User className="w-4 h-4 text-gray-600" />
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-2 justify-start">
            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center">
              <Bot className="w-4 h-4 text-orange-500" />
            </div>
            <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Suggested questions */}
      {messages.length === 1 && (
        <div className="px-4 pb-2">
          <p className="text-xs text-gray-400 mb-2">Preguntas frecuentes:</p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => void sendMessage(q)}
                className="text-xs bg-orange-50 text-orange-500 border border-orange-100 rounded-full px-3 py-1 hover:bg-orange-100"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                void sendMessage(input)
              }
            }}
            placeholder="Pregunta sobre tu flota..."
            rows={1}
            className="flex-1 resize-none border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="p-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
