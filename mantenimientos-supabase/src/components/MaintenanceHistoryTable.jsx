import * as XLSX from 'xlsx'
import { useMaintenanceHistory } from '../hooks/useMaintenanceHistory'

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function exportToExcel(history, fileLabel) {
  const rows = history.map((r) => ({
    'Fecha': formatFecha(r.created_at),
    'Ciudad': r.ciudad,
    'Agencia': r.agencia,
    'Departamento / Equipo': r.dept,
    'Técnico': r.tecnico,
    'Cantidad de Equipos': r.cantidad,
    'Descripción / Comentarios': r.notas || '',
    'Fotos Antes': r.fotos_antes?.length ?? 0,
    'Fotos Después': r.fotos_despues?.length ?? 0,
  }))

  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = [
    { wch: 20 }, { wch: 14 }, { wch: 22 }, { wch: 20 }, { wch: 20 },
    { wch: 12 }, { wch: 45 }, { wch: 12 }, { wch: 14 },
  ]

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Historial')

  const fileSafe = (fileLabel || 'Historial').replace(/[^a-zA-Z0-9-_]/g, '_')
  XLSX.writeFile(wb, `${fileSafe}.xlsx`)
}

/**
 * @param {Object} props
 * @param {string|null} [props.agencyId] - filtra a una sola agencia
 * @param {boolean} [props.onlyMine] - true = solo mis propios registros
 * @param {number|null} [props.limit] - límite de filas (ej. 15)
 * @param {boolean} [props.showExport] - mostrar botón "Exportar a Excel" (default true)
 * @param {boolean} [props.compact] - versión reducida, sin scroll interno alto, para módulos embebidos
 * @param {string} [props.title] - título de la sección
 * @param {string} [props.subtitle]
 * @param {string} [props.exportFileLabel] - nombre base del archivo exportado
 */
export default function MaintenanceHistoryTable({
  agencyId = null,
  onlyMine = false,
  limit = null,
  showExport = true,
  compact = false,
  title = 'Historial de Mantenimientos Realizados',
  subtitle = 'Cada registro con fotos queda guardado aquí de forma permanente.',
  exportFileLabel = 'Historial_Mantenimientos',
}) {
  const { history, loading, error } = useMaintenanceHistory({ agencyId, onlyMine, limit })

  return (
    <section className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div>
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        {showExport && (
          <button
            onClick={() => exportToExcel(history, exportFileLabel)}
            disabled={history.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg shadow-sm transition"
          >
            Exportar a Excel
          </button>
        )}
      </div>

      {error && <div className="px-6 py-3 bg-red-50 text-red-700 text-sm font-medium">{error}</div>}

      <div className={`overflow-x-auto ${compact ? 'max-h-[340px]' : 'max-h-[520px]'}`}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-400 uppercase bg-slate-50 sticky top-0">
              <th className="py-3 px-6">Fecha</th>
              <th className="py-3 px-6">Ciudad</th>
              <th className="py-3 px-6">Agencia</th>
              <th className="py-3 px-6">Equipo / Depto</th>
              <th className="py-3 px-6">Técnico</th>
              <th className="py-3 px-6 text-center">Cant.</th>
              <th className="py-3 px-6">Comentarios</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs">Cargando historial…</td></tr>
            )}
            {!loading && history.length === 0 && (
              <tr><td colSpan={7} className="py-8 text-center text-slate-400 text-xs">Aún no hay mantenimientos registrados.</td></tr>
            )}
            {!loading && history.map((r) => (
              <tr key={r.id} className="hover:bg-slate-50/80">
                <td className="py-3 px-6 font-mono text-xs text-slate-600 whitespace-nowrap">{formatFecha(r.created_at)}</td>
                <td className="py-3 px-6 text-slate-600">{r.ciudad}</td>
                <td className="py-3 px-6 font-semibold text-slate-800">{r.agencia}</td>
                <td className="py-3 px-6">{r.dept}</td>
                <td className="py-3 px-6 text-slate-600">{r.tecnico}</td>
                <td className="py-3 px-6 text-center font-mono">{r.cantidad}</td>
                <td className="py-3 px-6 text-slate-500 text-xs max-w-xs truncate" title={r.notas}>{r.notas || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
