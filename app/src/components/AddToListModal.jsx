import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Button, ErrorBox, Field, Modal, useToast } from './ui'

export default function AddToListModal({ open, onClose, business, leadIds, onDone }) {
  const toast = useToast()
  const [lists, setLists] = useState([])
  const [listId, setListId] = useState('')
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!open) return
    setError(null); setNewName('')
    supabase.from('cf_lists').select('id, name').eq('business_id', business.id).order('name').then(({ data, error }) => {
      if (error) setError(error); else { setLists(data); setListId(data[0]?.id || '') }
    })
  }, [open, business.id])

  async function save() {
    setSaving(true); setError(null)
    let target = listId
    if (newName.trim()) {
      const { data, error } = await supabase.from('cf_lists').insert({ business_id: business.id, name: newName.trim() }).select().single()
      if (error) { setSaving(false); setError(error.code === '23505' ? 'A list with this name already exists.' : error.message); return }
      target = data.id
    }
    if (!target) { setSaving(false); setError('Choose a list or type a new list name.'); return }
    const rows = leadIds.map((id) => ({ list_id: target, lead_id: id, business_id: business.id }))
    // ignoreDuplicates: leads already in the list are simply skipped
    const { error } = await supabase.from('cf_list_members').upsert(rows, { onConflict: 'list_id,lead_id', ignoreDuplicates: true })
    setSaving(false)
    if (error) { setError(error.message); return }
    toast(`${leadIds.length} lead${leadIds.length > 1 ? 's' : ''} added to list`)
    onDone?.(); onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Add ${leadIds.length} lead${leadIds.length > 1 ? 's' : ''} to a list`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Add to list</Button></>}>
      <div className="space-y-3">
        {lists.length > 0 && (
          <Field label="Existing list">
            <select className="input" value={listId} onChange={(e) => setListId(e.target.value)} disabled={!!newName.trim()}>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </Field>
        )}
        <Field label={lists.length ? '…or create a new list' : 'New list name'}>
          <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Hot Leads" />
        </Field>
        <ErrorBox error={error} />
      </div>
    </Modal>
  )
}
