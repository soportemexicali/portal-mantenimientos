import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useTechniciansDirectory } from '../hooks/useTechniciansDirectory'

const TIPOS = [
  { value: 'info', label: 'ℹ️ Información' },
  { value: 'recordatorio', label: '⏰ Recordatorio' },
  { value: 'asignacion', label: '📌 Asignación' },
  { value: 'vencido', label: '⚠️ Vencido' },
  { value: 'alerta', label: '🔴 Alerta' },
]

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Array} props.agencies - agencias visibles para el usuario (id, title, city_id), ya cargadas en el panel
 */
export default function SendNotificationModal({ open, onClose, agencies = [] }) {
  const { technicians, loading: loadingTech } = useTechniciansDirectory()

  const [targetType, setTargetType] = useState('individual') // individual | ciudad | agencia
  const [selectedUserIds, setSelectedUserIds] = useState([])
  const [selectedCiudadId, setSelectedCiudadId] = useState('')
  const [selectedAgencyId, setSelectedAgencyId] = useState('')
  const [tipo, setTipo] = useState('info')
  const [mensaje, setMensaje] = useState('')

  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [successCount, setSuccessCount] = useState(null)

  // Ciudades derivadas del directorio de técnicos (evita otra consulta)
  const ciudades = useMemo(() => {
    const map = new Map()
    technicians.forEach((t) => {
      if (t.ciudad_id && t.ciudad) map.set(t.ciudad_id, { id: t.ciudad_id, nombre: t.ciudad })
    })
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [technicians])

  if (!open) return null

  function toggleTecnico(id) {
    setSelectedUserIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function resetForm() {
    setTargetType('individual')
    setSelectedUserIds([])
    setSelectedCiudadId('')
    setSelectedAgencyId('')
    setTipo('info')
    setMensaje('')
    setError('')
    setSuccessCount(null)
  }

  async function handleSend(e) {
    e.preventDefault()
    setError('')
    setSuccessCount(null)

    if (!mensaje.trim()) {
      setError('Escribe un mensaje.')
      return
    }
    if (targetType === 'individual' && selectedUserIds.length === 0) {
      setError('Selecciona al menos un técnico.')
      return
    }
    if (targetType === 'ciudad' && !selectedCiudadId) {
      setError('Selecciona una ciudad.')
      return
    }
    if (targetType === 'agencia' && !selectedAgencyId) {
      setError('Selecciona una agencia.')
      return
    }

    setSending(true)
    try {
      const { data, error: rpcError } = await supabase.rpc('send_notification', {
        p_tipo: tipo,
        p_mensaje: mensaje.trim(),
        p_user_ids: targetType === 'individual' ? selectedUserIds : null,
        p_ciudad_id: targetType === 'ciudad' ? selectedCiudadId : null,
        p_agency_id: targetType === 'agencia' ? selectedAgencyId : null,
      })
      if (rpcError) throw rpcError
      setSuccessCount(data)
      setSelectedUserIds([])
      setMensaje('')
    } catch (err) {
      setError(err.message || 'No se pudo enviar la notificación.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !sending && (resetForm(), onClose())}
    >
      <form onSubmit={handleSend} className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Enviar Notificación</h3>
          <p className="text-xs text-slate-500">Llega en tiempo real a la campanita del técnico.</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm font-medium rounded-lg px-3 py-2">{error}</div>}
        {successCount !== null && (
          <div className="bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg px-3 py-2">
            Enviada a {successCount} técnico{successCount === 1 ? '' : 's'}.
          </div>
        )}

        {/* Selector de destino */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Enviar a</label>
          <div className="flex gap-2">
            {[
              { value: 'individual', label: 'Técnico(s)' },
              { value: 'ciudad', label: 'Toda una ciudad' },
              { value: 'agencia', label: 'Toda una agencia' },
            ].map((opt) => (
              <button
                key={opt.value} type="button"
                onClick={() => setTargetType(opt.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  targetType === opt.value ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {targetType === 'individual' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
              Técnicos ({selectedUserIds.length} seleccionados)
            </label>
            <div className="border border-slate-200 rounded-lg max-h-40 overflow-y-auto divide-y divide-slate-100">
              {loadingTech && <p className="text-xs text-slate-400 text-center py-4">Cargando técnicos…</p>}
              {!loadingTech && technicians.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">No hay técnicos activos disponibles.</p>
              )}
              {technicians.map((t) => (
                <label key={t.id} className="flex items-center gap-2.5 px-3 py-2 text-sm cursor-pointer hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selectedUserIds.includes(t.id)}
                    onChange={() => toggleTecnico(t.id)}
                  />
                  <span className="font-medium text-slate-700">{t.nombre}</span>
                  <span className="text-xs text-slate-400 ml-auto">{t.ciudad}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {targetType === 'ciudad' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Ciudad</label>
            <select
              value={selectedCiudadId}
              onChange={(e) => setSelectedCiudadId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"
            >
              <option value="">Selecciona…</option>
              {ciudades.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
        )}

        {targetType === 'agencia' && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Agencia</label>
            <select
              value={selectedAgencyId}
              onChange={(e) => setSelectedAgencyId(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"
            >
              <option value="">Selecciona…</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Tipo</label>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm">
            {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Mensaje</label>
          <textarea
            rows={3} value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            placeholder="Ej. Recuerda subir las fotos del mantenimiento de CYPO esta semana."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" disabled={sending} onClick={() => { resetForm(); onClose() }}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
            Cerrar
          </button>
          <button type="submit" disabled={sending}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg shadow-sm transition">
            {sending ? 'Enviando…' : 'Enviar Notificación'}
          </button>
        </div>
      </form>
    </div>
  )
}
