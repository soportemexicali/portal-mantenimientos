import ProgressRing from './ProgressRing'
import TechnicianProgressBars from './TechnicianProgressBars'
import MaintenanceHistoryTable from './MaintenanceHistoryTable'

/**
 * @param {Object} props
 * @param {{comp:number, done:number, remaining:number, pct:number}} props.kpis - ya calculado en DashboardPage a partir de useAgencies()
 */
export default function AdminOverviewSection({ kpis }) {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Gráfica circular global */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
          <h3 className="text-base font-bold text-slate-900 uppercase self-start mb-4">Avance Global</h3>
          <ProgressRing percent={kpis.pct} color="#4F46E5" size={190} />
          <div className="w-full grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl mt-4">
            <div className="text-left">
              <div className="text-xs font-bold text-slate-500 uppercase">Realizados</div>
              <div className="text-lg font-extrabold text-slate-800">{kpis.done}</div>
            </div>
            <div className="text-left border-l border-slate-200 pl-4">
              <div className="text-xs font-bold text-slate-500 uppercase">Restantes</div>
              <div className="text-lg font-extrabold text-slate-800">{kpis.remaining}</div>
            </div>
          </div>
        </div>

        {/* Avance por técnico */}
        <div className="lg:col-span-2">
          <TechnicianProgressBars />
        </div>
      </div>

      {/* Últimos 15 mantenimientos, globales */}
      <MaintenanceHistoryTable
        agencyId={null}
        onlyMine={false}
        limit={15}
        showExport={false}
        compact
        title="Últimos Mantenimientos"
        subtitle="Los 15 registros más recientes, de todos los técnicos y agencias visibles."
      />
    </section>
  )
}
