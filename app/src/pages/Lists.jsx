import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, ListChecks, Pencil, Trash2, ArrowLeft, Search, UserMinus, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBusiness } from '../components/Layout'
import { LEAD_STATUS, PERMISSION, leadName } from '../lib/constants'
import { Button, Chip, Empty, ErrorBox, Field, Modal, Spinner, useConfirm, useToast } from '../components/ui'
import { MessageDot } from './Leads'
import LeadDetail from '../components/LeadDetail'

const SUGGESTIONS = {
  'health-coaching': ['Hot Leads', 'Health Coaching Prospects', 'Follow-up Needed', 'One-to-One Call Bookings', 'Referral Leads', 'Future Prospects'],
  'ratnagiri-gurukula': ['Hot Leads', 'Interested Parents', 'Ratnagiri Admissions', 'Follow-up Needed', 'One-to-One Call Bookings', 'Referral Leads', 'Future Prospects'],
}

export default function Lists() {
  const { business } = useBusiness()
  const toast = useToast()
  const confirm = useConfirm()
  const [lists, setLists] = useState(null)
  const [error, setError] = useState(null)
  const [edit, setEdit] = useState(null) // {id?, name, description}
  const [open, setOpen] = useState(null) // list object
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('cf_lists').select('*, members:cf_list_members(count)').eq('business_id', business.id).order('name')
    if (error) setError(error); else setLists(data)
  }, [business.id])
  useEffect(() => { load() }, [load])

  async function save() {
    if (!edit.name.trim()) { setFormError('Please give the list a name.'); return }
    setSaving(true); setFormError(null)
    const payload = { name: edit.name.trim(), description: edit.description?.trim() || null }
    const { error } = edit.id
      ? await supabase.from('cf_lists').update(payload).eq('id', edit.id).eq('business_id', business.id)
      : await supabase.from('cf_lists').insert({ ...payload, business_id: business.id })
    setSaving(false)
    if (error) { setFormError(error.code === '23505' ? 'A list with this name already exists.' : error.message); return }
    toast(edit.id ? 'List renamed' : 'List created'); setEdit(null); load()
  }
  async function remove(l) {
    if (!(await confirm({ title: `Delete "${l.name}"?`, message: 'Only the list is deleted. All leads inside it stay safely saved in All Leads Collected.', confirmLabel: 'Delete list', danger: true }))) return
    const { error } = await supabase.from('cf_lists').delete().eq('id', l.id).eq('business_id', business.id)
    if (error) toast(error.message, 'error'); else { toast('List deleted – leads kept'); load() }
  }

  if (error) return <ErrorBox error={error} />
  if (!lists) return <Spinner />
  if (open) return <ListView list={open} business={business} onBack={() => { setOpen(null); load() }} />

  const unused = (SUGGESTIONS[business.slug] || []).filter((s) => !lists.some((l) => l.name.toLowerCase() === s.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-slate-900">My Lists</h1><p className="text-sm text-slate-500">Group leads your way. One lead can be in many lists.</p></div>
        <Button onClick={() => { setFormError(null); setEdit({ name: '', description: '' }) }}><Plus className="h-4 w-4" /> Create list</Button>
      </div>

      {lists.length === 0 ? (
        <Empty icon={ListChecks} title="No lists yet">Create your first list, or tap a suggestion below.</Empty>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => (
            <div key={l.id} className="card flex flex-col p-4">
              <button className="text-left" onClick={() => setOpen(l)}>
                <div className="font-semibold text-slate-800 hover:text-indigo-700">{l.name}</div>
                {l.description && <div className="mt-0.5 text-xs text-slate-500">{l.description}</div>}
                <div className="mt-3 text-2xl font-bold text-slate-900">{l.members?.[0]?.count ?? 0}<span className="ml-1 text-sm font-normal text-slate-500">contacts</span></div>
              </button>
              <div className="mt-3 flex gap-1 border-t border-slate-100 pt-3">
                <Button size="sm" variant="secondary" onClick={() => setOpen(l)}>Open</Button>
                <Button size="sm" variant="ghost" onClick={() => { setFormError(null); setEdit({ id: l.id, name: l.name, description: l.description || '' }) }}><Pencil className="h-3.5 w-3.5" /> Rename</Button>
                <Button size="sm" variant="ghost" className="ml-auto text-red-600" onClick={() => remove(l)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {unused.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium text-slate-500">Quick-create suggestions</div>
          <div className="flex flex-wrap gap-2">
            {unused.map((s) => (
              <button key={s} onClick={() => { setFormError(null); setEdit({ name: s, description: '' }) }} className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs text-slate-600 hover:border-indigo-400 hover:text-indigo-700">+ {s}</button>
            ))}
          </div>
        </div>
      )}

      <Modal open={!!edit} onClose={() => setEdit(null)} title={edit?.id ? 'Rename list' : 'Create list'}
        footer={<><Button variant="secondary" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={save} loading={saving}>Save</Button></>}>
        {edit && <div className="space-y-3">
          <Field label="List name"><input className="input" autoFocus value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
          <Field label="Description (optional)"><input className="input" value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
          <ErrorBox error={formError} />
        </div>}
      </Modal>
    </div>
  )
}

function ListView({ list, business, onBack }) {
  const toast = useToast()
  const confirm = useConfirm()
  const [members, setMembers] = useState(null)
  const [q, setQ] = useState('')
  const [adding, setAdding] = useState(false)
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('cf_list_members').select('added_at, lead:cf_leads(*)').eq('list_id', list.id).eq('business_id', business.id).order('added_at', { ascending: false })
    if (error) setError(error); else setMembers(data.map((m) => m.lead).filter(Boolean))
  }, [list.id, business.id])
  useEffect(() => { load() }, [load])

  async function removeMember(l) {
    if (!(await confirm({ title: 'Remove from list?', message: `Remove ${leadName(l)} from "${list.name}"? The lead stays saved.`, confirmLabel: 'Remove' }))) return
    const { error } = await supabase.from('cf_list_members').delete().eq('list_id', list.id).eq('lead_id', l.id)
    if (error) toast(error.message, 'error'); else { toast('Removed from list'); load() }
  }

  const shown = (members || []).filter((l) => !q || `${l.name} ${l.phone} ${l.location} ${l.category}`.toLowerCase().includes(q.toLowerCase()))
  const existingIds = useMemo(() => new Set((members || []).map((m) => m.id)), [members])

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ArrowLeft className="h-4 w-4" /> All lists</button>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-slate-900">{list.name}</h1><p className="text-sm text-slate-500">{members?.length ?? '…'} contacts</p></div>
        <Button onClick={() => setAdding(true)}><UserPlus className="h-4 w-4" /> Add leads</Button>
      </div>
      <ErrorBox error={error} />
      <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search within this list…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      {!members ? <Spinner /> : shown.length === 0 ? <Empty title={members.length ? 'No matches' : 'This list is empty'}>{!members.length && 'Tap "Add leads" to pick contacts.'}</Empty> : (
        <div className="card divide-y divide-slate-100">
          {shown.map((l) => (
            <div key={l.id} className="flex items-center gap-3 p-3 hover:bg-slate-50">
              <button className="min-w-0 flex-1 text-left" onClick={() => setDetail(l.id)}>
                <div className="truncate font-medium text-slate-800">{leadName(l)}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  {l.name && l.phone}<MessageDot status={l.message_status} />
                  <Chip className={PERMISSION[l.permission_status].chip}>{PERMISSION[l.permission_status].label}</Chip>
                  <span>{LEAD_STATUS[l.lead_status]}</span>
                </div>
              </button>
              <Button size="sm" variant="ghost" onClick={() => removeMember(l)} title="Remove from list"><UserMinus className="h-4 w-4" /></Button>
            </div>
          ))}
        </div>
      )}
      {adding && <PickLeads business={business} list={list} existing={existingIds} onClose={() => setAdding(false)} onDone={load} />}
      {detail && <LeadDetail open onClose={() => setDetail(null)} business={business} leadId={detail} initialTab="lists" onChanged={load} />}
    </div>
  )
}

