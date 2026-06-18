'use client'

import { useState } from 'react'
import { Bot, X } from 'lucide-react'
import { AIChat } from '@/components/ai/ai-chat'

export function AIAssistantButton() {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-full shadow-xl hover:shadow-2xl hover:scale-105 transition-all flex items-center justify-center"
        title="Asistente IA"
      >
        <Bot className="w-6 h-6" />
      </button>

      {/* Slide-in panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />

          {/* Panel */}
          <div className="fixed bottom-4 right-4 z-50 w-full max-w-sm h-[600px] shadow-2xl rounded-2xl overflow-hidden">
            <AIChat onClose={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  )
}
