import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router'
import { useGame } from '../context/GameContext'
import { readStateFromUrl, pushStateToUrl, generateShareUrl } from '../services/urlState'
import { fetchAndCacheCards } from '../services/cardCache'
import { readYDKFile } from '../utils/ydkParser'
import DuelBoard from '../components/DuelBoard'
import CardDetailPanel from '../components/CardDetailPanel'
import ComboStepList from '../components/ComboStepList'

export default function SimulatorPage() {
  const game = useGame()
  const location = useLocation()
  const [selectedCard, setSelectedCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState(null)
  const [deckName, setDeckName] = useState('')
  const [mainDeck, setMainDeck] = useState([])
  const [extraDeck, setExtraDeck] = useState([])
  const fileInputRef = useRef(null)

  const showToast = useCallback((msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Parse state from URL hash on load
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true)
        const hash = window.location.hash
        if (hash && hash.length > 2) {
          const state = readStateFromUrl()
          if (state) {
            setDeckName(state.name || '')
            setMainDeck(state.main || [])
            setExtraDeck(state.extra || [])

            // Fetch card data for all unique IDs in state
            const allIds = [...(state.main || []), ...(state.extra || [])]
            const cards = await fetchAndCacheCards(allIds)
            const map = {
              99999999: {
                id: 99999999,
                name: 'Monster Token',
                type: 'Token',
                humanType: 'Token Monster',
                frameType: 'token',
                desc: 'Monster Token',
              }
            }
            cards.forEach(c => {
              if (c) {
                map[c.id] = c
                map[String(c.id)] = c
              }
            })

            game.initBoard(state.main || [], state.extra || [], map)

            // Reconstruct history if combo steps are present
            if (state.combo && state.combo.length > 0) {
              const fullHistory = [JSON.parse(JSON.stringify(game.board))]
              let currentBoard = JSON.parse(JSON.stringify(game.board))

              state.combo.forEach(step => {
                const next = JSON.parse(JSON.stringify(currentBoard))
                const action = step.a
                const fromZone = step.from || step.f
                const toZone = step.to || step.t
                const instanceId = step.instanceId || step.i
                const position = step.position || step.p
                const val = step.val !== undefined ? step.val : step.v
                const targetZone = step.to || step.z

                if (action === 'move' && instanceId && fromZone && toZone) {
                  let card = null
                  if (['hand', 'gy', 'banish', 'deck', 'extra', 'free'].includes(fromZone)) {
                    const idx = next[fromZone].findIndex(c => c.id === instanceId)
                    if (idx !== -1) {
                      card = next[fromZone][idx]
                      next[fromZone].splice(idx, 1)
                    }
                  } else {
                    card = next[fromZone]
                    if (card && card.id === instanceId) next[fromZone] = null
                  }

                  if (card) {
                    if (position) card.position = position
                    if (['hand', 'gy', 'banish', 'deck', 'extra', 'free'].includes(toZone)) {
                      next[toZone].push(card)
                    } else {
                      next[toZone] = card
                    }
                  }
                } else if (action === 'pos' && targetZone && position) {
                  if (next[targetZone]) next[targetZone].position = position
                } else if (action === 'lp' && val !== undefined) {
                  next.lp = val
                } else if (action === 'token') {
                  const tokenInstance = {
                    id: Date.now() + Math.random(),
                    cardId: 99999999,
                    position: 'face_up_atk',
                    data: {
                      id: 99999999,
                      name: 'Monster Token',
                      type: 'Token',
                      humanType: 'Token Monster',
                      frameType: 'token',
                      desc: 'Monster Token',
                    }
                  }
                  if (['hand', 'gy', 'banish', 'free', 'deck'].includes(targetZone || 'hand')) {
                    next[targetZone || 'hand'].push(tokenInstance)
                  } else if (next[targetZone] === null) {
                    next[targetZone] = tokenInstance
                  }
                } else if (action === 'removetoken') {
                  if (['hand', 'gy', 'banish', 'free', 'deck'].includes(targetZone)) {
                    next[targetZone] = next[targetZone].filter(c => c.id !== instanceId)
                  } else if (next[targetZone]?.id === instanceId) {
                    next[targetZone] = null
                  }
                }
                fullHistory.push(next)
                currentBoard = next
              })

              game.setCombo(state.combo)
              game.setHistory(fullHistory)
              game.setHistoryIndex(fullHistory.length - 1)
            }

            showToast('Loaded shared combo state!', 'success')
          }
        } else {
          // Default empty board
          game.initBoard(mainDeck, extraDeck, {})
        }
      } catch (err) {
        showToast(`Failed to load state: ${err.message}`, 'error')
        game.initBoard([], [], {})
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
    const mainIds = []
    const extraIds = []

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

    collectIds('hand')
    collectIds('gy')
    collectIds('egy')
    collectIds('ebanish')
    collectIds('banish')
    collectIds('deck')
    collectIds('extra')
    collectIds('eextra')
    collectIds('free')
    collectIds('efree')
    collectIds('m1'); collectIds('m2'); collectIds('m3')
    collectIds('em1'); collectIds('em2'); collectIds('em3')
    collectIds('st1'); collectIds('st2'); collectIds('st3')
    collectIds('est1'); collectIds('est2'); collectIds('est3')
    collectIds('field')
    collectIds('efield')

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
            <input ref={fileInputRef} type="file" accept=".ydk,.txt" className="hidden" onChange={(e) => e.target.files[0] && handleFileImport(e.target.files[0])} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100dvh-56px)] overflow-hidden">
      {/* Left Column: Card Details & Game Stats Panel */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] overflow-hidden">
        {/* LP & Game Stats Column */}
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-col gap-2.5">
          {/* LP Counter Row */}
          <div className="flex items-center justify-between bg-[var(--color-bg-primary)] p-2 rounded-lg border border-[var(--color-border)] shadow-inner">
            <span className="text-xs font-bold text-[var(--color-gold-400)] uppercase tracking-wider">Life Points</span>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => game.setLP(prev => Math.max(0, prev - 500))}
                className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)] hover:bg-red-950 text-red-400 border border-red-800/40 text-xs font-bold transition-colors flex items-center justify-center"
                title="-500 LP"
              >
                -
              </button>
              <span className="text-sm font-mono font-extrabold text-yellow-400 px-1 min-w-[50px] text-center">
                {game.board.lp}
              </span>
              <button
                onClick={() => game.setLP(prev => prev + 500)}
                className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)] hover:bg-emerald-950 text-emerald-400 border border-emerald-800/40 text-xs font-bold transition-colors flex items-center justify-center"
                title="+500 LP"
              >
                +
              </button>
            </div>
          </div>

          {/* Zone Stats Grid Column */}
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

          {/* Token Generation Button */}
          <button
            onClick={() => game.generateToken('hand')}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow active:scale-95 flex items-center justify-center gap-1.5"
          >
            <span>✨</span> Spawn Monster Token
          </button>
          <button
            onClick={game.returnAllToDecks}
            className="w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow active:scale-95 flex items-center justify-center gap-1.5"
          >
            📥 Return All to Decks
          </button>
        </div>

        {/* Card Details Panel */}
        <div className="flex-1 overflow-y-auto relative">
          <CardDetailPanel card={selectedCard} onClose={selectedCard ? () => setSelectedCard(null) : undefined} />
        </div>
      </div>

      {/* Center Column: Interactive Duel Board */}
      <div className="flex-1 bg-[var(--color-bg-primary)] relative overflow-hidden border-r border-[var(--color-border)]">
        <DuelBoard onSelectCard={setSelectedCard} onHoverCard={setSelectedCard} />
      </div>

      {/* Right Column: Combo Recorder & Steps List */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] overflow-hidden">
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
            onResetRecord={game.resetCombo}
          />
        </div>
      </div>

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl animate-slide-up ${toast.type === 'error' ? 'bg-[var(--color-accent-rose)] text-white' : 'bg-[var(--color-accent-teal)] text-white'
          }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
