'use client'

import { useState, useEffect, useCallback } from 'react'
import { X, CheckCircle, AlertTriangle, Info, XCircle } from 'lucide-react'
import { createSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRealtimeAlerts } from '@/lib/hooks/use-realtime'

type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id:      string
  type:    ToastType
  title:   string
  message?: string
}

const ICONS = {
  success: CheckCircle,
  error:   XCircle,
  warning: AlertTriangle,
  info:    Info,
}

const STYLES = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error:   'bg-red-50 border-red-200 text-red-800',
  warning: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  info:    'bg-orange-50 border-orange-200 text-orange-800',
}

// Global event bus for toasts
const toastListeners: Array<(toast: Toast) => void> = []

export function addToast(toast: Omit<Toast, 'id'>) {
  const t = { ...toast, id: Math.random().toString(36).slice(2) }
  toastListeners.forEach(fn => fn(t))
}

interface ToastContainerProps {
  companyId?: string
}

export function ToastContainer({ companyId }: ToastContainerProps) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback((toast: Toast) => {
    setToasts(prev => [...prev.slice(-4), toast]) // max 5 toasts
    // Auto-remove after 5s
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== toast.id))
    }, 5000)
  }, [])

  useEffect(() => {
    toastListeners.push(push)
    return () => {
      const idx = toastListeners.indexOf(push)
      if (idx >= 0) toastListeners.splice(idx, 1)
    }
  }, [push])

  // Show toast on new alert
  useRealtimeAlerts(companyId ?? '', (alert: unknown) => {
    const a = alert as { title: string; severity: string; message: string }
    push({
      id:      Math.random().toString(36).slice(2),
      type:    a.severity === 'critical' || a.severity === 'high' ? 'warning' : 'info',
      title:   a.title,
      message: a.message,
    })
  })

  if (!toasts.length) return null

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full">
      {toasts.map(toast => {
        const Icon  = ICONS[toast.type]
        const style = STYLES[toast.type]
        return (
          <div
            key={toast.id}
            className={`flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-slide-up ${style}`}
          >
            <Icon className="w-4 h-4 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{toast.title}</div>
              {toast.message && (
                <div className="text-xs mt-0.5 opacity-80 line-clamp-2">{toast.message}</div>
              )}
            </div>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="opacity-60 hover:opacity-100 flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
