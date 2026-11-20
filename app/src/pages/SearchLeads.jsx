import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, PlugZap, ShieldCheck } from 'lucide-react'
import { useBusiness } from '../components/Layout'
import { Button, Field } from '../components/ui'

const EXAMPLES = {
  'health-coaching': ['People looking for weight management coaching', 'People seeking nutrition guidance', 'People searching for fitness coaching', 'People interested in healthy lifestyle support'],
  'ratnagiri-gurukula': ['Parents looking for Bhagavad Gita classes', 'Parents interested in value-based education', 'Parents seeking emotional development programs for children', 'Parents of children aged 9–16 interested in holistic learning'],
}

// No lead search provider is connected yet, so this page never shows results – it never invents leads.
export default function SearchLeads() {
  const { business } = useBusiness()
  const [query, setQuery] = useState('')
  const [tried, setTried] = useState(false)

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-slate-900">Search Leads</h1><p className="text-sm text-slate-500">Find people who have publicly asked for help like yours</p></div>

      <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        <PlugZap className="mt-0.5 h-5 w-5 shrink-0" />
        <div><b>Live lead discovery is not configured yet.</b> No search provider is connected, so no results will be shown. ConnectFlow never creates fake leads.
          It will be connected in Phase 5 using permitted search sources. Until then, add enquiries by hand in <Link to="../leads" className="font-medium underline">All Leads Collected</Link>.</div>
      </div>

      <div className="card space-y-3 p-4">
        <Field label="Who do you want to find?">
          <textarea className="input" rows={2} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={EXAMPLES[business.slug]?.[0]} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {(EXAMPLES[business.slug] || []).map((e) => <button key={e} onClick={() => setQuery(e)} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200">{e}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
          {['Location', 'Category', 'Age group', 'Specific requirement', 'Source', 'Enquiry type'].map((f) => <input key={f} className="input" placeholder={f} disabled />)}
        </div>
        <Button onClick={() => setTried(true)} disabled={!query.trim()}><Search className="h-4 w-4" /> Search</Button>
        {tried && <p className="text-sm text-slate-500">No search provider is connected, so there are no live results to show.</p>}
      </div>

      <div className="flex items-start gap-3 rounded-xl bg-slate-100 p-4 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Only legitimate public enquiries and authorised sources will be used. A public post does not count as permission to send WhatsApp messages, so every saved lead starts with permission set to "Unknown".
      </div>
    </div>
  )
}