function PickLeads({ business, list, existing, onClose, onDone }) {
  const toast = useToast()
  const [leads, setLeads] = useState(null)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(new Set())
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    supabase.from('cf_leads').select('id, name, phone, location, category').eq('business_id', business.id).order('name').then(({ data }) => setLeads((data || []).filter((l) => !existing.has(l.id))))
  }, [business.id, existing])
  const shown = (leads || []).filter((l) => !q || `${l.name} ${l.phone} ${l.location} ${l.category}`.toLowerCase().includes(q.toLowerCase()))
  async function save() {
    setSaving(true)
    const { error } = await supabase.from('cf_list_members').insert([...sel].map((id) => ({ list_id: list.id, lead_id: id, business_id: business.id })))
    setSaving(false)
    if (error) toast(error.message, 'error'); else { toast(`${sel.size} added to ${list.name}`); onDone(); onClose() }
  }
  return (
    <Modal open onClose={onClose} title={`Add leads to "${list.name}"`}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save} loading={saving} disabled={!sel.size}>Add {sel.size || ''}</Button></>}>
      <input className="input mb-3" placeholder="Search leads…" value={q} onChange={(e) => setQ(e.target.value)} />
      {!leads ? <Spinner /> : shown.length === 0 ? <p className="text-sm text-slate-400">No more leads to add.</p> : (
        <>
          <button className="mb-2 text-xs text-indigo-600 hover:underline" onClick={() => setSel(new Set(shown.map((l) => l.id)))}>Select all {shown.length} shown</button>
          <div className="max-h-80 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
            {shown.map((l) => (
              <label key={l.id} className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50">
                <input type="checkbox" checked={sel.has(l.id)} onChange={() => setSel((s) => { const n = new Set(s); n.has(l.id) ? n.delete(l.id) : n.add(l.id); return n })} />
                <span className="min-w-0"><span className="block truncate text-slate-800">{leadName(l)}</span><span className="text-xs text-slate-400">{[l.name && l.phone, l.location].filter(Boolean).join(' · ')}</span></span>
              </label>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}
