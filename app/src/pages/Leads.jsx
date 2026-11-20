import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Search, Users, MoreVertical, Eye, MessageCircle, ListPlus, StickyNote, PhoneCall, Pencil, Sparkles, CheckSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBusiness } from '../components/Layout'
import { LEAD_STATUS, MESSAGE_STATUS, PERMISSION, fmtDate, leadName } from '../lib/constants'
import { Button, Chip, Empty, ErrorBox, Spinner } from '../components/ui'
import LeadForm from '../components/LeadForm'
import LeadDetail from '../components/LeadDetail'
import AddToListModal from '../components/AddToListModal'

export function MessageDot({ status }) {
  const s = MESSAGE_STATUS[status] || MESSAGE_STATUS.not_sent
  return <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-xs text-slate-600"><span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />{s.label}</span>
}

export default function Leads() {
  const { business } = useBusiness()
  const [leads, setLeads] = useState(null)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')
  const [filters, setFilters] = useState({ lead_status: '', message_status: '', permission_status: '', category: '', source: '' })
  const [selected, setSelected] = useState(new Set())
  const [form, setForm] = useState(null)          // {lead?}
  const [detail, setDetail] = useState(null)      // {id, tab}
  const [listFor, setListFor] = useState(null)    // [ids]
  const [menu, setMenu] = useState(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('cf_leads').select('*').eq('business_id', business.id).order('created_at', { ascending: false })
    if (error) setError(error); else setLeads(data)
  }, [business.id])
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const close = () => setMenu(null)
    window.addEventListener('click', close)
    return () => window.removeEventListener('click', close)
  }, [])

  const options = useMemo(() => ({
    category: [...new Set((leads || []).map((l) => l.category).filter(Boolean))].sort(),
    source: [...new Set((leads || []).map((l) => l.source).filter(Boolean))].sort(),
  }), [leads])

  const visible = useMemo(() => (leads || []).filter((l) => {
    if (q) {
      const hay = `${l.name} ${l.phone} ${l.location} ${l.requirement} ${l.category} ${l.notes}`.toLowerCase()
      if (!hay.includes(q.toLowerCase())) return false
    }
    return Object.entries(filters).every(([k, v]) => !v || l[k] === v)
  }), [leads, q, filters])

  const eligible = visible.filter((l) => l.permission_status === 'opted_in' && l.phone)
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const allVisibleSelected = visible.length > 0 && visible.every((l) => selected.has(l.id))

  if (error) return <ErrorBox error={error} />
  if (!leads) return <Spinner />

  const RowMenu = ({ l }) => (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button className="rounded p-1 text-slate-400 hover:bg-slate-100" onClick={() => setMenu(menu === l.id ? null : l.id)} aria-label="Actions"><MoreVertical className="h-4 w-4" /></button>
      {menu === l.id && (
        <div className="absolute right-0 z-20 mt-1 w-52 rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {[
            [Eye, 'View details', () => setDetail({ id: l.id, tab: 'calls' })],
            [MessageCircle, 'Send WhatsApp message', null, 'Available after WhatsApp is connected (Phase 3)'],
            [ListPlus, 'Add to list', () => setListFor([l.id])],
            [StickyNote, 'Add notes', () => setDetail({ id: l.id, tab: 'notes' })],
            [PhoneCall, 'Call history', () => setDetail({ id: l.id, tab: 'calls' })],
            [Pencil, 'Edit lead', () => setForm({ lead: l })],
            [CheckSquare, 'Update status', () => setDetail({ id: l.id, tab: 'calls' })],
          ].map(([Icon, label, fn, tip]) => (
            <button key={label} disabled={!fn} title={tip} onClick={() => { setMenu(null); fn?.() }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300">
              <Icon className="h-4 w-4" />{label}
            </button>
          ))}
        </div>
      )}
    </div>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">All Leads Collected</h1>
          <p className="text-sm text-slate-500">{leads.length} lead{leads.length !== 1 && 's'} in {business.name}</p>
        </div>
        <Button onClick={() => setForm({})}><Plus className="h-4 w-4" /> Add lead</Button>
      </div>

      {leads.length === 0 ? (
        <Empty icon={Users} title="No leads yet" action={<Button onClick={() => setForm({})}><Plus className="h-4 w-4" /> Add your first lead</Button>}>
          Add people who have enquired or been referred to you. Remember to record whether they gave permission to receive WhatsApp messages.
        </Empty>
      ) : (
        <>
          <div className="card space-y-3 p-3">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input className="input pl-9" placeholder="Search name, phone, location, requirement, notes…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              {[
                ['lead_status', 'All lead statuses', Object.entries(LEAD_STATUS)],
                ['message_status', 'All message statuses', Object.entries(MESSAGE_STATUS).map(([k, v]) => [k, v.label])],
                ['permission_status', 'All permissions', Object.entries(PERMISSION).map(([k, v]) => [k, v.label])],
                ['category', 'All categories', options.category.map((c) => [c, c])],
                ['source', 'All sources', options.source.map((c) => [c, c])],
              ].map(([k, ph, opts]) => (
                <select key={k} className="input" value={filters[k]} onChange={(e) => setFilters((f) => ({ ...f, [k]: e.target.value }))}>
                  <option value="">{ph}</option>
                  {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
          </div>

          {/* Bulk action bar */}
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button size="sm" variant="secondary" onClick={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((l) => l.id)))}>
              {allVisibleSelected ? 'Clear selection' : `Select all shown (${visible.length})`}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setSelected(new Set(eligible.map((l) => l.id)))} title="Opted-in contacts with a phone number">
              Select all eligible ({eligible.length})
            </Button>
            {selected.size > 0 && (
              <>
                <span className="font-medium text-slate-700">{selected.size} selected</span>
                <Button size="sm" onClick={() => setListFor([...selected])}><ListPlus className="h-4 w-4" /> Add to list</Button>
                <Button size="sm" variant="secondary" disabled title="Coming with AI Message Studio (Phase 2)"><Sparkles className="h-4 w-4" /> Prepare messages</Button>
                <Button size="sm" variant="secondary" disabled title="Coming with WhatsApp integration (Phase 3)"><MessageCircle className="h-4 w-4" /> Send to eligible</Button>
              </>
            )}
          </div>

          {visible.length === 0 ? <Empty title="No leads match these filters" /> : (
            <>
              {/* Desktop table */}
              <div className="card hidden overflow-visible md:block">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-10 px-3 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((l) => l.id)))} /></th>
                      <th className="px-3 py-2">Name</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Category / Source</th>
                      <th className="px-3 py-2">Permission</th><th className="px-3 py-2">Message</th><th className="px-3 py-2">Lead status</th><th className="px-3 py-2">Added</th><th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {visible.map((l) => (
                      <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setDetail({ id: l.id, tab: 'calls' })}>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(l.id)} onChange={() => toggle(l.id)} /></td>
                        <td className="px-3 py-2"><div className="font-medium text-slate-800">{leadName(l)}</div>{l.name && <div className="text-xs text-slate-500">{l.phone}</div>}</td>
                        <td className="px-3 py-2 text-slate-600">{l.location || '—'}</td>
                        <td className="px-3 py-2"><div className="text-slate-700">{l.category || '—'}</div><div className="text-xs text-slate-400">{l.source}</div></td>
                        <td className="px-3 py-2"><Chip className={PERMISSION[l.permission_status].chip}>{PERMISSION[l.permission_status].label}</Chip></td>
                        <td className="px-3 py-2"><MessageDot status={l.message_status} /></td>
                        <td className="px-3 py-2 text-slate-700">{LEAD_STATUS[l.lead_status]}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">{fmtDate(l.created_at)}</td>
                        <td className="px-2 py-2" onClick={(e) => e.stopPropagation()}><RowMenu l={l} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 md:hidden">
                {visible.map((l) => (
                  <div key={l.id} className="card flex gap-3 p-3" onClick={() => setDetail({ id: l.id, tab: 'calls' })}>
                    <input type="checkbox" className="mt-1" checked={selected.has(l.id)} onClick={(e) => e.stopPropagation()} onChange={() => toggle(l.id)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0"><div className="truncate font-medium text-slate-800">{leadName(l)}</div>
                          <div className="text-xs text-slate-500">{[l.name && l.phone, l.location].filter(Boolean).join(' · ')}</div></div>
                        <RowMenu l={l} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <MessageDot status={l.message_status} />
                        <Chip className={PERMISSION[l.permission_status].chip}>{PERMISSION[l.permission_status].label}</Chip>
                        <Chip className="bg-slate-100 text-slate-700">{LEAD_STATUS[l.lead_status]}</Chip>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {form && <LeadForm key={form.lead?.id || 'new'} open onClose={() => setForm(null)} business={business} lead={form.lead} onSaved={load} />}
      {detail && <LeadDetail open onClose={() => setDetail(null)} business={business} leadId={detail.id} initialTab={detail.tab} onChanged={load}
        onEdit={(lead) => { setDetail(null); setForm({ lead }) }} />}
      {listFor && <AddToListModal open onClose={() => setListFor(null)} business={business} leadIds={listFor} onDone={() => setSelected(new Set())} />}
    </div>
  )
}
