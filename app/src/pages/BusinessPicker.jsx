import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight, LogOut, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BUSINESS_THEME } from '../lib/constants'
import { Button, ErrorBox, Spinner } from '../components/ui'

export default function BusinessPicker({ session }) {
  const nav = useNavigate()
  const [businesses, setBusinesses] = useState(null)
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      // First signed-in person becomes the owner of both workspaces. Nobody else can claim them later.
      const { data: claim, error: claimErr } = await supabase.rpc('cf_claim_workspaces')
      if (claimErr) { setError(claimErr); return }
      setStatus(claim)
      const { data, error } = await supabase.from('cf_businesses').select('*').order('name')
      if (error) setError(error)
      else setBusinesses(data)
    })()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-4">
      <div className="mx-auto max-w-3xl pt-8 sm:pt-16">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Namaste 🙏</h1>
            <p className="text-sm text-slate-500">{session.user.email} · Choose a business to open its workspace</p>
          </div>
          <Button variant="ghost" onClick={() => supabase.auth.signOut()}><LogOut className="h-4 w-4" /> Sign out</Button>
        </div>
        <ErrorBox error={error} />
        {!businesses && !error && <Spinner />}
        {businesses && businesses.length === 0 && (
          <div className="card flex items-start gap-3 p-6">
            <Lock className="mt-0.5 h-5 w-5 text-slate-400" />
            <div>
              <h2 className="font-semibold text-slate-800">No workspace access yet</h2>
              <p className="mt-1 text-sm text-slate-500">
                {status === 'owner_exists'
                  ? 'These workspaces already have an owner. Please ask the owner to give your account access.'
                  : 'Your account has not been given access to any business.'}
              </p>
            </div>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {businesses?.map((b) => {
            const t = BUSINESS_THEME[b.slug] || BUSINESS_THEME['health-coaching']
            return (
              <button key={b.id} onClick={() => nav(`/b/${b.slug}`)}
                className={`card group p-6 text-left transition hover:-translate-y-0.5 hover:shadow-md hover:ring-2 ${t.ring}`}>
                <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${t.soft}`}>{t.emoji}</div>
                <h2 className="text-lg font-semibold text-slate-900">{b.name}</h2>
                <p className="mt-1 text-sm text-slate-500">{b.tagline}</p>
                <span className={`mt-4 inline-flex items-center gap-1 text-sm font-medium ${t.text}`}>Open workspace <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
