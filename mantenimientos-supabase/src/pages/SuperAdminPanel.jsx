import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

const ROLES = [
  { value: 'tecnico', label: 'Técnico' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
]

export default function SuperAdminPanel() {
  const { isSuperadmin, isAdmin } = useAuth()
  const [users, setUsers] = useState([])
  const [cities, setCities] = useState([])
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [form, setForm] = useState({
    email: '', password: '', nombre: '', rol: 'tecnico', ciudad_id: '', agencias: [],
  })

  // Solo superadmin y admin pueden ver este panel (el admin ve/gestiona su ciudad)
  if (!isSuperadmin && !isAdmin) {
    return (
      <div className="p-8 text-center text-slate-500 text-sm">
        No tienes permisos para ver esta sección.
      </div>
    )
  }

  async function loadAll() {
    setLoading(true)
    const [{ data: usersData }, { data: citiesData }, { data: agenciesData }] = await Promise.all([
      supabase.from('profiles').select('id, email, nombre, rol, ciudad_id, agencias, activo, cities:ciudad_id(nombre)').order('email'),
      supabase.from('cities').select('id, nombre').order('nombre'),
      supabase.from('agencies').select('id, title, city_id').order('title'),
    ])
    setUsers(usersData ?? [])
    setCities(citiesData ?? [])
    setAgencies(agenciesData ?? [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  async function handleCreateUser(e) {
    e.preventDefault()
    setFormError('')
    setSaving(true)

    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token

    const { data, error } = await supabase.functions.invoke('create-user', {
      body: {
        email: form.email.trim(),
        password: form.password,
        nombre: form.nombre.trim(),
        rol: form.rol,
        ciudad_id: form.ciudad_id || null,
        agencias: form.agencias,
      },
      headers: { Authorization: `Bearer ${token}` },
    })

    setSaving(false)

    if (error || data?.error) {
      setFormError(data?.error || error.message)
      return
    }

    setFormOpen(false)
    setForm({ email: '', password: '', nombre: '', rol: 'tecnico', ciudad_id: '', agencias: [] })
    await loadAll()
  }

  async function toggleActivo(user) {
    await supabase.from('profiles').update({ activo: !user.activo }).eq('id', user.id)
    await loadAll()
  }

  const agenciasDeCiudad = agencies.filter((a) => a.city_id === form.ciudad_id)

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Panel de Administración de Usuarios</h1>
          <p className="text-sm text-slate-500">Crea cuentas y asigna rol, ciudad y agencias permitidas.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg shadow-sm transition"
        >
          + Nuevo usuario
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50">
              <th className="py-3 px-6">Usuario</th>
              <th className="py-3 px-6">Rol</th>
              <th className="py-3 px-6">Ciudad</th>
              <th className="py-3 px-6">Agencias asignadas</th>
              <th className="py-3 px-6 text-center">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={5} className="py-8 text-center text-slate-400">Cargando…</td></tr>
            )}
            {!loading && users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50/80">
                <td className="py-3 px-6">
                  <div className="font-semibold text-slate-800">{u.nombre || '—'}</div>
                  <div className="text-xs text-slate-400">{u.email}</div>
                </td>
                <td className="py-3 px-6">
                  <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 capitalize">{u.rol}</span>
                </td>
                <td className="py-3 px-6 text-slate-600">{u.cities?.nombre || '—'}</td>
                <td className="py-3 px-6 text-slate-500 text-xs">{u.agencias?.length ? `${u.agencias.length} agencia(s)` : 'Todas / sin restricción'}</td>
                <td className="py-3 px-6 text-center">
                  <button
                    onClick={() => toggleActivo(u)}
                    className={`px-2.5 py-1 rounded-full text-xs font-bold ${u.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}
                  >
                    {u.activo ? 'Activo' : 'Inactivo'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4"
             onClick={(e) => e.target === e.currentTarget && setFormOpen(false)}>
          <form onSubmit={handleCreateUser} className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Registrar nuevo usuario</h3>

            {formError && (
              <div className="bg-red-50 text-red-700 text-sm font-medium rounded-lg px-3 py-2">{formError}</div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Correo</label>
                <input required type="email" value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Contraseña temporal</label>
                <input required type="text" minLength={8} value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Nombre</label>
              <input type="text" value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Rol</label>
                <select value={form.rol} onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm">
                  {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Ciudad</label>
                <select value={form.ciudad_id} onChange={(e) => setForm((f) => ({ ...f, ciudad_id: e.target.value, agencias: [] }))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm">
                  <option value="">— Sin asignar (solo superadmin) —</option>
                  {cities.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
            </div>

            {form.ciudad_id && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
                  Agencias permitidas (vacío = todas las de la ciudad, para admin)
                </label>
                <div className="flex flex-wrap gap-2">
                  {agenciasDeCiudad.map((a) => {
                    const checked = form.agencias.includes(a.id)
                    return (
                      <label key={a.id} className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border cursor-pointer ${checked ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                        <input type="checkbox" className="hidden" checked={checked}
                          onChange={() => setForm((f) => ({
                            ...f,
                            agencias: checked ? f.agencias.filter((id) => id !== a.id) : [...f.agencias, a.id],
                          }))} />
                        {a.title}
                      </label>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setFormOpen(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition">
                Cancelar
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg shadow-sm transition">
                {saving ? 'Creando…' : 'Crear usuario'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
