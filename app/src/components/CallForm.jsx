import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { CALL_OUTCOME, INTEREST, leadName } from '../lib/constants'
import { Button, ErrorBox, Field, Modal, useToast } from './ui'

const nowLocal = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

// Adds a NEW call record. Existing call records are never edited (the database blocks it too).
export default function CallForm({ open, onClose, business, lead: fixedLead, onSaved }) {
  const toast = useToast()
  const [leads, setLeads] = useState([])
  const [leadId, setLeadId] = useState(fixedLead?.id || '')
  const [leadSearch, setLeadSearch] = useState('')
  const [form, setForm] = useState({ called_at: nowLocal(), discussion_notes: '', outcome: 'interested', interest_level: 'medium', agreed_one_to_one: false, next_follow_up: '', additional_notes: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  useEffect(() => {
    if (!open || fixedLead) return
    supabase.from('cf_leads').select('id, name, phone').eq('business_id', business.id).order('name').then(({ data }) => setLeads(data || []))
  }, [open, fixedLead, business.id])

  async function save() {
    if (!leadId) { setError('Please choose the contact you spoke with.'); return }
    setSaving(true); setError(null)
    const { error } = await supabase.from('cf_call_history').insert({
      business_id: business.id, lead_id: leadId, called_at: new Date(form.called_at).toISOString(),
      discussion_notes: form.discussion_notes || null, outcome: form.outcome,
      interest_level: form.outcome === 'no_answer' ? null : form.interest_level,
      agreed_one_to_one: form.agreed_one_to_one || form.outcome === 'one_to_one_agreed',
      next_follow_up: form.next_follow_up || null, additional_notes: form.additional_notes || null,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    toast(form.next_follow_up ? 'Call saved and follow-up reminder created' : 'Call saved')
    onSaved?.(); onClose()
  }

  const filtered = leads.filter((l) => !leadSearch || `${l.name} ${l.phone}`.toLowerCase().includes(leadSearch.toLowerCase())).slice(0, 50)

  return (
    <Modal open={open} onClose={onClose} title="Add call record" wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>Save call</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          {fixedLead ? (
            <Field label="Contact"><div className="input bg-slate-50">{leadName(fixedLead)} {fixedLead.phone && fixedLead.name ? `· ${fixedLead.phone}` : ''}</div></Field>
          ) : (
            <Field label="Contact">
              <input className="input mb-2" placeholder="Search by name or phone…" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
              <select className="input" value={leadId} onChange={(e) => setLeadId(e.target.value)} size={Math.min(5, Math.max(2, filtered.length + 1))}>
                <option value="">— Choose contact —</option>
                {filtered.map((l) => <option key={l.id} value={l.id}>{leadName(l)}{l.name && l.phone ? ` · ${l.phone}` : ''}</option>)}
              </select>
              {leads.length === 0 && <span className="mt-1 block text-xs text-slate-400">No leads yet. Add a lead first from "All Leads Collected".</span>}
            </Field>
          )}
        </div>
        <Field label="Date and time"><input type="datetime-local" className="input" value={form.called_at} onChange={set('called_at')} /></Field>
        <Field label="Call outcome">
          <select className="input" value={form.outcome} onChange={set('outcome')}>
            {Object.entries(CALL_OUTCOME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2"><Field label="What was discussed"><textarea className="input" rows={3} value={form.discussion_notes} onChange={set('discussion_notes')} /></Field></div>
        <Field label="Interest level">
          <select className="input" value={form.interest_level} onChange={set('interest_level')} disabled={form.outcome === 'no_answer'}>
            {Object.entries(INTEREST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Next follow-up date" hint="A reminder is created automatically"><input type="date" className="input" value={form.next_follow_up} onChange={set('next_follow_up')} /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input type="checkbox" className="h-4 w-4 rounded" checked={form.agreed_one_to_one || form.outcome === 'one_to_one_agreed'} onChange={set('agreed_one_to_one')} disabled={form.outcome === 'one_to_one_agreed'} />
          They agreed to a one-to-one call
        </label>
        <div className="sm:col-span-2"><Field label="Additional notes"><textarea className="input" rows={2} value={form.additional_notes} onChange={set('additional_notes')} /></Field></div>
        <div className="sm:col-span-2"><ErrorBox error={error} /></div>
      </div>
    </Modal>
  )
}
