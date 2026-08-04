import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export function useTechniciansDirectory() {
  const [technicians, setTechnicians] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

    const { data, error: rpcError } = await supabase.rpc('get_technicians_directory')

    if (rpcError) {
      setError(rpcError.message)
      setTechnicians([])
    } else {
      setTechnicians(data ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  return { technicians, loading, error, reload }
}
