import { useTechnicianProgress } from '../hooks/useTechnicianProgress'

function barColor(pct) {
  if (pct >= 100) return 'bg-emerald-500'
  if (pct >= 60) return 'bg-indigo-500'
  if (pct >= 30) return 'bg-amber-500'
  return 'bg-red-400'
}

export default function TechnicianProgressBars() {
  const { progress, loading, error } = useTechnicianProgress()

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
      <div className="mb-4">
        <h3 className="text-base font-bold text-slate-900">Avance por Técnico</h3>
        <p className="text-xs text-slate-500">Mantenimientos realizados este mes contra la meta de 15.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 text-sm font-medium rounded-lg px-3 py-2 mb-3">{error}</div>}
      {loading && <p className="text-xs text-slate-400 text-center py-6">Cargando…</p>}
      {!loading && progress.length === 0 && (
        <p className="text-xs text-slate-400 text-center py-6">No hay técnicos activos registrados.</p>
      )}

      <div className="space-y-4">
        {progress.map((t) => (
          <div key={t.tecnico_id}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-semibold text-slate-700">{t.tecnico}</span>
              <span className="text-xs font-mono text-slate-500">{t.mantenimientos_mes} / {t.meta}</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${barColor(t.pct)}`}
                style={{ width: `${Math.min(100, t.pct)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
