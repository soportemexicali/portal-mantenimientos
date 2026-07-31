import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useTechnicianProgress() {
  const [progress, setProgress] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_technician_monthly_progress')

    if (rpcError) {
      setError(rpcError.message)
      setProgress([])
    } else {
      setProgress(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()

    const channel = supabase
      .channel('technician-progress-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_logs' }, () => {
        reload()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [reload])

  return { progress, loading, error, reload }
}
