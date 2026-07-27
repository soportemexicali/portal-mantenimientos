import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { generateMaintenancePptx } from '../lib/generateMaintenancePptx'

const MAX_FOTOS = 3

async function uploadPhoto(file, agencyId, dept, label, index) {
  const ext = file.name.split('.').pop()
  const safedept = dept.trim().toUpperCase().replace(/\s+/g, '-')
  const path = `${agencyId}/${safedept}/${Date.now()}_${label}_${index}.${ext}`

  const { error } = await supabase.storage.from('maintenance-photos').upload(path, file, { upsert: false })
  if (error) throw error

  const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(path)
  return data.publicUrl
}

function PhotoPicker({ label, files, onChange, accentClass }) {
  function handleFiles(e) {
    const nuevos = Array.from(e.target.files || [])
    const combinados = [...files, ...nuevos].slice(0, MAX_FOTOS)
    onChange(combinados)
    e.target.value = '' // permite volver a elegir el mismo archivo si lo quita y lo vuelve a agregar
  }

  function removeAt(index) {
    onChange(files.filter((_, i) => i !== index))
  }

  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">
        Fotos "{label}" ({files.length}/{MAX_FOTOS})
      </label>

      {files.length > 0 && (
        <div className="flex gap-2 mb-2">
          {files.map((file, i) => (
            <div key={i} className="relative w-16 h-16 rounded-lg overflow-hidden border border-slate-200">
              <img src={URL.createObjectURL(file)} alt={`${label} ${i + 1}`} className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => removeAt(i)}
                className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-slate-900/70 text-white text-[10px] flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {files.length < MAX_FOTOS && (
        <input
          type="file" accept="image/*" multiple
          onChange={handleFiles}
          className={`w-full text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold ${accentClass}`}
        />
      )}
    </div>
  )
}

/**
 * @param {Object} props
 * @param {boolean} props.open
 * @param {() => void} props.onClose
 * @param {Array} props.agencies
 * @param {string} [props.defaultAgencyId]
 * @param {string} [props.defaultDept]
 */
export default function RegisterMaintenanceModal({ open, onClose, agencies, defaultAgencyId, defaultDept }) {
  const [agencyId, setAgencyId] = useState(defaultAgencyId || agencies[0]?.id || '')
  const [dept, setDept] = useState(defaultDept || '')
  const [notas, setNotas] = useState('')
  const [fotosAntes, setFotosAntes] = useState([])
  const [fotosDespues, setFotosDespues] = useState([])
  const [cantidad, setCantidad] = useState(1)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const selectedAgency = useMemo(() => agencies.find((a) => a.id === agencyId), [agencies, agencyId])
  const deptOptions = selectedAgency?.equipment_items.map((i) => i.dept) ?? []

  if (!open) return null

  function resetForm() {
    setDept('')
    setNotas('')
    setFotosAntes([])
    setFotosDespues([])
    setCantidad(1)
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!agencyId || !dept.trim()) {
      setError('Selecciona agencia y departamento.')
      return
    }
    if (fotosAntes.length === 0) {
      setError('Adjunta al menos una fotografía de "Antes".')
      return
    }

    setSaving(true)
    try {
      // 1. Subir todas las fotos en paralelo (hasta 6 en total)
      const [urlsAntes, urlsDespues] = await Promise.all([
        Promise.all(fotosAntes.map((f, i) => uploadPhoto(f, agencyId, dept, 'antes', i))),
        Promise.all(fotosDespues.map((f, i) => uploadPhoto(f, agencyId, dept, 'despues', i))),
      ])

      // 2. Registrar de forma atómica (suma equipo + completa pendiente agendado)
      const { error: rpcError } = await supabase.rpc('register_maintenance_with_photos', {
        p_agency_id: agencyId,
        p_dept: dept,
        p_notas: notas,
        p_fotos_antes: urlsAntes,
        p_fotos_despues: urlsDespues,
        p_cantidad: Number(cantidad) || 1,
      })
      if (rpcError) throw rpcError

      // 3. Generar y descargar el PPTX (usa los archivos en memoria)
      await generateMaintenancePptx({
        agencyTitle: selectedAgency?.title || '',
        dept: dept.toUpperCase(),
        notas,
        fotosAntesFiles: fotosAntes,
        fotosDespuesFiles: fotosDespues,
      })

      resetForm()
      onClose()
    } catch (err) {
      setError(err.message || 'Ocurrió un error al registrar el mantenimiento.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && !saving && onClose()}
    >
      <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-xl w-full max-w-xl max-h-[90vh] overflow-y-auto p-6 space-y-4">
        <div>
          <h3 className="text-base font-bold text-slate-900">Registrar Mantenimiento</h3>
          <p className="text-xs text-slate-500">Hasta 3 fotos de antes y 3 de después — el PPTX se genera solo al guardar.</p>
        </div>

        {error && <div className="bg-red-50 text-red-700 text-sm font-medium rounded-lg px-3 py-2">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Agencia</label>
            <select
              value={agencyId}
              onChange={(e) => { setAgencyId(e.target.value); setDept('') }}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {agencies.map((a) => <option key={a.id} value={a.id}>{a.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Departamento</label>
            <input
              list="dept-options-modal"
              value={dept}
              onChange={(e) => setDept(e.target.value)}
              placeholder="Ej. TALLER"
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
            <datalist id="dept-options-modal">
              {deptOptions.map((d) => <option key={d} value={d} />)}
            </datalist>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Cantidad de equipos</label>
          <input
            type="number" min="1" value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            className="w-32 bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase mb-1.5">Notas del equipo</label>
          <textarea
            rows={2} value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Detalles del servicio realizado..."
            className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 px-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <PhotoPicker
            label="Antes" files={fotosAntes} onChange={setFotosAntes}
            accentClass="file:bg-red-50 file:text-red-700"
          />
          <PhotoPicker
            label="Después" files={fotosDespues} onChange={setFotosDespues}
            accentClass="file:bg-emerald-50 file:text-emerald-700"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="button" disabled={saving} onClick={onClose}
            className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold py-2.5 rounded-lg transition disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold py-2.5 rounded-lg shadow-sm transition">
            {saving ? 'Guardando…' : 'Registrar y generar PPTX'}
          </button>
        </div>
      </form>
    </div>
  )
}
