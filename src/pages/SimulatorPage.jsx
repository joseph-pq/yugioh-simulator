import { useState, useEffect, useCallback, useRef } from 'react'
import { useDeck } from '../context/DeckContext'
import { useGame, POSITION } from '../context/GameContext'
import { useCacheContext } from '../context/CacheContext'
import { readStateFromUrl, pushStateToUrl, generateShareUrl } from '../services/urlState'
import { readYDKFile } from '../utils/ydkParser'
import DuelBoard from '../components/DuelBoard'
import ComboStepList from '../components/ComboStepList'
import CardDetailPanel from '../components/CardDetailPanel'

export default function SimulatorPage() {
  const { mainDeck, extraDeck, deckName } = useDeck()
  const { fetchAndCacheCards } = useCacheContext()
  const game = useGame()

  const [loading, setLoading] = useState(true)
  const [selectedCard, setSelectedCard] = useState(null)
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // Load state from URL or fallback to DeckContext
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true)
        const urlState = readStateFromUrl()

        if (urlState && urlState.main.length > 0) {
          // Resolve cards from URL
          const allIds = [...urlState.main, ...urlState.extra]
          const cards = await fetchAndCacheCards(allIds)
          const map = cards.reduce((acc, c) => {
            if (c) acc[c.id] = c
            return acc
          }, {})

          // Initialize board
          game.initBoard(urlState.main, urlState.extra, map)

          // Restore recorded combo if any
          if (urlState.combo && urlState.combo.length > 0) {
            game.setCombo(urlState.combo)

            // Rebuild history states sequentially from the combo actions
            let currentBoard = JSON.parse(JSON.stringify(game.board))
            const newHistory = [JSON.parse(JSON.stringify(currentBoard))]

            // Function to mimic game logic to rebuild state history
            for (const step of urlState.combo) {
              const prev = JSON.parse(JSON.stringify(currentBoard))
              if (step.a === 'draw') {
                const n = Math.min(step.n || 1, prev.deck.length)
                const drawn = prev.deck.slice(0, n)
                prev.deck = prev.deck.slice(n)
                prev.hand = [...prev.hand, ...drawn]
              } else if (step.a === 'shuffle') {
                // shuffle (just mimic shuffle array)
                const a = [...prev.deck]
                for (let i = a.length - 1; i > 0; i--) {
                  const j = Math.floor(Math.random() * (i + 1));
                  [a[i], a[j]] = [a[j], a[i]]
                }
                prev.deck = a
              } else if (step.a === 'move') {
                let card = null
                const fromZone = step.f
                const toZone = step.to
                const instanceId = step.i
                const position = step.p

                if (['hand', 'gy', 'banish', 'extra', 'deck', 'free'].includes(fromZone)) {
                  const arr = prev[fromZone]
                  const idx = arr.findIndex(c => c.id === instanceId)
                  if (idx !== -1) {
                    card = arr[idx]
                    arr.splice(idx, 1)
                  }
                } else {
                  card = prev[fromZone]
                  if (card && card.id === instanceId) prev[fromZone] = null
                  else card = null
                }

                if (card) {
                  if (['hand', 'gy', 'banish', 'extra', 'deck', 'free'].includes(toZone)) {
                    prev[toZone].push(card)
                  } else {
                    if (prev[toZone] !== null) {
                      prev.hand.push(prev[toZone])
                    }
                    prev[toZone] = { ...card, position: position || POSITION.FACE_UP_ATK }
                  }
                }
              } else if (step.a === 'pos') {
                if (prev[step.z]) prev[step.z].position = step.p
              } else if (step.a === 'lp') {
                prev.lp = Math.max(0, step.v)
              } else if (step.a === 'mill') {
                const n = Math.min(step.n || 1, prev.deck.length)
                const milled = prev.deck.slice(0, n)
                prev.deck = prev.deck.slice(n)
                prev.gy = [...prev.gy, ...milled]
              } else if (step.a === 'todeck') {
                let card = null
                const fromZone = step.f
                const instanceId = step.i
                const toTop = step.top

                if (['hand', 'gy', 'banish', 'extra', 'free'].includes(fromZone)) {
                  const arr = prev[fromZone]
                  const idx = arr.findIndex(c => c.id === instanceId)
                  if (idx !== -1) {
                    card = arr[idx]
                    arr.splice(idx, 1)
                  }
                } else {
                  card = prev[fromZone]
                  if (card && card.id === instanceId) prev[fromZone] = null
                }

                if (card) {
                  if (toTop) prev.deck.unshift(card)
                  else prev.deck.push(card)
                }
              }
              currentBoard = prev
              newHistory.push(JSON.parse(JSON.stringify(currentBoard)))
            }

            game.setHistory(newHistory)
            game.setHistoryIndex(newHistory.length - 1)
          }

          showToast('Loaded shared combo state!', 'success')
        } else if (mainDeck.length > 0) {
          // Resolve cards from local deck context
          const allIds = [...mainDeck, ...extraDeck]
          const cards = await fetchAndCacheCards(allIds)
          const map = cards.reduce((acc, c) => {
            if (c) acc[c.id] = c
            return acc
          }, {})

          game.initBoard(mainDeck, extraDeck, map)
        }
      } catch (err) {
        showToast(`Failed to load state: ${err.message}`, 'error')
      } finally {
        setLoading(false)
      }
    }
    loadInitial()
  }, [])

  // YDK file import
  const handleFileImport = useCallback(async (file) => {
    try {
      setImporting(true)
      const parsed = await readYDKFile(file)
      const allIds = [...parsed.main, ...(parsed.extra || [])]

      // Resolve and cache cards
      const cards = await fetchAndCacheCards(allIds)
      const map = cards.reduce((acc, c) => {
        if (c) acc[c.id] = c
        return acc
      }, {})

      game.initBoard(parsed.main, parsed.extra || [], map)
      showToast('Deck imported successfully!', 'success')
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error')
    } finally {
      setImporting(false)
    }
  }, [fetchAndCacheCards, game])

  // Drag-and-drop file support
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.ydk') || file.type === 'text/plain')) {
      handleFileImport(file)
    }
  }, [handleFileImport])

  // Share URL state
  const handleShare = useCallback(() => {
    // Get unique card IDs from current game board setup to construct the deck list
    const mainIds = []
    const extraIds = []

    // Collect all card instances from zones
    const collectIds = (zone) => {
      const item = game.board[zone]
      if (item) {
        if (Array.isArray(item)) {
          item.forEach(c => {
            if (zone === 'extra') extraIds.push(c.cardId)
            else mainIds.push(c.cardId)
          })
        } else {
          mainIds.push(item.cardId)
        }
      }
    }

    // Scan all zones to get current main & extra lists
    collectIds('hand')
    collectIds('gy')
    collectIds('banish')
    collectIds('deck')
    collectIds('extra')
    collectIds('m1'); collectIds('m2'); collectIds('m3')
    collectIds('st1'); collectIds('st2'); collectIds('st3')
    collectIds('field')

    const state = {
      main: mainIds.length > 0 ? mainIds : mainDeck,
      extra: extraIds.length > 0 ? extraIds : extraDeck,
      combo: game.combo,
      name: deckName || 'combo-deck',
    }

    const shareUrl = generateShareUrl(state)
    navigator.clipboard.writeText(shareUrl)
      .then(() => {
        pushStateToUrl(state)
        showToast('Share link copied to clipboard!', 'success')
      })
      .catch(() => showToast('Failed to copy link', 'error'))
  }, [game.board, game.combo, mainDeck, extraDeck, deckName])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[60vh] text-[var(--color-text-muted)]">
        ⏳ Loading simulator state...
      </div>
    )
  }

  // If no deck is loaded anywhere
  const hasDeck = game.board.deck.length > 0 || game.board.hand.length > 0 || game.board.extra.length > 0 || game.board.gy.length > 0 || game.board.banish.length > 0 || game.board.m1 || game.board.m2 || game.board.m3 || game.board.st1 || game.board.st2 || game.board.st3 || game.board.field

  if (!hasDeck) {
    return (
      <div
        className="flex items-center justify-center h-[calc(100dvh-56px)]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="glass-panel p-10 max-w-lg text-center animate-fade-in">
          <div className="text-5xl mb-4">🃏</div>
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
              {importing ? '⏳ Importing...' : '📥 Import YDK File'}
            </button>
            <input ref={fileInputRef} type="file" accept=".ydk,.txt" className="hidden" onChange={(e) => e.target.files[0] && handleFileImport(e.target.files[0])} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] overflow-hidden">
      {/* Left side: Interactive Board */}
      <div className="flex-1 bg-[var(--color-bg-primary)] relative border-r border-[var(--color-border)]">
        <DuelBoard onSelectCard={setSelectedCard} />
      </div>

      {/* Right side panel: Combo Recording & Card Details */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] overflow-hidden">
        {/* Combo panel (Top 50%) */}
        <div className="h-1/2 border-b border-[var(--color-border)] flex flex-col overflow-hidden">
          {/* Recorder Controls */}
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
                  onClick={game.startRecording}
                  className="flex-1 py-1.5 rounded bg-[var(--color-accent-rose)] text-white font-semibold text-xs transition-colors hover:bg-[var(--color-accent-rose)]/80"
                >
                  🔴 Record
                </button>
              ) : (
                <button
                  onClick={game.stopRecording}
                  className="flex-1 py-1.5 rounded bg-[var(--color-text-secondary)] text-[var(--color-bg-primary)] font-semibold text-xs transition-colors hover:bg-[var(--color-text-primary)]"
                >
                  ⏹ Stop
                </button>
              )}

              <button
                onClick={handleShare}
                disabled={game.combo.length === 0}
                className="py-1.5 px-3 rounded bg-[var(--color-gold-500)] text-[var(--color-bg-primary)] font-semibold text-xs transition-colors hover:bg-[var(--color-gold-400)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                🔗 Share
              </button>
            </div>

            {/* Playback navigation */}
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

          {/* Steps List */}
          <div className="flex-1 overflow-hidden">
            <ComboStepList
              combo={game.combo}
              currentIndex={game.playbackIndex}
              onJumpTo={game.jumpToStep}
            />
          </div>
        </div>

        {/* Card Details panel (Bottom 50%) */}
        <div className="h-1/2 overflow-y-auto relative">
          <CardDetailPanel card={selectedCard} onClose={selectedCard ? () => setSelectedCard(null) : undefined} />
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl animate-slide-up ${
          toast.type === 'error' ? 'bg-[var(--color-accent-rose)] text-white' : 'bg-[var(--color-accent-teal)] text-white'
        }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
