import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * @param {Object} options
 * @param {string|null} [options.agencyId] - filtra a una sola agencia. null = todas las visibles (RLS).
 * @param {boolean} [options.onlyMine] - true = solo los registros creados por el usuario actual.
 * @param {number|null} [options.limit] - límite de filas (ej. 15 para "últimos mantenimientos").
 */
export function useMaintenanceHistory({ agencyId = null, onlyMine = false, limit = null } = {}) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_maintenance_history', {
      p_agency_id: agencyId,
      p_only_mine: onlyMine,
      p_limit: limit,
    })

    if (rpcError) {
      setError(rpcError.message)
      setHistory([])
    } else {
      setHistory(data ?? [])
    }
    setLoading(false)
  }, [agencyId, onlyMine, limit])

  useEffect(() => {
    reload()

    const channel = supabase
      .channel('maintenance-logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs' }, () => {
        reload()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [reload])

  return { history, loading, error, reload }
}
