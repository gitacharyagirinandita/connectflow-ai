import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button, ErrorBox, Field } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [info, setInfo] = useState(null)

  async function submit(e) {
    e.preventDefault()
    setLoading(true); setError(null); setInfo(null)
    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message === 'Email not confirmed' ? 'Please confirm your email first – check your inbox for the Supabase link.' : error.message)
    } else if (mode === 'signup') {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else if (!data.session) setInfo('Account created. Please open the confirmation email, click the link, then come back and sign in.')
    } else {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) setError(error.message)
      else setInfo('If this email has an account, a password reset link has been sent.')
    }
    setLoading(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg"><Sparkles className="h-6 w-6" /></div>
          <h1 className="text-2xl font-bold text-slate-900">ConnectFlow AI</h1>
          <p className="mt-1 text-sm text-slate-500">Your smart lead discovery, CRM & growth assistant</p>
        </div>
        <form onSubmit={submit} className="card space-y-4 p-6">
          <h2 className="font-semibold text-slate-800">{mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset password'}</h2>
          <Field label="Email"><input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" /></Field>
          {mode !== 'reset' && (
            <Field label="Password" hint={mode === 'signup' ? 'At least 6 characters' : undefined}>
              <input className="input" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
            </Field>
          )}
          <ErrorBox error={error} />
          {info && <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{info}</div>}
          <Button type="submit" className="w-full" loading={loading}>
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
          </Button>
          <div className="flex justify-between text-xs">
            {mode === 'signin' ? (
              <>
                <button type="button" className="text-indigo-600 hover:underline" onClick={() => setMode('signup')}>First time? Create account</button>
                <button type="button" className="text-slate-500 hover:underline" onClick={() => setMode('reset')}>Forgot password?</button>
              </>
            ) : (
              <button type="button" className="text-indigo-600 hover:underline" onClick={() => setMode('signin')}>← Back to sign in</button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
