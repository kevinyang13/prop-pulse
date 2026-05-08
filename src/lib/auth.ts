import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function requireAuth() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // Check soft delete
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('deleted_at, analyses_used')
    .eq('id', user.id)
    .single() as { data: { deleted_at: string | null; analyses_used: number } | null, error: unknown }

  if (profile?.deleted_at) {
    throw NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  return { user, supabase, profile }
}

// Browser-side sign-in helpers
import { createClient as createBrowserClient } from '@/lib/supabase/client'

export async function signInWithGoogle() {
  const supabase = createBrowserClient()
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  })
  if (error) throw error
}

export async function signInWithMagicLink(email: string) {
  const supabase = createBrowserClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback`,
      shouldCreateUser: true,
    },
  })
  if (error) throw error
}

export async function signOut() {
  const supabase = createBrowserClient()
  const { error } = await supabase.auth.signOut()
  if (!error) window.location.href = '/'
}
