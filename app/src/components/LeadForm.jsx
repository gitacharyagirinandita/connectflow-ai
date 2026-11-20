import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { LEAD_STATUS, MESSAGE_STATUS, normalisePhone } from '../lib/constants'
import { Button, ErrorBox, Field, Modal, useToast } from './ui'

const EMPTY = { name: '', phone: '', email: '', location: '', category: '', requirement: '', source: 'Manual entry', source_link: '', lead_status: 'new', message_status: 'not_sent', notes: '' }

export default function LeadForm({ open, onClose, business, lead, onSaved }) {
  const toast = useToast()
  const editing = !!lead
  const [form, setForm] = useState(() => (lead ? { ...EMPTY, ...lead } : EMPTY))
  const [perm, setPerm] = useState({ status: 'unknown', method: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function save(e) {
    e.preventDefault()
    if (!form.name.trim() && !form.phone.trim()) { setError('Please enter at least a name or a phone number.'); return }
    if (perm.status === 'opted_in' && !perm.method.trim()) { setError('Please write how this person gave permission (for example: "Filled our enquiry form").'); return }
    setSaving(true); setError(null)
    const payload = {
      name: form.name.trim() || null, phone: normalisePhone(form.phone) || null, email: form.email.trim() || null,
      location: form.location.trim() || null, category: form.category.trim() || null, requirement: form.requirement.trim() || null,
      source: form.source.trim() || null, source_link: form.source_link.trim() || null,
      lead_status: form.lead_status, message_status: form.message_status, notes: form.notes || null,
    }
    let res
    if (editing) {
      res = await supabase.from('cf_leads').update(payload).eq('id', lead.id).eq('business_id', business.id).select().single()
    } else {
      res = await supabase.from('cf_leads').insert({ ...payload, business_id: business.id, discovered_at: new Date().toISOString() }).select().single()
      if (!res.error && perm.status !== 'unknown') {
        const p = await supabase.from('cf_contact_permissions').insert({ business_id: business.id, lead_id: res.data.id, status: perm.status, method: perm.method.trim() || null })
        if (p.error) res = { error: p.error }
      }
    }
    setSaving(false)
    if (res.error) {
      setError(res.error.code === '23505' ? 'A lead with this phone number already exists in this business.' : res.error.message)
      return
    }
    toast(editing ? 'Lead updated' : 'Lead saved')
    onSaved?.(res.data)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit lead' : `Add lead to ${business.name}`} wide
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving}>{editing ? 'Save changes' : 'Save lead'}</Button></>}>
      <form onSubmit={save} className="grid gap-3 sm:grid-cols-2">
        <Field label="Name"><input className="input" value={form.name} onChange={set('name')} /></Field>
        <Field label="Phone number" hint="10-digit Indian numbers get +91 added automatically"><input className="input" value={form.phone} onChange={set('phone')} inputMode="tel" /></Field>
        <Field label="Email"><input className="input" type="email" value={form.email || ''} onChange={set('email')} /></Field>
        <Field label="Location"><input className="input" value={form.location || ''} onChange={set('location')} placeholder="e.g. Pune, Maharashtra" /></Field>
        <Field label="Lead category"><input className="input" value={form.category || ''} onChange={set('category')} placeholder={business.slug === 'ratnagiri-gurukula' ? 'e.g. Gita classes – parent' : 'e.g. Weight management'} /></Field>
        <Field label="Source"><input className="input" value={form.source || ''} onChange={set('source')} placeholder="e.g. Referral, Enquiry form, Event" /></Field>
        <div className="sm:col-span-2"><Field label="What they need (expressed requirement)"><textarea className="input" rows={2} value={form.requirement || ''} onChange={set('requirement')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Source link (optional)"><input className="input" value={form.source_link || ''} onChange={set('source_link')} placeholder="https://…" /></Field></div>
        <Field label="Lead status">
          <select className="input" value={form.lead_status} onChange={set('lead_status')}>
            {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Message status" hint="Updates automatically once WhatsApp is connected. Change it by hand only if you messaged from your phone.">
          <select className="input" value={form.message_status} onChange={set('message_status')}>
            {Object.entries(MESSAGE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </Field>
        {!editing && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
            <div className="mb-2 text-xs font-semibold text-slate-700">WhatsApp contact permission</div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Permission status">
                <select className="input" value={perm.status} onChange={(e) => setPerm((p) => ({ ...p, status: e.target.value }))}>
                  <option value="unknown">Unknown – not asked yet</option>
                  <option value="pending">Pending – asked, waiting</option>
                  <option value="opted_in">Opted in – agreed to receive messages</option>
                  <option value="opted_out">Opted out – do not message</option>
                </select>
              </Field>
              <Field label="How was permission given?"><input className="input" value={perm.method} onChange={(e) => setPerm((p) => ({ ...p, method: e.target.value }))} placeholder="e.g. Filled enquiry form on 12 Nov" /></Field>
            </div>
          </div>
        )}
        <div className="sm:col-span-2"><Field label="Notes"><textarea className="input" rows={2} value={form.notes || ''} onChange={set('notes')} /></Field></div>
        <div className="sm:col-span-2"><ErrorBox error={error} /></div>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
