'use client'

import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { Bot } from 'lucide-react'
import { AIChat } from '@/components/ai/ai-chat'

const AIContext = createContext<{ open: () => void }>({ open: () => {} })

export function useAIAssistant() {
  return useContext(AIContext)
}

export function AIAssistantProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)

  const openAssistant = useCallback(() => setOpen(true), [])

  useEffect(() => {
    function handleOpen() { setOpen(true) }
    window.addEventListener('open-ai-assistant', handleOpen)
    return () => window.removeEventListener('open-ai-assistant', handleOpen)
  }, [])

  return (
    <AIContext.Provider value={{ open: openAssistant }}>
      {children}
      <button
        onClick={() => setOpen(true)}
        className="fixed z-[60] w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 lg:bottom-6 lg:right-6"
        title="Asistente IA"
      >
        <Bot className="w-6 h-6" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 lg:bottom-4 lg:right-4 z-[70] w-[calc(100%-2rem)] max-w-sm h-[min(560px,calc(100dvh-7rem))] shadow-2xl rounded-2xl overflow-hidden">
            <AIChat onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </AIContext.Provider>
  )
}
