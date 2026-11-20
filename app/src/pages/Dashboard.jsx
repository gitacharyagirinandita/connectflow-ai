import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Send, CheckCheck, MessageSquareReply, Clock, Heart, PhoneCall, BellRing, Trophy, Activity, CalendarDays } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useBusiness } from '../components/Layout'
import { ErrorBox, Spinner } from '../components/ui'
import { fmtDateTime, todayISO } from '../lib/constants'

const TILES = [
  ['total_leads', 'Total leads collected', Users],
  ['messages_sent', 'Messages sent', Send],
  ['messages_delivered', 'Messages delivered', CheckCheck],
  ['replies_received', 'Replies received', MessageSquareReply],
  ['not_replied', 'Not replied yet', Clock],
  ['interested', 'Interested leads', Heart],
  ['calls_booked', '1:1 calls booked', PhoneCall],
  ['followups_pending', 'Follow-ups pending', BellRing],
  ['converted', 'Converted', Trophy],
]

export default function Dashboard() {
  const { business, theme } = useBusiness()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState([])
  const [followUps, setFollowUps] = useState([])
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      const [s, a, f] = await Promise.all([
        supabase.rpc('cf_dashboard_stats', { bid: business.id }),
        supabase.from('cf_activity_logs').select('*').eq('business_id', business.id).order('created_at', { ascending: false }).limit(10),
        supabase.from('cf_follow_ups').select('*, lead:cf_leads(name, phone)').eq('business_id', business.id).eq('status', 'pending').order('due_date').limit(6),
      ])
      if (s.error || a.error || f.error) { setError(s.error || a.error || f.error); return }
      setStats(s.data); setActivity(a.data); setFollowUps(f.data)
    })()
  }, [business.id])

  if (error) return <ErrorBox error={error} />
  if (!stats) return <Spinner />

  const weekly = stats.weekly || []
  const max = Math.max(1, ...weekly.flatMap((d) => [d.leads, d.messages, d.replies, d.calls]))
  const today = todayISO()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-sm text-slate-500">Live numbers from your {business.name} records</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {TILES.map(([k, label, Icon]) => (
          <div key={k} className="card p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500">{label}</span>
              <Icon className={`h-4 w-4 ${theme.text}`} />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{stats[k] ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold text-slate-800">Last 7 days</h2>
          <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-500">
            {[['bg-indigo-500', 'Leads added'], ['bg-green-500', 'Messages sent'], ['bg-blue-400', 'Replies'], ['bg-amber-500', 'Calls']].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5"><span className={`h-2.5 w-2.5 rounded-sm ${c}`} />{l}</span>
            ))}
          </div>
          <div className="flex h-40 items-end gap-2">
            {weekly.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex h-32 w-full items-end justify-center gap-0.5">
                  {[['leads', 'bg-indigo-500'], ['messages', 'bg-green-500'], ['replies', 'bg-blue-400'], ['calls', 'bg-amber-500']].map(([k, c]) => (
                    <div key={k} title={`${k}: ${d[k]}`} className={`w-1/5 max-w-3 rounded-t ${c}`} style={{ height: `${(d[k] / max) * 100}%`, minHeight: d[k] ? 4 : 0 }} />
                  ))}
                </div>
                <span className="text-[10px] text-slate-400">{d.day}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><BellRing className="h-4 w-4" /> Follow-ups due</h2>
          {followUps.length === 0 ? <p className="text-sm text-slate-400">No pending follow-ups. 🎉</p> : (
            <ul className="space-y-2">
              {followUps.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="min-w-0"><span className="font-medium text-slate-800">{f.lead?.name || f.lead?.phone}</span>
                    <span className="block truncate text-xs text-slate-500">{f.reason}</span></span>
                  <span className={`shrink-0 text-xs ${f.due_date < today ? 'font-semibold text-red-600' : f.due_date === today ? 'font-semibold text-orange-600' : 'text-slate-500'}`}>
                    {f.due_date < today ? 'Overdue' : f.due_date === today ? 'Today' : new Date(f.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-800"><Activity className="h-4 w-4" /> Recent activity</h2>
          {activity.length === 0 ? (
            <p className="text-sm text-slate-400">Nothing yet. Start by <Link to="leads" className="text-indigo-600 hover:underline">adding your first lead</Link>.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {activity.map((a) => (
                <li key={a.id} className="flex justify-between gap-3 py-2 text-sm">
                  <span className="text-slate-700">{a.action}</span>
                  <span className="shrink-0 text-xs text-slate-400">{fmtDateTime(a.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card p-5">
          <h2 className="mb-2 flex items-center gap-2 font-semibold text-slate-800"><CalendarDays className="h-4 w-4" /> Today's plan tasks</h2>
          <p className="text-sm text-slate-400">Your 7-Day Growth Planner tasks will show here once the planner is set up (Phase 4).</p>
        </div>
      </div>
    </div>
  )
}
