import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { deleteAccount, deleteCombo, getShortComboUrl, listCombos, type SavedCombo, type ComboVisibility, updateCombo } from '../services/comboApi'

export default function MyCombosPage() {
  const { configured, loading: authLoading, user, signIn, signOut } = useAuth()
  const [combos, setCombos] = useState<SavedCombo[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const loadCombos = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      setCombos(await listCombos())
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load saved combos.')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { void loadCombos() }, [loadCombos])

  const copy = async (slug: string) => {
    await navigator.clipboard.writeText(getShortComboUrl(slug))
    setMessage('Short link copied.')
  }

  const remove = async (slug: string) => {
    if (!window.confirm('Delete this saved combo? This cannot be undone.')) return
    try {
      await deleteCombo(slug)
      setCombos(items => items.filter(item => item.slug !== slug))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete combo.')
    }
  }

  const changeVisibility = async (combo: SavedCombo, visibility: ComboVisibility) => {
    try {
      const updated = await updateCombo(combo.slug, { title: combo.title, visibility })
      setCombos(items => items.map(item => item.slug === combo.slug ? updated : item))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update combo.')
    }
  }

  const rename = async (combo: SavedCombo) => {
    const title = window.prompt('Combo title', combo.title)?.trim()
    if (!title || title === combo.title) return
    try {
      const updated = await updateCombo(combo.slug, { title, visibility: combo.visibility })
      setCombos(items => items.map(item => item.slug === combo.slug ? updated : item))
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to rename combo.')
    }
  }

  const removeAccount = async () => {
    if (window.prompt('Type DELETE to remove your account and all saved combos.') !== 'DELETE') return
    try {
      await deleteAccount()
      await signOut()
      setMessage('Your account and saved combos were deleted.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to delete account.')
    }
  }

  if (!configured) {
    return <div className="max-w-xl mx-auto p-8 text-center text-[var(--color-text-secondary)]">Online sharing has not been configured yet.</div>
  }

  if (authLoading) return <div className="p-8 text-center text-[var(--color-text-secondary)]">Loading account…</div>

  if (!user) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center glass-panel mt-10">
        <h1 className="text-2xl font-bold mb-3">My Combos</h1>
        <p className="text-[var(--color-text-secondary)] mb-6">Sign in to publish and manage short combo links.</p>
        <div className="flex justify-center gap-3">
          <button onClick={() => void signIn('google')} className="px-4 py-2 rounded bg-[var(--color-gold-500)] text-[var(--color-bg-primary)] font-semibold">Google</button>
          <button onClick={() => void signIn('discord')} className="px-4 py-2 rounded border border-[var(--color-border)]">Discord</button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8">
      <div className="flex flex-wrap gap-3 items-center justify-between mb-6">
        <div><h1 className="text-2xl font-bold">My Combos</h1><p className="text-sm text-[var(--color-text-secondary)]">{combos.length} / 25 saved combos</p></div>
        <div className="flex gap-2"><Link to="/sim" className="px-3 py-2 rounded border border-[var(--color-border)] text-sm">Simulator</Link><button onClick={() => void signOut()} className="px-3 py-2 rounded border border-[var(--color-border)] text-sm">Sign out</button></div>
      </div>
      {message && <p className="mb-4 text-sm text-[var(--color-gold-400)]">{message}</p>}
      {loading ? <p className="text-[var(--color-text-secondary)]">Loading saved combos…</p> : combos.length === 0 ? <p className="text-[var(--color-text-secondary)]">No saved combos yet.</p> : (
        <div className="space-y-3">{combos.map(combo => (
          <article key={combo.slug} className="glass-panel p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div><Link to={`/c/${combo.slug}`} className="font-semibold hover:text-[var(--color-gold-400)]">{combo.title}</Link><p className="text-xs text-[var(--color-text-secondary)]">{combo.visibility} · Updated {new Date(combo.updatedAt).toLocaleDateString()}</p></div>
            <div className="flex flex-wrap gap-2 text-sm"><button onClick={() => void copy(combo.slug)} className="px-2 py-1 rounded border border-[var(--color-border)]">Copy</button><button onClick={() => void rename(combo)} className="px-2 py-1 rounded border border-[var(--color-border)]">Rename</button><select value={combo.visibility} onChange={event => void changeVisibility(combo, event.target.value as ComboVisibility)} className="px-2 py-1 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)]"><option value="public">Public</option><option value="unlisted">Unlisted</option></select><button onClick={() => void remove(combo.slug)} className="px-2 py-1 rounded text-[var(--color-accent-rose)] border border-[var(--color-border)]">Delete</button></div>
          </article>
        ))}</div>
      )}
      <div className="mt-12 pt-6 border-t border-[var(--color-border)]"><h2 className="font-semibold">Delete account</h2><p className="text-sm text-[var(--color-text-secondary)] mb-3">Permanently deletes your profile and every saved combo.</p><button onClick={() => void removeAccount()} className="px-3 py-2 rounded text-sm border border-[var(--color-accent-rose)] text-[var(--color-accent-rose)]">Delete account</button></div>
    </div>
  )
}
