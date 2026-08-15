import { useState, useEffect, useRef, useCallback } from 'react'
import type { CardInstance, CardData, GameContextValue } from '../types'
import { useGame, ARRAY_ZONES, createEmptyBoard, makeInstance } from '../context/GameContext'
import { useDeck } from '../context/DeckContext'
import { readStateFromUrl, pushStateToUrl, generateShareUrl } from '../services/urlState'
import { fetchAndCacheCards } from '../services/cardCache'
import { readYDKFile } from '../utils/ydkParser'
import DuelBoard from '../components/DuelBoard'
import CardDetailPanel from '../components/CardDetailPanel'
import ComboStepList from '../components/ComboStepList'
import type { BoardState } from '../types'
import type { TokenInitInfo } from '../services/urlState'
import { useMediaQuery } from '../hooks/useMediaQuery'

function isTokenCard(c: CardInstance): boolean {
  return c.cardId === 99999999 || c.data?.type === 'Token'
}

function extractInitialStateInfo(board?: BoardState): {
  init?: Record<string, number[]>
  tokens?: TokenInitInfo[]
} {
  if (!board) return {}
  const init: Record<string, number[]> = {}
  const tokens: TokenInitInfo[] = []
  let hasNonDefaultPlacement = false

  const ALL_CHECK_ZONES = [
    'hand', 'gy', 'egy', 'banish', 'ebanish', 'free', 'efree',
    'm1', 'm2', 'm3', 'em1', 'em2', 'em3',
    'st1', 'st2', 'st3', 'est1', 'est2', 'est3',
    'field', 'efield'
  ]

  ALL_CHECK_ZONES.forEach(z => {
    const val = board[z as keyof BoardState]
    if (Array.isArray(val)) {
      val.forEach((c: CardInstance) => {
        if (isTokenCard(c)) {
          tokens.push({ z, i: c.id, p: c.position || undefined })
        } else {
          if (!init[z]) init[z] = []
          init[z].push(c.id)
          hasNonDefaultPlacement = true
        }
      })
    } else if (val && typeof val === 'object' && 'id' in val) {
      const c = val as CardInstance
      if (isTokenCard(c)) {
        tokens.push({ z, i: c.id, p: c.position || undefined })
      } else {
        if (!init[z]) init[z] = []
        init[z].push(c.id)
        hasNonDefaultPlacement = true
      }
    }
  })

  return {
    init: hasNonDefaultPlacement ? init : undefined,
    tokens: tokens.length > 0 ? tokens : undefined,
  }
}

