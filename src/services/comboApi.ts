import type { ShareableState } from './urlState'
import { requireSupabase } from './supabase'

export type ComboVisibility = 'public' | 'unlisted'

export interface SavedCombo {
  slug: string
  title: string
  visibility: ComboVisibility
  payload: ShareableState
  createdAt: string
  updatedAt: string
}

interface ComboApiError extends Error {
  status?: number
}

async function comboRequest<T>(path: string, options: RequestInit = {}, requiresAuth = false): Promise<T> {
  const client = requireSupabase()
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
  const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  if (!supabaseUrl || !publishableKey) throw new Error('Online sharing is not configured for this site.')
  const { data: { session } } = await client.auth.getSession()
  if (requiresAuth && !session) throw new Error('Please sign in to manage saved combos.')

  const response = await fetch(`${supabaseUrl}/functions/v1/combos${path}`, {
    ...options,
    headers: {
      apikey: publishableKey,
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...options.headers,
    },
  })

  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    const error = new Error(body.error || 'The combo request failed.') as ComboApiError
    error.status = response.status
    throw error
  }

  return response.json() as Promise<T>
}

export function getCombo(slug: string): Promise<SavedCombo> {
  return comboRequest<SavedCombo>(`/${slug}`)
}

export function listCombos(): Promise<SavedCombo[]> {
  return comboRequest<SavedCombo[]>('', {}, true)
}

export function createCombo(input: { title: string, visibility: ComboVisibility, payload: ShareableState }): Promise<SavedCombo> {
  return comboRequest<SavedCombo>('', { method: 'POST', body: JSON.stringify(input) }, true)
}

export function updateCombo(slug: string, input: { title: string, visibility: ComboVisibility, payload?: ShareableState }): Promise<SavedCombo> {
  return comboRequest<SavedCombo>(`/${slug}`, { method: 'PATCH', body: JSON.stringify(input) }, true)
}

export function deleteCombo(slug: string): Promise<void> {
  return comboRequest<void>(`/${slug}`, { method: 'DELETE' }, true)
}

export function deleteAccount(): Promise<void> {
  return comboRequest<void>('/account', { method: 'DELETE' }, true)
}

export function getShortComboUrl(slug: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/c/${slug}`
}
