import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

// Carga agencias + sus equipos. RLS filtra automáticamente según el usuario:
// - superadmin: todas las agencias
// - admin: las de su ciudad (o su lista explícita de agencias)
// - tecnico: solo las agencias listadas en profile.agencias
export function useAgencies() {
  const [agencies, setAgencies] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)

   const { data, error: fetchError } = await supabase
  .from('agencies')
  .select('id, slug, title, color, city_id, cities(nombre), equipment_items(id, dept, comp, done)')
  .order('title')

    if (fetchError) {
      setError(fetchError.message)
      setAgencies([])
    } else {
      setAgencies(data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()

    // Realtime: refresca si cualquier otro usuario modifica los equipos
    const channel = supabase
      .channel('equipment-items-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'equipment_items' }, () => {
        reload()
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [reload])

  async function updateItemValue(itemId, field, newValue) {
    const { error: updateError } = await supabase
      .from('equipment_items')
      .update({ [field]: newValue })
      .eq('id', itemId)
    if (updateError) throw updateError
    await reload()
  }

  async function addOrIncrementEquipment(agencyId, dept, qty, done) {
    // Intenta encontrar el departamento existente en esa agencia
    const { data: existing } = await supabase
      .from('equipment_items')
      .select('id, comp, done')
      .eq('agency_id', agencyId)
      .eq('dept', dept.toUpperCase())
      .maybeSingle()

    if (existing) {
      const { error: updErr } = await supabase
        .from('equipment_items')
        .update({ comp: existing.comp + qty, done: existing.done + done })
        .eq('id', existing.id)
      if (updErr) throw updErr
    } else {
      const { error: insErr } = await supabase
        .from('equipment_items')
        .insert({ agency_id: agencyId, dept: dept.toUpperCase(), comp: qty, done })
      if (insErr) throw insErr
    }
    await reload()
  }

  async function deleteItem(itemId) {
    const { error: delErr } = await supabase.from('equipment_items').delete().eq('id', itemId)
    if (delErr) throw delErr
    await reload()
  }

  return { agencies, loading, error, reload, updateItemValue, addOrIncrementEquipment, deleteItem }
}
