import { useEffect, useState } from 'react'
import { NavLink, Outlet, useNavigate, useOutletContext, useParams } from 'react-router-dom'
import {
  LayoutDashboard, Search, Users, MessageCircle, ListChecks, PhoneCall, Sparkles, CalendarDays,
  Menu, X, ChevronsLeft, ChevronsRight, ArrowLeftRight, LogOut,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { BUSINESS_THEME } from '../lib/constants'
import { ErrorBox, Spinner } from './ui'

const NAV = [
  { to: '', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: 'search', label: 'Search Leads', icon: Search },
  { to: 'leads', label: 'All Leads Collected', icon: Users },
  { to: 'messaged', label: 'Messaged Leads', icon: MessageCircle },
  { to: 'lists', label: 'My Lists', icon: ListChecks },
  { to: 'calls', label: 'Call History', icon: PhoneCall },
  { to: 'studio', label: 'AI Message Studio', icon: Sparkles },
  { to: 'planner', label: '7-Day Growth Planner', icon: CalendarDays },
]

// Every page reads the current business from here, so queries are always filtered by business_id.
export const useBusiness = () => useOutletContext()

export default function Layout({ session }) {
  const { slug } = useParams()
  const nav = useNavigate()
  const [businesses, setBusinesses] = useState([])
  const [error, setError] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('cf_sidebar') === '1' } catch { return false } })

  useEffect(() => {
    supabase.from('cf_businesses').select('*').order('name').then(({ data, error }) => {
      if (error) setError(error); else setBusinesses(data)
    })
  }, [])
  useEffect(() => { try { localStorage.setItem('cf_sidebar', collapsed ? '1' : '0') } catch { /* ignore */ } }, [collapsed])
  useEffect(() => setMobileOpen(false), [slug])

  const business = businesses.find((b) => b.slug === slug)
  const other = businesses.find((b) => b.slug !== slug)
  const theme = BUSINESS_THEME[slug] || BUSINESS_THEME['health-coaching']

  if (error) return <div className="p-6"><ErrorBox error={error} /></div>
  if (!businesses.length) return <Spinner />
  if (!business) return <div className="p-6"><ErrorBox error="You don't have access to this business." /></div>

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className={`flex items-center gap-3 px-4 py-4 ${collapsed ? 'lg:justify-center lg:px-2' : ''}`}>
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-lg ${theme.soft}`}>{theme.emoji}</div>
        <div className={`min-w-0 ${collapsed ? 'lg:hidden' : ''}`}>
          <div className="truncate text-sm font-semibold text-slate-900">{business.name}</div>
          <div className="text-xs text-slate-400">ConnectFlow AI</div>
        </div>
      </div>
      <nav className="flex-1 space-y-0.5 px-2">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} title={n.label}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition ${collapsed ? 'lg:justify-center' : ''} ${
                isActive ? `${theme.soft} ${theme.text}` : 'text-slate-600 hover:bg-slate-100'}`}>
            <n.icon className="h-4 w-4 shrink-0" />
            <span className={collapsed ? 'lg:hidden' : ''}>{n.label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="space-y-0.5 border-t border-slate-100 p-2">
        {other && (
          <button onClick={() => nav(`/b/${other.slug}`)} title={`Switch to ${other.name}`}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 ${collapsed ? 'lg:justify-center' : ''}`}>
            <ArrowLeftRight className="h-4 w-4 shrink-0" /><span className={`truncate ${collapsed ? 'lg:hidden' : ''}`}>Switch to {other.name}</span>
          </button>
        )}
        <button onClick={() => supabase.auth.signOut()} title="Sign out"
          className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-600 hover:bg-slate-100 ${collapsed ? 'lg:justify-center' : ''}`}>
          <LogOut className="h-4 w-4 shrink-0" /><span className={collapsed ? 'lg:hidden' : ''}>Sign out</span>
        </button>
        <button onClick={() => setCollapsed((c) => !c)} className="hidden w-full items-center justify-center rounded-lg py-2 text-slate-400 hover:bg-slate-100 lg:flex" title="Collapse sidebar">
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button onClick={() => setMobileOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5 text-slate-600" /></button>
        <span className="text-lg">{theme.emoji}</span>
        <span className="truncate font-semibold text-slate-800">{business.name}</span>
      </div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMobileOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 bg-white shadow-xl">
            <button className="absolute right-3 top-4 text-slate-400" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X className="h-5 w-5" /></button>
            {sidebar}
          </div>
        </div>
      )}
      <aside className={`fixed inset-y-0 left-0 hidden border-r border-slate-200 bg-white lg:block ${collapsed ? 'w-16' : 'w-64'}`}>{sidebar}</aside>
      <main className={`${collapsed ? 'lg:pl-16' : 'lg:pl-64'}`}>
        <div className="mx-auto max-w-7xl p-4 sm:p-6">
          {/* key forces every page to fully reload when switching business, so data never carries over */}
          <Outlet key={business.id} context={{ business, theme, session }} />
        </div>
      </main>
    </div>
  )
}
