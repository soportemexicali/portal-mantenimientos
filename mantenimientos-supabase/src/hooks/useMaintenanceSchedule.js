import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../contexts/AuthContext'

export function useMaintenanceSchedule() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('maintenance_schedule')
      .select('*, agencies:agency_id(title, color)')
      .order('fecha', { ascending: true })

    if (!error) setItems(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()

    const channel = supabase
      .channel('maintenance-schedule-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'maintenance_schedule' }, () => {
        reload()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [reload])

  async function createSchedule(payload) {
    const { error } = await supabase.from('maintenance_schedule').insert({
      ...payload,
      created_by: user?.id,
    })
    if (error) throw error
    await reload()
  }

  // Marcar/desmarcar completado. La suma/resta sobre equipment_items se hace
  // vía función RPC en el servidor para que sea atómica (ver 005_rpc.sql).
  async function toggleComplete(scheduleId) {
    const { error } = await supabase.rpc('toggle_schedule_complete', {
      p_schedule_id: scheduleId,
    })
    if (error) throw error
    await reload()
  }

  async function deleteSchedule(scheduleId) {
    const { error } = await supabase.rpc('delete_schedule_and_reverse', {
      p_schedule_id: scheduleId,
    })
    if (error) throw error
    await reload()
  }

  return { items, loading, reload, createSchedule, toggleComplete, deleteSchedule }
}
