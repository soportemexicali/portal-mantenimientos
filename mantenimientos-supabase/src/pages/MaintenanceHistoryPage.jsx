import { useAuth } from '../contexts/AuthContext'
import MaintenanceHistoryTable from '../components/MaintenanceHistoryTable'

export default function MaintenanceHistoryPage() {
  const { profile, isTecnico } = useAuth()

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Historial Completo de Mantenimientos</h1>
        <p className="text-xs text-slate-500 font-medium">
          {isTecnico
            ? 'Todo tu historial personal, sin importar la fecha.'
            : 'Historial completo de todas las agencias/ciudades visibles para tu rol.'}
        </p>
      </div>

      <MaintenanceHistoryTable
        agencyId={null}
        onlyMine={isTecnico}
        limit={null}
        showExport
        compact={false}
        title={isTecnico ? `Historial de ${profile?.nombre || 'mi cuenta'}` : 'Historial Completo'}
        subtitle="Fecha, equipo, agencia, ciudad, técnico y comentarios de cada mantenimiento realizado."
        exportFileLabel={isTecnico ? `Historial_${profile?.nombre || 'Tecnico'}` : 'Historial_Completo_Portal'}
      />
    </main>
  )
}
