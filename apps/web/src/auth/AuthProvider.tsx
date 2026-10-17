import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { createClient, type Session } from '@supabase/supabase-js'
import { apiRequest, ApiError } from '../api/client'
import type { components } from '../api/generated/schema'

type Actor = components['schemas']['ActorView']

function configuredClient() {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined
  if (!url || !key || key.startsWith('sb_secret_')) return null
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:' && !(import.meta.env.DEV && parsed.protocol === 'http:' &&
      ['127.0.0.1', 'localhost'].includes(parsed.hostname))) return null
    if (!key.startsWith('sb_publishable_')) {
      const part = key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
      const claims = JSON.parse(atob(part)) as { role?: string }
      if (claims.role !== 'anon') return null
    }
    return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true,
      detectSessionInUrl: false } })
  } catch { return null }
}

const client = configuredClient()
type AuthState = {
  session: Session | null; actor: Actor | null; loading: boolean; message: string; configured: boolean
  signIn: (email: string, password: string) => Promise<boolean>
  signOut: () => Promise<void>
  retryWorkspace: () => void
}
const Context = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [actor, setActor] = useState<Actor | null>(null)
  const [loading, setLoading] = useState(Boolean(client))
  const [message, setMessage] = useState('')
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    if (!client) return
    // Keep this callback synchronous; perform API work in the separate effect.
    const { data: { subscription } } = client.auth.onAuthStateChange((event, next) => {
      setSession(next)
      setActor(null)
      setLoading(Boolean(next))
      if (event === 'SIGNED_OUT') setMessage('Your session ended. Sign in to continue.')
    })
    return () => subscription.unsubscribe()
  }, [])
  useEffect(() => {
    if (!session) return
    setLoading(true)
    setMessage('')
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 10_000)
    apiRequest<Actor>('/v1/me', { token: session.access_token, signal: controller.signal })
      .then(value => { if (!controller.signal.aborted) { setActor(value); setMessage('') } })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setMessage(error instanceof ApiError ? error.message : 'Workspace access could not be checked.')
        if (error instanceof ApiError && error.status === 401) {
          setSession(null)
          void client?.auth.signOut({ scope: 'local' })
        }
      })
      .finally(() => { window.clearTimeout(timeout); if (!controller.signal.aborted) setLoading(false) })
    const onTimeout = window.setTimeout(() => {
      if (controller.signal.aborted) { setLoading(false); setMessage('Workspace connection timed out. Check that start.cmd is running, then retry.') }
    }, 10_050)
    return () => { controller.abort(); window.clearTimeout(timeout); window.clearTimeout(onTimeout) }
  }, [session, retry])
  async function signIn(email: string, password: string) {
    if (!client) return false
    setLoading(true); setMessage('')
    try {
      const { error } = await client.auth.signInWithPassword({ email, password })
      if (error) { setMessage('Sign-in failed. Check your details or ask your coordinator.'); setLoading(false); return false }
      return true
    } catch { setMessage('Sign-in connection failed. Please try again.'); setLoading(false); return false }
  }
  async function signOut() {
    setActor(null); setSession(null); setMessage('You are signed out.'); setLoading(false)
    await client?.auth.signOut({ scope: 'local' }).catch(() => undefined)
  }
  return <Context.Provider value={{ session, actor, loading, message, configured: Boolean(client), signIn, signOut,
    retryWorkspace: () => setRetry(value => value + 1) }}>{children}</Context.Provider>
}

export function useAuth() {
  const state = useContext(Context)
  if (!state) throw new Error('AuthProvider is required')
  return state
}
