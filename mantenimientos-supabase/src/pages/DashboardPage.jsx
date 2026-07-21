import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAgencies } from '../hooks/useAgencies'
import { useMaintenanceSchedule } from '../hooks/useMaintenanceSchedule'

export default function DashboardPage() {
  const { isTecnico } = useAuth()
  const { agencies, loading, updateItemValue, addOrIncrementEquipment, deleteItem } = useAgencies()
  const schedule = useMaintenanceSchedule()

  const [activeAgencyId, setActiveAgencyId] = useState(null)
  const [activeCityId, setActiveCityId] = useState(null)
  const [scheduleFilter, setScheduleFilter] = useState('pendientes')

  // Ciudades únicas derivadas de las agencias que el usuario ya puede ver (RLS)
  const cities = useMemo(() => {
    const map = new Map()
    agencies.forEach((a) => {
      if (a.city_id && a.cities?.nombre) {
        map.set(a.city_id, { id: a.city_id, nombre: a.cities.nombre })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.nombre.localeCompare(b.nombre))
  }, [agencies])

  // Ciudad activa: la seleccionada, o la primera disponible por defecto
  const effectiveCityId = activeCityId || cities[0]?.id

  // Agencias de la ciudad activa (alimenta las pestañas)
  const cityAgencies = useMemo(
    () => agencies.filter((a) => a.city_id === effectiveCityId),
    [agencies, effectiveCityId]
  )

  const activeAgency = useMemo(
    () => cityAgencies.find((a) => a.id === activeAgencyId) || cityAgencies[0],
    [cityAgencies, activeAgencyId]
  )

  function handleCityChange(cityId) {
    setActiveCityId(cityId)
    setActiveAgencyId(null) // al cambiar de ciudad, selecciona la primera agencia de esa ciudad
  }

  // ---- KPIs consolidados (respetan lo que RLS ya filtró para este usuario) ----
  const kpis = useMemo(() => {
    let comp = 0, done = 0
    agencies.forEach((a) => a.equipment_items.forEach((i) => { comp += i.comp; done += i.done }))
    return { comp, done, remaining: comp - done, pct: comp > 0 ? Math.round((done / comp) * 100) : 0 }
  }, [agencies])

  const agencyTotals = useMemo(() => {
    if (!activeAgency) return { comp: 0, done: 0, remaining: 0, pct: 0 }
    const comp = activeAgency.equipment_items.reduce((s, i) => s + i.comp, 0)
    const done = activeAgency.equipment_items.reduce((s, i) => s + i.done, 0)
    return { comp, done, remaining: comp - done, pct: comp > 0 ? Math.round((done / comp) * 100) : 0 }
  }, [activeAgency])

  const filteredSchedule = useMemo(() => {
    const today = new Date(new Date().toDateString())
    return schedule.items.filter((i) => {
      if (scheduleFilter === 'pendientes') return !i.completado
      if (scheduleFilter === 'vencidos') return !i.completado && new Date(i.fecha) < today
      if (scheduleFilter === 'completados') return i.completado
      return true
    })
  }, [schedule.items, scheduleFilter])

  if (loading) {
    return <div className="p-10 text-center text-slate-400 text-sm">Cargando dashboard…</div>
  }

  if (agencies.length === 0) {
    return (
      <div className="p-10 text-center text-slate-400 text-sm">
        No tienes agencias asignadas todavía. Pide a un administrador que te asigne una.
      </div>
    )
  }

  const circumference = 2 * Math.PI * 95
  const offset = circumference - (agencyTotals.pct / 100) * circumference

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-8">
      {/* KPIs globales — ya filtrados por RLS según el rol del usuario */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard label="Avance Consolidado" value={`${kpis.pct}%`} sub="Suma de agencias visibles" />
        <KpiCard label="Equipos Totales" value={kpis.comp} sub="Carga instalada registrada" />
        <KpiCard label="Mantto. Completados" value={kpis.done} sub={`${kpis.done} de meta cumplida`} valueClass="text-emerald-600" />
        <KpiCard label="Pendientes de Mes" value={kpis.remaining} sub="Equipos restantes activos" valueClass="text-red-600" />
      </section>

      {/* Selector de Ciudad */}
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ciudad</label>
        <select
          value={effectiveCityId || ''}
          onChange={(e) => handleCityChange(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          {cities.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabs de agencias — ahora solo de la ciudad activa */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap gap-6">
          {cityAgencies.map((a) => (
            <button
              key={a.id}
              onClick={() => setActiveAgencyId(a.id)}
              className={`py-3 px-1 font-semibold text-sm flex items-center gap-2 border-b-2 transition ${
                activeAgency?.id === a.id ? 'text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
              style={activeAgency?.id === a.id ? { borderColor: a.color, color: a.color } : {}}
            >
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: a.color }} />
              {a.title}
            </button>
          ))}
        </nav>
      </div>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="text-base font-bold text-slate-900 uppercase">{activeAgency?.title}</h3>
            <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-full">
              {agencyTotals.comp} Equipos Registrados
            </span>
          </div>

          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase bg-slate-50">
                  <th className="py-3 px-6">Departamento</th>
                  <th className="py-3 px-6 text-center">Computadoras</th>
                  <th className="py-3 px-6 text-center">Realizado</th>
                  <th className="py-3 px-6 text-center">Restante</th>
                  {!isTecnico && <th className="py-3 px-6 text-center">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {activeAgency?.equipment_items.map((item) => {
                  const rest = item.comp - item.done
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-6 font-semibold text-slate-800">{item.dept}</td>
                      <Counter value={item.comp} onChange={(v) => updateItemValue(item.id, 'comp', Math.max(item.done, v))} />
                      <Counter value={item.done} onChange={(v) => updateItemValue(item.id, 'done', Math.min(item.comp, Math.max(0, v)))} />
                      <td className="py-3 px-6 text-center">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-mono ${rest > 0 ? 'bg-red-50 text-red-700 font-bold' : 'text-slate-400'}`}>{rest}</span>
                      </td>
                      {!isTecnico && (
                        <td className="py-3 px-6 text-center">
                          <button onClick={() => deleteItem(item.id)} className="text-slate-400 hover:text-red-500 text-xs">Eliminar</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
          <h3 className="text-base font-bold text-slate-900 uppercase self-start mb-4">Medición de Avance</h3>

          <div className="relative flex items-center justify-center my-4">
            <svg className="w-56 h-56 -rotate-90">
              <circle cx="112" cy="112" r="95" stroke="#f1f5f9" strokeWidth="18" fill="transparent" />
              <circle cx="112" cy="112" r="95" stroke={activeAgency?.color} strokeWidth="18" fill="transparent"
                strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
                className="transition-all duration-500" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-4xl font-extrabold text-slate-900">{agencyTotals.pct}%</span>
              <span className="text-xs font-bold text-slate-400 uppercase">Completado</span>
            </div>
          </div>

          <div className="w-full grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl">
            <div className="text-left">
              <div className="text-xs font-bold text-slate-500 uppercase">Progreso</div>
              <div className="text-lg font-extrabold text-slate-800">{agencyTotals.done}</div>
            </div>
            <div className="text-left border-l border-slate-200 pl-4">
              <div className="text-xs font-bold text-slate-500 uppercase">Faltante</div>
              <div className="text-lg font-extrabold text-slate-800">{agencyTotals.remaining}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Mantenimientos agendados */}
      <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2">
          {['pendientes', 'todos', 'vencidos', 'completados'].map((f) => (
            <button key={f} onClick={() => setScheduleFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition ${
                scheduleFilter === f ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}>
              {f}
            </button>
          ))}
        </div>

        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase bg-slate-50">
              <th className="py-3 px-6">Agencia</th>
              <th className="py-3 px-6">Depto</th>
              <th className="py-3 px-6">Fecha</th>
              <th className="py-3 px-6 text-center">Equipos</th>
              <th className="py-3 px-6 text-center">Estado</th>
              <th className="py-3 px-6 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredSchedule.map((item) => (
              <tr key={item.id} className={item.completado ? 'opacity-60' : ''}>
                <td className="py-3 px-6">{item.agencies?.title}</td>
                <td className="py-3 px-6">{item.dept}</td>
                <td className="py-3 px-6 font-mono text-xs">{item.fecha}</td>
                <td className="py-3 px-6 text-center">{item.cantidad}</td>
                <td className="py-3 px-6 text-center">
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.completado ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                    {item.completado ? 'Completado' : 'Pendiente'}
                  </span>
                </td>
                <td className="py-3 px-6 text-center">
                  <button onClick={() => schedule.toggleComplete(item.id)} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 mr-3">
                    {item.completado ? 'Reabrir' : 'Completar'}
                  </button>
                  {!isTecnico && (
                    <button onClick={() => schedule.deleteSchedule(item.id)} className="text-xs font-semibold text-red-500 hover:text-red-700">
                      Eliminar
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {filteredSchedule.length === 0 && (
              <tr><td colSpan={6} className="py-8 text-center text-slate-400 text-xs">Sin mantenimientos en esta vista.</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </main>
  )
}

function KpiCard({ label, value, sub, valueClass = 'text-slate-900' }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <span className="text-xs font-semibold text-slate-500 uppercase">{label}</span>
      <h3 className={`text-3xl font-extrabold mt-1 ${valueClass}`}>{value}</h3>
      <p className="text-[11px] text-slate-400 font-medium mt-1">{sub}</p>
    </div>
  )
}

function Counter({ value, onChange }) {
  return (
    <td className="py-3 px-6 text-center">
      <div className="flex items-center justify-center gap-2">
        <button onClick={() => onChange(value - 1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold">-</button>
        <span className="w-8 font-mono text-center font-bold text-slate-700">{value}</span>
        <button onClick={() => onChange(value + 1)} className="w-6 h-6 rounded bg-slate-100 hover:bg-slate-200 text-xs font-bold">+</button>
      </div>
    </td>
  )
}
