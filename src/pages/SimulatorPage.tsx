import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import type { CardData, GameContextValue } from '../types'
import { useGame } from '../context/GameContext'
import { useDeck } from '../context/DeckContext'
import { encodeState, readStateFromUrl, pushStateToUrl, generateShareUrl, validatePublishableState, type ShareableState } from '../services/urlState'
import { createCombo, getCombo, getShortComboUrl, updateCombo, type ComboVisibility } from '../services/comboApi'
import { useAuth } from '../context/AuthContext'
import { fetchAndCacheCards } from '../services/cardCache'
import { readYDKFile } from '../utils/ydkParser'
import { trackEvent } from '../services/analytics'
import DuelBoard from '../components/DuelBoard'
import CardDetailPanel from '../components/CardDetailPanel'
import ComboStepList from '../components/ComboStepList'
import { createInitialBoard, extractInitialStateInfo, replayCombo } from '../game/replay'

export default function SimulatorPage() {
  const { slug } = useParams<{ slug: string }>()
  const game = useGame()
  const deck = useDeck()
  const { configured, user, signIn } = useAuth()
  const [selectedCard, setSelectedCard] = useState<CardData | undefined | null>(undefined)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null)
  const [deckName, setDeckName] = useState('')
  const [, setMainDeck] = useState<number[]>([])
  const [, setExtraDeck] = useState<number[]>([])
  const [showLoginOptions, setShowLoginOptions] = useState(false)
  const [savedVisibility, setSavedVisibility] = useState<ComboVisibility>('unlisted')
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Snapshot deck at mount time so the load effect runs only once
  const deckSnapshotRef = useRef({ mainDeck: deck.mainDeck, extraDeck: deck.extraDeck, deckName: deck.deckName })

  const showToast = useCallback((msg: string, type: string = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  const handleSelectCard = useCallback((card?: CardData) => {
    setSelectedCard(card)
  }, [])

  // Parse state from URL hash on load
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true)
        const hash = window.location.hash
        if (slug || (hash && hash.length > 5)) {
          const state = slug ? getCombo(slug).then(combo => {
            setSavedVisibility(combo.visibility)
            return combo.payload
          }) : readStateFromUrl()
          const resolvedState = await state
          if (resolvedState) {
            const state = resolvedState
            setDeckName(state.name || '')
            setMainDeck(state.main || [])
            setExtraDeck(state.extra || [])

            // Fetch card data for all unique IDs in state
            const allIds = [...(state.main || []), ...(state.extra || [])]
            const cards = await fetchAndCacheCards(allIds)
            const map: Record<number | string, any> = {
              99999999: {
                id: 99999999,
                name: 'Monster Token',
                type: 'Token',
                humanType: 'Token Monster',
                frameType: 'token',
                desc: 'Monster Token',
              }
            }
            cards.forEach(card => {
              if (card) {
                map[card.id] = card
                map[String(card.id)] = card
              }
            })

            game.initBoard(state.main || [], state.extra || [], map)
            const initialBoard = createInitialBoard(state.main || [], state.extra || [], map, {
              init: state.init,
              tokens: state.tokens,
            })

            game.loadState(state.combo || [], replayCombo(initialBoard, state.combo || [], map))

            showToast('Loaded shared combo state!', 'success')
          }
        } else if (deckSnapshotRef.current.mainDeck.length > 0 || deckSnapshotRef.current.extraDeck.length > 0) {
          // Load active deck built in DeckBuilder page (snapshot at mount)
          const snap = deckSnapshotRef.current
          setDeckName(snap.deckName || '')
          setMainDeck(snap.mainDeck)
          setExtraDeck(snap.extraDeck)
          const allIds = [...snap.mainDeck, ...snap.extraDeck]
          const cards = await fetchAndCacheCards(allIds)
          const map = cards.reduce<Record<number, CardData>>((acc, c) => {
            if (c) acc[c.id] = c
            return acc
          }, {})
          game.initBoard(snap.mainDeck, snap.extraDeck, map)
          showToast(`Loaded ${snap.deckName || 'deck'} (${snap.mainDeck.length} cards)`, 'success')
        } else {
          // No deck anywhere — show empty board
          game.initBoard([], [], {})
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        showToast(`Failed to load state: ${message}`, 'error')
        game.initBoard([], [], {})
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]) // reload when a compact combo link is opened

  // YDK file import
  const handleFileImport = useCallback(async (file: File) => {
    try {
      setImporting(true)
      const parsed = await readYDKFile(file)
      const allIds = [...parsed.main, ...(parsed.extra || [])]

      // Resolve and cache cards
      const cards = await fetchAndCacheCards(allIds)
      const map = cards.reduce<Record<number, CardData>>((acc, c) => {
        if (c) acc[c.id] = c
        return acc
      }, {})

      setMainDeck(parsed.main)
      setExtraDeck(parsed.extra || [])
      deck.importDeck(parsed)
      game.initBoard(parsed.main, parsed.extra || [], map)
      showToast('Deck imported successfully!', 'success')
      trackEvent('deck_import', { source: 'ydk_file', main_count: parsed.main.length, extra_count: (parsed.extra || []).length })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showToast(`Import failed: ${message}`, 'error')
    } finally {
      setImporting(false)
    }
  }, [deck, fetchAndCacheCards, game, showToast])

  // Drag-and-drop file support
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.ydk') || file.type === 'text/plain')) {
      handleFileImport(file)
    }
  }, [handleFileImport])

  const buildShareState = useCallback((): ShareableState => {
    const { init, tokens } = extractInitialStateInfo(game.history[0])
    return {
      main: game.initialMainIds.current,
      extra: game.initialExtraIds.current,
      combo: game.combo,
      name: deckName || 'combo-deck',
      init,
      tokens,
    }
  }, [deckName, game.combo, game.history, game.initialExtraIds, game.initialMainIds])

  // Full links remain anonymous and self-contained.
  const handleShare = useCallback(() => {
    const state = buildShareState()

    const shareUrl = generateShareUrl(state)
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        pushStateToUrl(state)
        showToast('Share link copied to clipboard!', 'success')
        trackEvent('combo_shared', { step_count: game.combo.length })
      })
      .catch(() => showToast('Failed to copy link', 'error'))
  }, [buildShareState, game.combo.length, showToast])

  const handlePublish = useCallback(async () => {
    const state = buildShareState()
    const validationError = validatePublishableState(state)
    if (validationError) return showToast(validationError, 'error')
    if (!configured) return showToast('Online sharing is not configured for this site.', 'error')
    if (!user) {
      pushStateToUrl(state)
      sessionStorage.setItem('pendingComboState', encodeState(state))
      setShowLoginOptions(true)
      return
    }
    try {
      const combo = slug
        ? await updateCombo(slug, { title: state.name || 'Untitled combo', visibility: savedVisibility, payload: state })
        : await createCombo({ title: state.name || 'Untitled combo', visibility: 'unlisted', payload: state })
      const url = getShortComboUrl(combo.slug)
      await navigator.clipboard.writeText(url)
      showToast(slug ? 'Published combo updated and copied!' : 'Short link published and copied!', 'success')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to publish combo.', 'error')
    }
  }, [buildShareState, configured, savedVisibility, showToast, slug, user])

  const beginLogin = useCallback(async (provider: 'google' | 'discord') => {
    sessionStorage.setItem('pendingComboPublish', 'true')
    try {
      await signIn(provider)
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Unable to start sign-in.', 'error')
    }
  }, [showToast, signIn])

  useEffect(() => {
    if (!loading && user && sessionStorage.getItem('pendingComboPublish') === 'true') {
      sessionStorage.removeItem('pendingComboPublish')
      sessionStorage.removeItem('pendingComboState')
      void handlePublish()
    }
  }, [handlePublish, loading, user])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-[var(--color-text-muted)]">
        ⏳ Loading simulator state...
      </div>
    )
  }

  // If no deck is loaded anywhere
  const hasDeck = game.board.deck.length > 0 || game.board.hand.length > 0 || game.board.extra.length > 0 || game.board.gy.length > 0 || game.board.banish.length > 0 || game.board.free.length > 0 || game.board.m1 || game.board.m2 || game.board.m3 || game.board.st1 || game.board.st2 || game.board.st3 || game.board.field

  if (!hasDeck) {
    return (
      <div
        className="flex items-center justify-center h-[calc(100dvh-56px)]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="glass-panel p-10 max-w-lg text-center animate-fade-in">
          <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-3">
            Load a Deck to Simulate
          </h2>
          <p className="text-[var(--color-text-secondary)] mb-6 leading-relaxed">
            Drag & drop a YDK file here, or click the button below to load your deck and start simulating combos.
          </p>

          <div className="flex justify-center gap-3">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="px-6 py-2.5 rounded-lg bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] text-[var(--color-bg-primary)] font-semibold text-sm hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] transition-all duration-200 active:scale-95 disabled:opacity-50"
            >
              {importing ? 'Importing...' : 'Import YDK File'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ydk,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) {
                  handleFileImport(file)
                }
              }}
            />
          </div>
        </div>
      </div>
    )
  }

  const cardPanel = (
    <CardStatsPanel
      game={game}
      selectedCard={selectedCard}
      onClearCard={() => setSelectedCard(null)}
    />
  )

  const comboPanel = (
    <ComboRecorderPanel game={game} onShare={handleShare} onPublish={() => void handlePublish()} onlineSharing={configured} />
  )

  return (
    <div className="flex flex-col md:flex-row min-h-[calc(100dvh-56px)] md:h-[calc(100dvh-56px)] overflow-y-auto md:overflow-hidden">
      <div className="w-full h-[340px] md:w-80 md:h-full flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] border-b md:border-b-0 md:border-r border-[var(--color-border)] overflow-hidden">
        {cardPanel}
      </div>

      <div className="w-full flex-shrink-0 md:flex-1 md:min-w-[640px] md:h-full bg-[var(--color-bg-primary)] border-b md:border-b-0 md:border-r border-[var(--color-border)] flex flex-col min-w-0">
        <div className="w-full md:flex-1 md:min-h-0">
          <DuelBoard
            onSelectCard={handleSelectCard}
            onHoverCard={setSelectedCard}
          />
        </div>
      </div>

      <div className="w-full h-[340px] md:w-80 md:h-full flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] overflow-hidden">
        {comboPanel}
      </div>

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl animate-slide-up ${toast.type === 'error' ? 'bg-[var(--color-accent-rose)] text-white' : 'bg-[var(--color-accent-teal)] text-white'
          }`}>
          {toast.msg}
        </div>
      )}
      {showLoginOptions && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="glass-panel max-w-sm p-6 text-center">
            <h2 className="text-lg font-bold mb-2">Sign in to publish</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">Your current combo will be kept in the full link while you sign in.</p>
            <div className="flex gap-3 justify-center"><button onClick={() => void beginLogin('google')} className="px-4 py-2 rounded bg-[var(--color-gold-500)] text-[var(--color-bg-primary)] font-semibold">Google</button><button onClick={() => void beginLogin('discord')} className="px-4 py-2 rounded border border-[var(--color-border)]">Discord</button></div>
            <button onClick={() => setShowLoginOptions(false)} className="mt-4 text-sm text-[var(--color-text-secondary)]">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

function CardStatsPanel({
  game,
  selectedCard,
  onClearCard,
}: {
  game: GameContextValue
  selectedCard?: CardData | null
  onClearCard: () => void
}) {
  const handleReturnAllToDecks = () => {
    game.returnAllToDecks()
    trackEvent('simulator_action', { action: 'return_all_to_decks' })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-col gap-2.5">
        <div className="flex items-center justify-between bg-[var(--color-bg-primary)] p-2 rounded-lg border border-[var(--color-border)] shadow-inner">
          <span className="text-xs font-bold text-[var(--color-gold-400)] uppercase tracking-wider">Life Points</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => game.setLP(Math.max(0, game.board.lp - 500))}
              className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)] hover:bg-red-950 text-red-400 border border-red-800/40 text-xs font-bold transition-colors flex items-center justify-center"
              title="-500 LP"
            >
              -
            </button>
            <span className="text-sm font-mono font-extrabold text-yellow-400 px-1 min-w-[50px] text-center">
              {game.board.lp}
            </span>
            <button
              onClick={() => game.setLP(game.board.lp + 500)}
              className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)] hover:bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-xs font-bold transition-colors flex items-center justify-center"
              title="+500 LP"
            >
              +
            </button>
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1 text-center py-1.5 bg-[var(--color-bg-primary)]/60 rounded-lg border border-[var(--color-border)]/50 text-[10px]">
          <div>
            <div className="text-[var(--color-text-muted)] font-medium">Deck</div>
            <div className="font-bold text-[var(--color-text-primary)] text-xs">{game.board.deck.length}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)] font-medium">Extra</div>
            <div className="font-bold text-[var(--color-accent-purple)] text-xs">{game.board.extra.length}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)] font-medium">GY</div>
            <div className="font-bold text-[var(--color-accent-rose)] text-xs">{game.board.gy.length}</div>
          </div>
          <div>
            <div className="text-[var(--color-text-muted)] font-medium">Banish</div>
            <div className="font-bold text-[var(--color-accent-blue)] text-xs">{game.board.banish.length}</div>
          </div>
        </div>

        <button
          onClick={handleReturnAllToDecks}
          className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow active:scale-95 flex items-center justify-center gap-1.5"
        >
          📥 Return All to Decks
        </button>
      </div>

      <div className="flex-1 overflow-y-auto relative">
        <CardDetailPanel card={selectedCard} onClose={selectedCard ? onClearCard : undefined} />
      </div>
    </div>
  )
}

function ComboRecorderPanel({
  game,
  onShare,
  onPublish,
  onlineSharing,
}: {
  game: GameContextValue
  onShare: () => void
  onPublish: () => void
  onlineSharing: boolean
}) {
  const handleStartRecording = () => {
    game.startRecording()
    trackEvent('combo_record_started')
  }

  const handleStopRecording = () => {
    game.stopRecording()
    trackEvent('combo_record_stopped', { step_count: game.combo.length })
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)]">COMBO RECORDER</span>
          {game.recording && (
            <span className="flex items-center gap-1.5 text-[10px] text-[var(--color-accent-rose)] font-bold animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-rose)]" />
              REC
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {!game.recording ? (
            <button
              onClick={handleStartRecording}
              className="flex-1 py-1.5 rounded bg-[var(--color-accent-rose)] text-white font-semibold text-xs transition-colors hover:bg-[var(--color-accent-rose)]/80"
            >
              🔴 Record
            </button>
          ) : (
            <button
              onClick={handleStopRecording}
              className="flex-1 py-1.5 rounded bg-[var(--color-text-secondary)] text-[var(--color-bg-primary)] font-semibold text-xs transition-colors hover:bg-[var(--color-text-primary)]"
            >
              ⏹ Stop
            </button>
          )}

          <button
            onClick={onShare}
            disabled={game.combo.length === 0}
            className="py-1.5 px-3 rounded bg-[var(--color-gold-500)] text-[var(--color-bg-primary)] font-semibold text-xs transition-colors hover:bg-[var(--color-gold-400)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Full link
          </button>
          {onlineSharing && <button
            onClick={onPublish}
            disabled={game.combo.length === 0}
            className="py-1.5 px-3 rounded border border-[var(--color-gold-500)] text-[var(--color-gold-400)] font-semibold text-xs transition-colors hover:bg-[var(--color-gold-500)]/10 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Publish
          </button>}
        </div>

        <div className="flex items-center justify-between gap-1 mt-1">
          <button
            onClick={() => game.jumpToStep(-1)}
            disabled={game.playbackIndex === -1}
            className="flex-1 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[10px] font-medium disabled:opacity-30 transition-colors"
          >
            ⏮ Start
          </button>
          <button
            onClick={() => game.jumpToStep(game.playbackIndex - 1)}
            disabled={game.playbackIndex <= -1}
            className="flex-1 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[10px] font-medium disabled:opacity-30 transition-colors"
          >
            ◀ Prev
          </button>
          <button
            onClick={() => game.jumpToStep(game.playbackIndex + 1)}
            disabled={game.playbackIndex >= game.maxPlaybackIndex}
            className="flex-1 py-1 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] text-[10px] font-medium disabled:opacity-30 transition-colors"
          >
            Next ▶
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ComboStepList
          combo={game.combo}
          currentIndex={game.playbackIndex}
          onJumpTo={game.jumpToStep}
          onResetRecord={game.resetCombo}
        />
      </div>
    </div>
  )
}
