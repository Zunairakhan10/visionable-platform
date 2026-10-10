import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
let supabase

export function isAuthConfigured() {
  return Boolean(supabaseUrl && supabaseAnonKey)
}

export function getAuthClient() {
  if (!isAuthConfigured()) {
    throw new Error('Authentication is not configured. Add the public Supabase URL and anon key to the frontend environment.')
  }

  if (!supabase) {
    supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    })
  }

  return supabase
}

export async function getSupabaseAuthSession() {
  if (!isAuthConfigured()) return null

  const { data, error } = await getAuthClient().auth.getSession()
  if (error) throw new Error('Your session could not be verified.')
  return data.session
}

export async function signOutSupabaseUser() {
  if (!isAuthConfigured()) return

  const { error } = await getAuthClient().auth.signOut()
  if (error) throw new Error('Your session could not be cleared.')
}

export async function authenticatedApiRequest(path, options = {}) {
  const session = await getSupabaseAuthSession()
  if (!session?.access_token) throw new Error('Sign in is required to use this feature.')

  return fetch(path, {
    ...options,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  })
}
