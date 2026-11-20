import { useEffect, useState } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { supabase } from './lib/supabase'
import { ConfirmProvider, Spinner, ToastProvider } from './components/ui'
import Login from './pages/Login'
import BusinessPicker from './pages/BusinessPicker'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Leads from './pages/Leads'
import Lists from './pages/Lists'
import CallHistory from './pages/CallHistory'
import SearchLeads from './pages/SearchLeads'
import ComingSoon from './pages/ComingSoon'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (session === undefined) return <Spinner label="Starting ConnectFlow AI…" />

  return (
    <ToastProvider>
      <ConfirmProvider>
        <HashRouter>
          {!session ? (
            <Routes><Route path="*" element={<Login />} /></Routes>
          ) : (
            <Routes>
              <Route path="/" element={<BusinessPicker session={session} />} />
              <Route path="/b/:slug" element={<Layout session={session} />}>
                <Route index element={<Dashboard />} />
                <Route path="search" element={<SearchLeads />} />
                <Route path="leads" element={<Leads />} />
                <Route path="messaged" element={<ComingSoon feature="messaged" />} />
                <Route path="lists" element={<Lists />} />
                <Route path="calls" element={<CallHistory />} />
                <Route path="studio" element={<ComingSoon feature="studio" />} />
                <Route path="planner" element={<ComingSoon feature="planner" />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          )}
        </HashRouter>
      </ConfirmProvider>
    </ToastProvider>
  )
}
