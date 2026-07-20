import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const TIPO_ICONO = {
  asignacion: '📌',
  recordatorio: '⏰',
  vencido: '⚠️',
  alerta: '🔴',
  info: 'ℹ️',
}

export default function NotificationBell() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [toast, setToast] = useState(null)
  const popoverRef = useRef(null)

  const unreadCount = notifications.filter((n) => !n.leida).length

  // Carga inicial
  useEffect(() => {
    if (!user) return
    supabase
      .from('notifications')
      .select('*')
      .order('fecha', { ascending: false })
      .limit(30)
      .then(({ data, error }) => {
        if (!error) setNotifications(data)
      })
  }, [user])

  // Suscripción Realtime: nuevas notificaciones para este usuario
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const nueva = payload.new
          setNotifications((prev) => [nueva, ...prev])
          setToast(nueva)
          // Auto-ocultar el aviso emergente tras 6s
          setTimeout(() => setToast((current) => (current?.id === nueva.id ? null : current)), 6000)
        }
      )
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [user])

  // Cerrar el desplegable al hacer clic afuera
  useEffect(() => {
    function handleClickOutside(e) {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  async function markAsRead(id) {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, leida: true } : n)))
    await supabase.from('notifications').update({ leida: true }).eq('id', id)
  }

  async function markAllAsRead() {
    const unreadIds = notifications.filter((n) => !n.leida).map((n) => n.id)
    if (unreadIds.length === 0) return
    setNotifications((prev) => prev.map((n) => ({ ...n, leida: true })))
    await supabase.from('notifications').update({ leida: true }).in('id', unreadIds)
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg hover:bg-slate-100 transition-colors"
        aria-label="Notificaciones"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-600">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Aviso emergente (toast) para notificaciones que llegan en vivo */}
      {toast && (
        <div className="fixed top-4 right-4 z-[100] w-80 bg-white border border-slate-200 shadow-lg rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2.5">
            <span className="text-lg leading-none">{TIPO_ICONO[toast.tipo] || 'ℹ️'}</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-slate-800">Nueva notificación</p>
              <p className="text-xs text-slate-500 mt-0.5">{toast.mensaje}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-400 hover:text-slate-600 text-xs">✕</button>
          </div>
        </div>
      )}

      {/* Lista desplegable */}
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-800">Notificaciones</span>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                Marcar todas como leídas
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notifications.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-8">Sin notificaciones por ahora.</p>
            )}
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => markAsRead(n.id)}
                className={`w-full text-left px-4 py-3 flex items-start gap-2.5 hover:bg-slate-50 transition-colors ${
                  n.leida ? 'opacity-60' : 'bg-indigo-50/40'
                }`}
              >
                <span className="text-base leading-none mt-0.5">{TIPO_ICONO[n.tipo] || 'ℹ️'}</span>
                <div className="flex-1">
                  <p className="text-xs text-slate-700 font-medium leading-snug">{n.mensaje}</p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {new Date(n.fecha).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                {!n.leida && <span className="w-2 h-2 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