export default function SimulatorPage() {
  const game = useGame()
  const deck = useDeck()
  const [selectedCard, setSelectedCard] = useState<CardData | undefined | null>(undefined)
  const isMobile = useMediaQuery('(max-width: 767px)')
  const userToggledPanelsRef = useRef(false)
  const [panelsCollapsed, setPanelsCollapsed] = useState(isMobile)
  const [openDrawer, setOpenDrawer] = useState<'card' | 'combo' | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [toast, setToast] = useState<{ msg: string, type: string } | null>(null)
  const [deckName, setDeckName] = useState('')
  const [mainDeck, setMainDeck] = useState<number[]>([])
  const [extraDeck, setExtraDeck] = useState<number[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Snapshot deck at mount time so the load effect runs only once
  const deckSnapshotRef = useRef({ mainDeck: deck.mainDeck, extraDeck: deck.extraDeck, deckName: deck.deckName })

  const showToast = useCallback((msg: string, type: string = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }, [])

  useEffect(() => {
    if (!userToggledPanelsRef.current) {
      setPanelsCollapsed(isMobile)
    }
  }, [isMobile])

  const togglePanels = useCallback(() => {
    userToggledPanelsRef.current = true
    setOpenDrawer(null)
    setPanelsCollapsed((prev) => !prev)
  }, [])

  const handleSelectCard = useCallback((card?: CardData) => {
    setSelectedCard(card)
    if (panelsCollapsed && card) setOpenDrawer('card')
  }, [panelsCollapsed])

  // Parse state from URL hash on load
  useEffect(() => {
    async function loadInitial() {
      try {
        setLoading(true)
        const hash = window.location.hash
        if (hash && hash.length > 5) {
          const state = readStateFromUrl()
          console.log("Loaded state from URL:", state)
          if (state) {
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
            const initialBoard = createEmptyBoard()
            const totalSize = (state.main || []).length + (state.extra || []).length
            initialBoard.deck = (state.main || []).map(cid => makeInstance(cid, map[cid]))
            initialBoard.extra = (state.extra || []).map(cid => makeInstance(cid, map[cid]))
            initialBoard.lp = 4000
            // Decrease the id of each instance by totalSize to match initBoard
            initialBoard.deck.forEach((c) => {
              c.id -= totalSize
            })
            initialBoard.extra.forEach((c) => {
              c.id -= totalSize
            })

            // Relocate cards to their initial zones if state.init is specified
            if (state.init) {
              Object.entries(state.init).forEach(([zone, instanceIds]) => {
                instanceIds.forEach(instId => {
                  let sourceArr = initialBoard.deck
                  let cardIdx = sourceArr.findIndex(c => c.id === instId)
                  if (cardIdx === -1) {
                    sourceArr = initialBoard.extra
                    cardIdx = sourceArr.findIndex(c => c.id === instId)
                  }

                  if (cardIdx !== -1) {
                    const [card] = sourceArr.splice(cardIdx, 1)
                    if ((ARRAY_ZONES as readonly string[]).includes(zone)) {
                      (initialBoard[zone as keyof BoardState] as CardInstance[]).push(card)
                    } else {
                      (initialBoard as Record<string, any>)[zone] = card
                    }
                  }
                })
              })
            }

            // Re-instantiate initial tokens if state.tokens is specified
            if (state.tokens) {
              state.tokens.forEach(t => {
                const tokenCard: CardInstance = {
                  id: t.i,
                  cardId: 99999999,
                  position: t.p || 'face_up_atk',
                  data: {
                    id: 99999999,
                    name: 'Monster Token',
                    type: 'Token',
                    humanType: 'Token Monster',
                    frameType: 'token',
                    desc: 'Monster Token',
                  }
                }
                if ((ARRAY_ZONES as readonly string[]).includes(t.z)) {
                  (initialBoard[t.z as keyof BoardState] as CardInstance[]).push(tokenCard)
                } else {
                  (initialBoard as Record<string, any>)[t.z] = tokenCard
                }
              })
            }
            console.log("Initial board reconstructed:", initialBoard)

            // Reconstruct history if combo steps are present
            if (state.combo && state.combo.length > 0) {
              const fullHistory = [JSON.parse(JSON.stringify(initialBoard))]
              let currentBoard = JSON.parse(JSON.stringify(initialBoard))

              state.combo.forEach(step => {
                const next = JSON.parse(JSON.stringify(currentBoard))
                const action = step.a
                const fromZone = step.from || step.f
                const toZone = step.to
                const instanceId = step.instanceId || step.i
                const position = (step.position || step.p) as string | undefined
                const val = step.val !== undefined ? (step.val as number) : (step.v as number | undefined)
                const targetZone = step.to || (step.z as string | undefined) || (step.zone as string | undefined) || (step.f as string | undefined) || (step.from as string | undefined)

                if (action === 'move' && instanceId && fromZone && toZone) {
                  let card: CardInstance | null = null
                  if ((ARRAY_ZONES as readonly string[]).includes(fromZone)) {
                    const idx = (next[fromZone as keyof BoardState] as CardInstance[]).findIndex(c => c.id === instanceId)
                    if (idx !== -1) {
                      card = (next[fromZone as keyof BoardState] as CardInstance[])[idx]
                      ;(next[fromZone as keyof BoardState] as CardInstance[]).splice(idx, 1)
                    } else {
                      console.warn(`Card with instanceId ${instanceId} not found in zone ${fromZone}`)
                    }
                  } else {
                    card = next[fromZone as keyof BoardState] as CardInstance | null
                    if (card && card.id === instanceId) {
                      ;(next as Record<string, any>)[fromZone] = null
                    }
                  }
                  if (card) {
                    if (position) card.position = position
                    if ((ARRAY_ZONES as readonly string[]).includes(toZone)) {
                      ;(next[toZone as keyof BoardState] as CardInstance[]).push(card)
                    } else {
                      ;(next as Record<string, any>)[toZone] = card
                    }
                  }
                } else if (action === 'draw') {
                  const count = (step.n as number) || (val as number) || 1
                  const n = Math.min(count, next.deck.length)
                  if (n > 0) {
                    const drawn = next.deck.slice(0, n)
                    next.deck = next.deck.slice(n)
                    next.hand = [...next.hand, ...drawn]
                  }
                } else if (action === 'shuffle') {
                  const a = [...next.deck]
                  for (let i = a.length - 1; i > 0; i -= 1) {
                    const j = Math.floor(Math.random() * (i + 1))
                    ;[a[i], a[j]] = [a[j], a[i]]
                  }
                  next.deck = a
                } else if (action === 'sort') {
                  next.deck.sort((a: CardInstance, b: CardInstance) => {
                    const cardA = map[a.cardId]
                    const cardB = map[b.cardId]
                    if (!cardA || !cardB) return 0
                    return cardA.name.localeCompare(cardB.name)
                  })
                } else if (action === 'reset_board') {
                  const main: CardInstance[] = []
                  const extra: CardInstance[] = []
                  ARRAY_ZONES.forEach(z => {
                    (next[z as keyof BoardState] as CardInstance[]).forEach(c => {
                      if (c.cardId === 99999999) return
                      if (c.data?.type?.includes('Fusion') || c.data?.type?.includes('Synchro') || c.data?.type?.includes('XYZ') || c.data?.type?.includes('Link')) {
                        extra.push(c)
                      } else {
                        main.push(c)
                      }
                    })
                    ;(next as Record<string, any>)[z] = []
                  })
                  next.deck = main
                  next.extra = extra
                } else if (action === 'pos' && targetZone && position) {
                  if ((ARRAY_ZONES as readonly string[]).includes(targetZone)) {
                    const arr = next[targetZone as keyof BoardState] as CardInstance[]
                    if (Array.isArray(arr)) {
                      const card = instanceId ? arr.find(c => c.id === instanceId) : arr[arr.length - 1]
                      if (card) card.position = position
                    }
                  } else {
                    const card = next[targetZone as keyof BoardState] as CardInstance | null
                    if (card && typeof card === 'object' && 'position' in card) {
                      card.position = position
                    }
                  }
                } else if (action === 'lp' && val !== undefined) {
                  next.lp = val
                } else if (action === 'token') {
                  const tokenInstance = {
                    id: instanceId || (Date.now() + Math.random()),
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
                  if (ARRAY_ZONES.includes((targetZone || 'hand') as any)) {
                    (next[(targetZone || 'hand') as keyof BoardState] as CardInstance[]).push(tokenInstance)
                  } else {
                    (next as Record<string, any>)[targetZone || 'hand'] = tokenInstance
                  }
                } else if (action === 'removetoken') {
                  if (targetZone && ARRAY_ZONES.includes(targetZone as any)) {
                    const arr = next[targetZone as keyof BoardState] as CardInstance[]
                    if (Array.isArray(arr)) {
                      let idx = instanceId ? arr.findIndex((c: CardInstance) => c.id === instanceId) : -1
                      if (idx === -1) {
                        idx = arr.findIndex((c: CardInstance) => isTokenCard(c))
                      }
                      if (idx !== -1) {
                        arr.splice(idx, 1)
                      }
                    }
                  } else if (targetZone) {
                    const current = next[targetZone as keyof BoardState] as CardInstance | null
                    if (current && (current.id === instanceId || isTokenCard(current))) {
                      (next as Record<string, any>)[targetZone] = null
                    }
                  }
                } else if (action === 'phase') {
                  if (step.phase) next.phase = step.phase as BoardState['phase']
                  if (step.turn) next.turn = step.turn as BoardState['turn']
                }
                fullHistory.push(next)
                currentBoard = next
              })

              game.loadState(state.combo, fullHistory)
              console.log("fullHistory", fullHistory)
            }

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
  }, []) // intentionally run only once on mount

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

  // Share URL state
  const handleShare = useCallback(() => {
    const mainIds: number[] = []
    const extraIds: number[] = []

    const collectIds = (zone: string) => {
      const item = game.board[zone] as CardInstance[] | CardInstance | null | undefined | number
      if (item) {
        if (Array.isArray(item)) {
          item.forEach(c => {
            if (zone === 'extra') extraIds.push(c.cardId)
            else mainIds.push(c.cardId)
          })
        } else if (typeof item === 'object' && 'cardId' in item) {
          mainIds.push(item.cardId)
        }
        else {
          console.warn(`Unexpected item type in zone ${zone}:`, item)
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

    const { init, tokens } = extractInitialStateInfo(game.history[0])
    const state = {
      main: game.initialMainIds.current,
      extra: game.initialExtraIds.current,
      combo: game.combo,
      name: deckName || 'combo-deck',
      init,
      tokens,
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
    <ComboRecorderPanel game={game} onShare={handleShare} />
  )

  return (
    <div className={`flex h-[calc(100dvh-56px)] ${panelsCollapsed ? 'overflow-hidden' : 'overflow-x-auto overflow-y-hidden'}`}>
      {!panelsCollapsed && (
        <div className="w-80 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] overflow-hidden">
          {cardPanel}
        </div>
      )}

      <div className={`flex-1 min-w-0 bg-[var(--color-bg-primary)] relative overflow-hidden flex flex-col ${!panelsCollapsed ? 'min-w-[640px] border-r border-[var(--color-border)]' : ''}`}>
        <div className="flex-shrink-0 flex items-center gap-1.5 px-2 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/80">
          {panelsCollapsed && (
            <>
              <span className="text-[10px] font-bold text-[var(--color-gold-400)] uppercase tracking-wider">LP</span>
              <span className="text-sm font-mono font-extrabold text-yellow-400 min-w-[42px]">{game.board.lp}</span>
              {game.recording && (
                <span className="flex items-center gap-1 text-[10px] text-[var(--color-accent-rose)] font-bold animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent-rose)]" />
                  REC
                </span>
              )}
              <button
                type="button"
                onClick={() => setOpenDrawer((d) => d === 'card' ? null : 'card')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${openDrawer === 'card'
                  ? 'bg-[var(--color-gold-500)]/20 text-[var(--color-gold-400)] border-[var(--color-gold-500)]/40'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Card
              </button>
              <button
                type="button"
                onClick={() => setOpenDrawer((d) => d === 'combo' ? null : 'combo')}
                className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition-colors ${openDrawer === 'combo'
                  ? 'bg-[var(--color-gold-500)]/20 text-[var(--color-gold-400)] border-[var(--color-gold-500)]/40'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border-[var(--color-border)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                Combo
              </button>
            </>
          )}
          <button
            type="button"
            onClick={togglePanels}
            className="ml-auto px-2.5 py-1 rounded text-[11px] font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:text-[var(--color-text-primary)]"
          >
            {panelsCollapsed ? 'Expand panels' : 'Collapse panels'}
          </button>
        </div>
        <div className="flex-1 min-h-0">
          <DuelBoard
            onSelectCard={handleSelectCard}
            onHoverCard={panelsCollapsed ? undefined : setSelectedCard}
          />
        </div>
      </div>

      {!panelsCollapsed && (
        <div className="w-80 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] overflow-hidden">
          {comboPanel}
        </div>
      )}

      {panelsCollapsed && openDrawer && (
        <div className="fixed inset-0 z-40">
          <button
            type="button"
            aria-label="Close drawer"
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpenDrawer(null)}
          />
          <div className="absolute inset-x-0 bottom-0 h-[85dvh] flex flex-col bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] rounded-t-xl shadow-2xl animate-slide-up overflow-hidden">
            <div className="flex-shrink-0 flex items-center justify-between px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
              <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
                {openDrawer === 'card' ? 'Card details' : 'Combo recorder'}
              </span>
              <button
                type="button"
                onClick={() => setOpenDrawer(null)}
                className="px-2.5 py-1 rounded text-[11px] font-semibold bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
              >
                Close
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
              {openDrawer === 'card' ? cardPanel : comboPanel}
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl animate-slide-up ${toast.type === 'error' ? 'bg-[var(--color-accent-rose)] text-white' : 'bg-[var(--color-accent-teal)] text-white'
          }`}>
          {toast.msg}
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
          onClick={game.returnAllToDecks}
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
}: {
  game: GameContextValue
  onShare: () => void
}) {
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
            onClick={onShare}
            disabled={game.combo.length === 0}
            className="py-1.5 px-3 rounded bg-[var(--color-gold-500)] text-[var(--color-bg-primary)] font-semibold text-xs transition-colors hover:bg-[var(--color-gold-400)] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            🔗 Share
          </button>
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
