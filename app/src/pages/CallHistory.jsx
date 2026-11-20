import { useCallback, useEffect, useState } from 'react'
import { Plus, PhoneCall, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBusiness } from '../components/Layout'
import { CALL_OUTCOME, INTEREST, fmtDate, fmtDateTime, leadName } from '../lib/constants'
import { Button, Chip, Empty, ErrorBox, Spinner } from '../components/ui'
import CallForm from '../components/CallForm'
import LeadDetail from '../components/LeadDetail'

const OUTCOME_CHIP = {
  interested: 'bg-green-100 text-green-800', requested_info: 'bg-blue-100 text-blue-800', one_to_one_agreed: 'bg-emerald-100 text-emerald-800',
  follow_up_required: 'bg-orange-100 text-orange-800', not_interested: 'bg-red-100 text-red-700', no_answer: 'bg-slate-100 text-slate-600',
}

export default function CallHistory() {
  const { business } = useBusiness()
  const [calls, setCalls] = useState(null)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)
  const [detail, setDetail] = useState(null)
  const [q, setQ] = useState('')
  const [outcome, setOutcome] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('cf_call_history').select('*, lead:cf_leads(id, name, phone)').eq('business_id', business.id).order('called_at', { ascending: false }).limit(500)
    if (error) setError(error); else setCalls(data)
  }, [business.id])
  useEffect(() => { load() }, [load])

  if (error) return <ErrorBox error={error} />
  if (!calls) return <Spinner />
  const shown = calls.filter((c) => (!outcome || c.outcome === outcome) &&
    (!q || `${c.lead?.name} ${c.lead?.phone} ${c.discussion_notes} ${c.additional_notes}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-xl font-bold text-slate-900">Call History</h1><p className="text-sm text-slate-500">Every call is kept permanently – nothing is ever overwritten.</p></div>
        <Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add call record</Button>
      </div>
      {calls.length === 0 ? (
        <Empty icon={PhoneCall} title="No calls recorded yet" action={<Button onClick={() => setAdding(true)}><Plus className="h-4 w-4" /> Add your first call</Button>}>
          After each phone call, note what was discussed, the outcome and the next follow-up date.
        </Empty>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
            <div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input className="input pl-9" placeholder="Search contact or notes…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
            <select className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
              <option value="">All outcomes</option>
              {Object.entries(CALL_OUTCOME).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            {shown.map((c) => (
              <div key={c.id} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <button className="text-left font-medium text-slate-800 hover:text-indigo-700" onClick={() => setDetail(c.lead?.id)}>{leadName(c.lead)}</button>
                  <span className="text-xs text-slate-400">{fmtDateTime(c.called_at)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip className={OUTCOME_CHIP[c.outcome]}>{CALL_OUTCOME[c.outcome]}</Chip>
                  {c.interest_level && <Chip className="bg-slate-100 text-slate-700">Interest: {INTEREST[c.interest_level]}</Chip>}
                  {c.agreed_one_to_one && <Chip className="bg-green-100 text-green-800">1:1 call agreed</Chip>}
                  {c.next_follow_up && <Chip className="bg-orange-100 text-orange-800">Next follow-up: {fmtDate(c.next_follow_up)}</Chip>}
                </div>
                {c.discussion_notes && <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{c.discussion_notes}</p>}
                {c.additional_notes && <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">{c.additional_notes}</p>}
              </div>
            ))}
            {shown.length === 0 && <Empty title="No calls match" />}
          </div>
        </>
      )}
      {adding && <CallForm open onClose={() => setAdding(false)} business={business} onSaved={load} />}
      {detail && <LeadDetail open onClose={() => setDetail(null)} business={business} leadId={detail} initialTab="calls" onChanged={load} />}
    </div>
  )
}
