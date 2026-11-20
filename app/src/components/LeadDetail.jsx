import { useCallback, useEffect, useState } from 'react'
import { Phone, Mail, MapPin, ExternalLink, PhoneCall, StickyNote, ListChecks, ShieldCheck, MessageCircle, Pencil, Trash2, X, Plus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { CALL_OUTCOME, INTEREST, LEAD_STATUS, MESSAGE_STATUS, PERMISSION, fmtDate, fmtDateTime, leadName } from '../lib/constants'
import { Button, Chip, ErrorBox, Field, Modal, Spinner, useConfirm, useToast } from './ui'
import CallForm from './CallForm'
import AddToListModal from './AddToListModal'

const TABS = [['calls', 'Call history', PhoneCall], ['notes', 'Notes', StickyNote], ['lists', 'Lists', ListChecks], ['permission', 'Permission', ShieldCheck], ['messages', 'Messages', MessageCircle]]

export default function LeadDetail({ open, onClose, business, leadId, initialTab = 'calls', onChanged, onEdit }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [lead, setLead] = useState(null)
  const [tab, setTab] = useState(initialTab)
  const [data, setData] = useState({ calls: [], notes: [], lists: [], perms: [], messages: [] })
  const [error, setError] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [perm, setPerm] = useState({ status: 'opted_in', method: '' })
  const [callOpen, setCallOpen] = useState(false)
  const [listOpen, setListOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const q = (t, sel = '*') => supabase.from(t).select(sel).eq('business_id', business.id).eq('lead_id', leadId)
    const [l, c, n, m, p, msg] = await Promise.all([
      supabase.from('cf_leads').select('*').eq('id', leadId).eq('business_id', business.id).single(),
      q('cf_call_history').order('called_at', { ascending: false }),
      q('cf_notes').order('created_at', { ascending: false }),
      q('cf_list_members', 'list_id, added_at, list:cf_lists(name)'),
      q('cf_contact_permissions').order('recorded_at', { ascending: false }),
      q('cf_messages').order('created_at', { ascending: true }),
    ])
    const err = [l, c, n, m, p, msg].find((r) => r.error)
    if (err) { setError(err.error); return }
    setLead(l.data); setData({ calls: c.data, notes: n.data, lists: m.data, perms: p.data, messages: msg.data })
  }, [business.id, leadId])

  useEffect(() => { if (open && leadId) { setTab(initialTab); setLead(null); setError(null); load() } }, [open, leadId, initialTab, load])

  const changed = () => { load(); onChanged?.() }

  async function updateStatus(field, value) {
    const { error } = await supabase.from('cf_leads').update({ [field]: value }).eq('id', leadId).eq('business_id', business.id)
    if (error) toast(error.message, 'error'); else { toast('Status updated'); changed() }
  }
  async function addNote() {
    if (!noteText.trim()) return
    setBusy(true)
    const { error } = await supabase.from('cf_notes').insert({ business_id: business.id, lead_id: leadId, body: noteText.trim() })
    setBusy(false)
    if (error) toast(error.message, 'error'); else { setNoteText(''); toast('Note added'); changed() }
  }
  async function savePermission() {
    if (perm.status === 'opted_in' && !perm.method.trim()) { toast('Please write how permission was given', 'error'); return }
    setBusy(true)
    const { error } = await supabase.from('cf_contact_permissions').insert({ business_id: business.id, lead_id: leadId, status: perm.status, method: perm.method.trim() || null })
    setBusy(false)
    if (error) toast(error.message, 'error'); else { setPerm({ status: 'opted_in', method: '' }); toast('Permission recorded'); changed() }
  }
  async function removeFromList(listId, name) {
    if (!(await confirm({ title: 'Remove from list?', message: `Remove ${leadName(lead)} from "${name}"? The lead itself stays saved.`, confirmLabel: 'Remove' }))) return
    const { error } = await supabase.from('cf_list_members').delete().eq('list_id', listId).eq('lead_id', leadId)
    if (error) toast(error.message, 'error'); else { toast('Removed from list'); changed() }
  }
  async function deleteLead() {
    if (!(await confirm({ title: 'Delete this lead permanently?', message: `This deletes ${leadName(lead)} along with their notes, call records and list memberships. This cannot be undone.`, confirmLabel: 'Delete lead', danger: true }))) return
    const { error } = await supabase.from('cf_leads').delete().eq('id', leadId).eq('business_id', business.id)
    if (error) toast(error.message, 'error'); else { toast('Lead deleted'); onChanged?.(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} title="Lead profile" wide>
      <ErrorBox error={error} />
      {!lead && !error && <Spinner />}
      {lead && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">{leadName(lead)}</h3>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{lead.phone}</span>}
                {lead.email && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{lead.email}</span>}
                {lead.location && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{lead.location}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => onEdit?.(lead)}><Pencil className="h-3.5 w-3.5" /> Edit</Button>
              <Button size="sm" variant="ghost" className="text-red-600" onClick={deleteLead}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          </div>

          <div className="grid gap-3 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
            <div><span className="text-xs text-slate-500">Category</span><div className="text-slate-800">{lead.category || '—'}</div></div>
            <div><span className="text-xs text-slate-500">Source</span><div className="flex items-center gap-1 text-slate-800">{lead.source || '—'}
              {lead.source_link && <a href={lead.source_link} target="_blank" rel="noreferrer" className="text-indigo-600"><ExternalLink className="h-3.5 w-3.5" /></a>}</div></div>
            <div className="sm:col-span-2"><span className="text-xs text-slate-500">Requirement</span><div className="text-slate-800">{lead.requirement || '—'}</div></div>
            <div><span className="text-xs text-slate-500">Added</span><div className="text-slate-800">{fmtDate(lead.created_at)}</div></div>
            <div><span className="text-xs text-slate-500">WhatsApp permission</span><div><Chip className={PERMISSION[lead.permission_status].chip}>{PERMISSION[lead.permission_status].label}</Chip></div></div>
            <Field label="Lead status">
              <select className="input" value={lead.lead_status} onChange={(e) => updateStatus('lead_status', e.target.value)}>
                {Object.entries(LEAD_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Message status">
              <select className="input" value={lead.message_status} onChange={(e) => updateStatus('message_status', e.target.value)}>
                {Object.entries(MESSAGE_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </Field>
            {lead.notes && <div className="sm:col-span-2"><span className="text-xs text-slate-500">Notes</span><div className="whitespace-pre-wrap text-slate-800">{lead.notes}</div></div>}
          </div>

          <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {TABS.map(([k, label, Icon]) => (
              <button key={k} onClick={() => setTab(k)}
                className={`flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-indigo-600 font-medium text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                <Icon className="h-4 w-4" />{label}
                {k === 'calls' && data.calls.length > 0 && <span className="text-xs text-slate-400">({data.calls.length})</span>}
              </button>
            ))}
          </div>

          {tab === 'calls' && (
            <div className="space-y-3">
              <Button size="sm" onClick={() => setCallOpen(true)}><Plus className="h-4 w-4" /> Add call record</Button>
              {data.calls.length === 0 ? <p className="text-sm text-slate-400">No calls recorded yet.</p> : data.calls.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-slate-800">{CALL_OUTCOME[c.outcome]}</span>
                    <span className="text-xs text-slate-400">{fmtDateTime(c.called_at)}</span>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs">
                    {c.interest_level && <Chip className="bg-slate-100 text-slate-700">Interest: {INTEREST[c.interest_level]}</Chip>}
                    {c.agreed_one_to_one && <Chip className="bg-green-100 text-green-800">1:1 call agreed</Chip>}
                    {c.next_follow_up && <Chip className="bg-orange-100 text-orange-800">Follow up {fmtDate(c.next_follow_up)}</Chip>}
                  </div>
                  {c.discussion_notes && <p className="mt-2 whitespace-pre-wrap text-slate-600">{c.discussion_notes}</p>}
                  {c.additional_notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{c.additional_notes}</p>}
                </div>
              ))}
            </div>
          )}

          {tab === 'notes' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <textarea className="input" rows={2} placeholder="Write a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                <Button onClick={addNote} loading={busy} disabled={!noteText.trim()}>Add</Button>
              </div>
              {data.notes.length === 0 ? <p className="text-sm text-slate-400">No notes yet.</p> : data.notes.map((n) => (
                <div key={n.id} className="rounded-lg bg-yellow-50 p-3 text-sm">
                  <p className="whitespace-pre-wrap text-slate-700">{n.body}</p>
                  <span className="mt-1 block text-xs text-slate-400">{fmtDateTime(n.created_at)}</span>
                </div>
              ))}
            </div>
          )}

          {tab === 'lists' && (
            <div className="space-y-3">
              <Button size="sm" onClick={() => setListOpen(true)}><Plus className="h-4 w-4" /> Add to list</Button>
              {data.lists.length === 0 ? <p className="text-sm text-slate-400">Not in any list yet.</p> : (
                <div className="flex flex-wrap gap-2">
                  {data.lists.map((m) => (
                    <Chip key={m.list_id} className="bg-indigo-50 py-1 text-indigo-700">{m.list?.name}
                      <button onClick={() => removeFromList(m.list_id, m.list?.name)} aria-label="Remove"><X className="h-3 w-3" /></button></Chip>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'permission' && (
            <div className="space-y-3">
              <div className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-[1fr_2fr_auto] sm:items-end">
                <Field label="New status">
                  <select className="input" value={perm.status} onChange={(e) => setPerm((p) => ({ ...p, status: e.target.value }))}>
                    {Object.entries(PERMISSION).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </Field>
                <Field label="How / evidence"><input className="input" value={perm.method} onChange={(e) => setPerm((p) => ({ ...p, method: e.target.value }))} placeholder='e.g. "Replied YES on WhatsApp on 20 Nov"' /></Field>
                <Button onClick={savePermission} loading={busy}>Record</Button>
              </div>
              <p className="text-xs text-slate-500">Only contacts marked <b>Opted in</b> can receive WhatsApp messages from ConnectFlow. Opted-out contacts are always excluded.</p>
              {data.perms.length === 0 ? <p className="text-sm text-slate-400">No permission history yet.</p> : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {data.perms.map((p) => (
                    <li key={p.id} className="flex justify-between gap-2 py-2">
                      <span><Chip className={PERMISSION[p.status].chip}>{PERMISSION[p.status].label}</Chip> <span className="text-slate-600">{p.method}</span></span>
                      <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(p.recorded_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === 'messages' && (
            data.messages.length === 0
              ? <p className="text-sm text-slate-400">No WhatsApp messages yet. Sending and reply tracking will work once WhatsApp is connected (Phase 3).</p>
              : <div className="space-y-2">{data.messages.map((m) => (
                  <div key={m.id} className={`max-w-[80%] rounded-lg p-2 text-sm ${m.direction === 'inbound' ? 'bg-slate-100' : 'ml-auto bg-green-50'}`}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <span className="text-[10px] text-slate-400">{fmtDateTime(m.created_at)} · {m.status}</span>
                  </div>))}</div>
          )}
        </div>
      )}
      {callOpen && lead && <CallForm open onClose={() => setCallOpen(false)} business={business} lead={lead} onSaved={changed} />}
      {listOpen && <AddToListModal open onClose={() => setListOpen(false)} business={business} leadIds={[leadId]} onDone={changed} />}
    </Modal>
  )
}
