import { useEffect, useState } from 'react'
import { Search, ExternalLink, ShieldCheck, Bookmark, CheckCircle2, Loader2, Phone } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBusiness } from '../components/Layout'
import { Button, Empty, ErrorBox, Field } from '../components/ui'
import LeadForm from '../components/LeadForm'

// Searches run on the ConnectFlow n8n workflow (Brave Search, India). The workflow checks the
// user's login before searching. Nothing is invented: every result is a real public web page.
const SEARCH_URL = import.meta.env.VITE_LEAD_SEARCH_URL || 'https://girinanditanagalapur.app.n8n.cloud/webhook/connectflow-search-leads'

const EXAMPLES = {
  'health-coaching': ['People looking for weight management coaching', 'People seeking nutrition guidance', 'People searching for fitness coaching', 'People interested in healthy lifestyle support'],
  'ratnagiri-gurukula': ['Parents looking for Bhagavad Gita classes', 'Parents interested in value-based education', 'Parents seeking emotional development programs for children', 'Parents of children aged 9–16 interested in holistic learning'],
}

const SOURCES = [['any', 'Whole web'], ['forums', 'Forums & Q&A (best for enquiries)'], ['reddit', 'Reddit'], ['quora', 'Quora'], ['facebook', 'Facebook (public)'], ['linkedin', 'LinkedIn (public)'], ['twitter', 'X / Twitter']]
const ENQUIRY = [['', 'Any'], ['recommendation', 'Asking for recommendations'], ['looking', '"Looking for…"'], ['question', 'Asking a question']]
const FRESH = [['', 'Any time'], ['pd', 'Past 24 hours'], ['pw', 'Past week'], ['pm', 'Past month'], ['py', 'Past year']]

export default function SearchLeads() {
  const { business } = useBusiness()
  const [f, setF] = useState({ query: '', location: '', category: '', ageGroup: '', requirement: '', source: 'any', enquiryType: '', freshness: '' })
  const [results, setResults] = useState(null)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [savedLinks, setSavedLinks] = useState(new Set())
  const [saving, setSaving] = useState(null)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  useEffect(() => {
    supabase.from('cf_leads').select('source_link').eq('business_id', business.id).not('source_link', 'is', null)
      .then(({ data }) => setSavedLinks(new Set((data || []).map((d) => d.source_link))))
  }, [business.id])

  async function run(nextPage = 0) {
    if (f.query.trim().length < 3) { setError('Please type who you want to find (at least 3 letters).'); return }
    setLoading(true); setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in again.')
      // form-encoded = no CORS pre-flight, works from phone and PC
      const body = new URLSearchParams({ ...f, page: String(nextPage), token: session.access_token })
      const res = await fetch(SEARCH_URL, { method: 'POST', body })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.ok) throw new Error(json?.error || `Search service error (${res.status}). Please try again.`)
      setResults((prev) => (nextPage === 0 ? json.results : [...(prev || []), ...json.results.filter((r) => !(prev || []).some((p) => p.url === r.url))]))
      setPage(nextPage)
    } catch (e) {
      setError(e.message === 'Failed to fetch' ? 'Could not reach the search service. Check your internet and try again.' : e.message)
    }
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div><h1 className="text-xl font-bold text-slate-900">Search Leads</h1><p className="text-sm text-slate-500">Find people who have publicly asked for help like yours · powered by Brave Search (India)</p></div>

      <form className="card space-y-3 p-4" onSubmit={(e) => { e.preventDefault(); run(0) }}>
        <Field label="Who do you want to find?">
          <textarea className="input" rows={2} value={f.query} onChange={set('query')} placeholder={EXAMPLES[business.slug]?.[0]} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {(EXAMPLES[business.slug] || []).map((e) => <button type="button" key={e} onClick={() => setF((x) => ({ ...x, query: e }))} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200">{e}</button>)}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          <Field label="Location"><input className="input" value={f.location} onChange={set('location')} placeholder="e.g. Pune" /></Field>
          <Field label="Category"><input className="input" value={f.category} onChange={set('category')} placeholder={business.slug === 'ratnagiri-gurukula' ? 'e.g. Gita classes' : 'e.g. Nutrition'} /></Field>
          <Field label="Age group"><input className="input" value={f.ageGroup} onChange={set('ageGroup')} placeholder={business.slug === 'ratnagiri-gurukula' ? 'e.g. 9–16 years' : 'e.g. 30s, women'} /></Field>
          <Field label="Specific requirement"><input className="input" value={f.requirement} onChange={set('requirement')} placeholder="e.g. weekend, online" /></Field>
          <Field label="Source"><select className="input" value={f.source} onChange={set('source')}>{SOURCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Enquiry type"><select className="input" value={f.enquiryType} onChange={set('enquiryType')}>{ENQUIRY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <Field label="Posted"><select className="input" value={f.freshness} onChange={set('freshness')}>{FRESH.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
          <div className="flex items-end"><Button type="submit" className="w-full" loading={loading && page === 0}><Search className="h-4 w-4" /> Search</Button></div>
        </div>
        <p className="text-xs text-slate-400">Tip: choose <b>Forums & Q&A</b> + <b>Asking for recommendations</b> to find real people asking, rather than other businesses' websites.</p>
      </form>

      <ErrorBox error={error} />

      {loading && !results && <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Searching the web…</div>}

      {results && (results.length === 0 ? (
        <Empty icon={Search} title="No results found">Try fewer words, a bigger city, or "Whole web" as the source.</Empty>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">{results.length} real results · discovered {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
          {results.map((r) => {
            const saved = savedLinks.has(r.url)
            return (
              <div key={r.url} className="card p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <a href={r.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 font-medium text-indigo-700 hover:underline">{r.title} <ExternalLink className="inline h-3.5 w-3.5" /></a>
                  {saved
                    ? <span className="flex items-center gap-1 text-xs font-medium text-green-700"><CheckCircle2 className="h-4 w-4" /> Saved</span>
                    : <Button size="sm" onClick={() => setSaving(r)}><Bookmark className="h-3.5 w-3.5" /> Save lead</Button>}
                </div>
                {r.snippet && <p className="mt-1 text-sm text-slate-600">{r.snippet}</p>}
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span>Source: <b className="text-slate-700">{r.source || r.domain}</b></span>
                  {r.age && <span>Posted: {r.age}</span>}
                  {r.public_phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" /> Number shown in public post: {r.public_phone}</span>}
                  <span className="text-slate-400">Permission: Unknown</span>
                </div>
              </div>
            )
          })}
          {page < 9 && <div className="pt-2 text-center"><Button variant="secondary" onClick={() => run(page + 1)} loading={loading}>Load more results</Button></div>}
        </div>
      ))}

      <div className="flex items-start gap-3 rounded-xl bg-slate-100 p-4 text-xs text-slate-600">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        Results are real public web pages. A public post does not give permission to send WhatsApp messages, so every saved lead starts with permission "Unknown". Reply to them where they posted, or ask for their permission first.
      </div>

      {saving && (
        <LeadForm open onClose={() => setSaving(null)} business={business}
          initial={{
            name: '', phone: saving.public_phone || '', location: f.location, category: f.category,
            requirement: `${saving.title}${saving.snippet ? ' — ' + saving.snippet : ''}`.slice(0, 500),
            source: saving.source || saving.domain || 'Web search', source_link: saving.url,
            notes: `Found via Search Leads on ${new Date().toLocaleDateString('en-IN')}${saving.age ? ` · posted ${saving.age}` : ''}`,
          }}
          onSaved={() => setSavedLinks((s) => new Set([...s, saving.url]))} />
      )}
    </div>
  )
}
