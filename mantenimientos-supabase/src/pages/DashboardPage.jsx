import { useMemo, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useAgencies } from '../hooks/useAgencies'
import { useMaintenanceSchedule } from '../hooks/useMaintenanceSchedule'
import RegisterMaintenanceModal from '../components/RegisterMaintenanceModal'

const EMPTY_SCHEDULE_FORM = {
  agency_id: '', dept: '', fecha: '', cantidad: 1, responsable: '', prioridad: 'media', notas: '',
}
const EMPTY_EQUIPMENT_FORM = { agency_id: '', dept: '', qty: 1, done: 0 }

export default function DashboardPage() {
  const { isTecnico } = useAuth()
  const { agencies, loading, updateItemValue, addOrIncrementEquipment, deleteItem } = useAgencies()
  const schedule = useMaintenanceSchedule()
  const [activeAgencyId, setActiveAgencyId] = useState(null)
  const [scheduleFilter, setScheduleFilter] = useState('pendientes')

  const [scheduleModalOpen, setScheduleModalOpen] = useState(false)
  const [scheduleForm, setScheduleForm] = useState(EMPTY_SCHEDULE_FORM)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [scheduleError, setScheduleError] = useState('')

  const [equipmentForm, setEquipmentForm] = useState(EMPTY_EQUIPMENT_FORM)
  const [equipmentSaving, setEquipmentSaving] = useState(false)
  const [equipmentError, setEquipmentError] = useState('')

  const [registerOpen, setRegisterOpen] = useState(false)

  const activeAgency = useMemo(
    () => agencies.find((a) => a.id === activeAgencyId) || agencies[0],
    [agencies, activeAgencyId]
  )

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

  function openScheduleModal() {
    setScheduleError('')
    setScheduleForm({ ...EMPTY_SCHEDULE_FORM, agency_id: activeAgency?.id || agencies[0]?.id || '' })
    setScheduleModalOpen(true)
  }

  async function handleScheduleSubmit(e) {
    e.preventDefault()
    setScheduleError('')
    if (!scheduleForm.agency_id || !scheduleForm.dept.trim() || !scheduleForm.fecha) {
      setScheduleError('Agencia, departamento y fecha son obligatorios.')
      return
    }
    setScheduleSaving(true)
    try {
      await schedule.createSchedule({
        agency_id: scheduleForm.agency_id,
        dept: scheduleForm.dept.trim().toUpperCase(),
        fecha: scheduleForm.fecha,
        cantidad: parseInt(scheduleForm.cantidad) || 1,
        responsable: scheduleForm.responsable.trim(),
        prioridad: scheduleForm.prioridad,
        notas: scheduleForm.notas.trim(),
      })
      setScheduleModalOpen(false)
      setScheduleForm(EMPTY_SCHEDULE_FORM)
    } catch (err) {
      setScheduleError(err.message)
    } finally {
      setScheduleSaving(false)
    }
  }

  async function handleEquipmentSubmit(e) {
    e.preventDefault()
    setEquipmentError('')
    if (!equipmentForm.agency_id || !equipmentForm.dept.trim()) {
      setEquipmentError('Agencia y departamento son obligatorios.')
      return
    }
    const qty = parseInt(equipmentForm.qty) || 0
    const done = parseInt(equipmentForm.done) || 0
    if (done > qty) {
      setEquipmentError('El mantenimiento realizado no puede ser mayor que la cantidad de equipos.')
      return
    }
    setEquipmentSaving(true)
    try {
      await addOrIncrementEquipment(equipmentForm.agency_id, equipmentForm.dept.trim(), qty, done)
      setEquipmentForm(EMPTY_EQUIPMENT_FORM)
    } catch (err) {
      setEquipmentError(err.message)
    } finally {
      setEquipmentSaving(false)
    }
  }

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

      {/* Barra de acciones */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Mantenimientos Preventivos</h1>
          <p className="text-xs text-slate-500 font-medium">Panel de Control de Avances en Agencias</p>
        </div>
        <button
          onClick={openScheduleModal}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          + Agendar Mantenimiento
        </button>
      </div>

      {/* Agregar Equipo No Considerado */}
      <section className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="mb-4 border-b border-slate-100 pb-3">
          <h2 className="text-base font-bold text-slate-900">Agregar Equipo No Considerado</h2>
          <p className="text-xs text-slate-500">Registra un nuevo equipo o amplía un departamento existente.</p>
        </div>
        {equipmentError && (
          <div className="bg-red-50 text-red-700 text-sm font-medium rounded-lg px-3 py-2 mb-4">{equipmentError}</div>
        )}
        <form onSubmit={handleEquipmentSubmit} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Agencia</label>
            <select
              value={equipmentForm.agency_id}
              onChange={(e) => setEquipmentForm((f) => ({ ...f, agency_id: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"
              required
            >
              <option value="">Selecciona…</option>
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Departamento / Empleado</label>
            <input
              type="text" required placeholder="Ej. Ventas, Siniestros…"
              value={equipmentForm.dept}
              onChange={(e) => setEquipmentForm((f) => ({ ...f, dept: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Cant. Equipos</label>
            <input
              type="number" min="1" value={equipmentForm.qty}
              onChange={(e) => setEquipmentForm((f) => ({ ...f, qty: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Manto. Hecho</label>
            <input
              type="number" min="0" value={equipmentForm.done}
              onChange={(e) => setEquipmentForm((f) => ({ ...f, done: e.target.value }))}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm"
            />
          </div>
          <button type="submit" disabled={equipmentSaving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2 px-4 rounded-lg shadow-sm transition h-[42px]">
            {equipmentSaving ? 'Guardando…' : '+ Ingresar y Calcular'}
          </button>
        </form>
      </section>

      {/* Modal: Agendar Mantenimiento */}
      {scheduleModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
             onClick={(e) => e.target === e.currentTarget && setScheduleModalOpen(false)}>
          <form onSubmit={handleScheduleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-slate-900">Agendar Mantenimiento</h3>

            {scheduleError && (
              <div className="bg-red-50 text-red-700 text-sm font-medium rounded-lg px-3 py-2">{scheduleError}</div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Agencia</label>
              <select
                value={scheduleForm.agency_id}
                onChange={(e) => setScheduleForm((f) => ({ ...f, agency_id: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" required
              >
                <option value="">Selecciona…</option>
                {agencies.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Departamento / Empleado</label>
              <input type="text" required placeholder="Ej. Ventas, Siniestros, Taller…"
                value={scheduleForm.dept}
                onChange={(e) => setScheduleForm((f) => ({ ...f, dept: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Fecha Programada</label>
                <input type="date" required min={new Date().toISOString().split('T')[0]}
                  value={scheduleForm.fecha}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, fecha: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Cant. Equipos</label>
                <input type="number" min="1" value={scheduleForm.cantidad}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, cantidad: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Responsable / Técnico</label>
                <input type="text" placeholder="Nombre del técnico"
                  value={scheduleForm.responsable}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, responsable: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Prioridad</label>
                <select value={scheduleForm.prioridad}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, prioridad: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm">
                  <option value="baja">Baja</option>
                  <option value="media">Media</option>
                  <option value="alta">Alta</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Notas (opcional)</label>
              <textarea rows={2} value={scheduleForm.notas}
                onChange={(e) => setScheduleForm((f) => ({ ...f, notas: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm resize-none" />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setScheduleModalOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={scheduleSaving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg shadow-sm transition">
                {scheduleSaving ? 'Guardando…' : 'Guardar Programación'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* KPIs globales — ya filtrados por RLS según el rol del usuario */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <KpiCard label="Avance Consolidado" value={`${kpis.pct}%`} sub="Suma de agencias visibles" />
        <KpiCard label="Equipos Totales" value={kpis.comp} sub="Carga instalada registrada" />
        <KpiCard label="Mantto. Completados" value={kpis.done} sub={`${kpis.done} de meta cumplida`} valueClass="text-emerald-600" />
        <KpiCard label="Pendientes de Mes" value={kpis.remaining} sub="Equipos restantes activos" valueClass="text-red-600" />
      </section>

      {/* Tabs de agencias — la lista ya viene acotada por RLS */}
      <div className="border-b border-slate-200">
        <nav className="flex flex-wrap gap-6">
          {agencies.map((a) => (
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
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRegisterOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg shadow-sm transition"
              >
                + Registrar Mantenimiento
              </button>
              <span className="px-2.5 py-1 bg-slate-100 text-slate-800 text-xs font-bold rounded-full">
                {agencyTotals.comp} Equipos Registrados
              </span>
            </div>
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

      {/* Modal: Registrar Mantenimiento (con fotos Antes/Después + PPTX automático) */}
      <RegisterMaintenanceModal
        open={registerOpen}
        onClose={() => setRegisterOpen(false)}
        agencies={agencies}
        defaultAgencyId={activeAgency?.id}
      />
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

