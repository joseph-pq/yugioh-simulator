import { useState, useCallback, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useCacheContext } from '../context/CacheContext'
import { useDeck } from '../context/DeckContext'
import { searchCards as apiSearchCards, normalizeCard } from '../services/ygoproApi'
import { readYDKFile, exportYDK } from '../utils/ydkParser'
import type { CardData } from '../types'
import CardDetailPanel from '../components/CardDetailPanel'
import CardThumbnail from '../components/CardThumbnail'

export default function DeckBuilderPage() {
  const { getCards, fetchAndCacheCards } = useCacheContext()
  const deck = useDeck()
  const [selectedCard, setSelectedCard] = useState<CardData | null>(null)
  const [mainCards, setMainCards] = useState<CardData[]>([])
  const [extraCards, setExtraCards] = useState<CardData[]>([])
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Search state
  const [query, setQuery] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'monster' | 'spell' | 'trap' | 'extra'>('all')
  const [duelLinksOnly, setDuelLinksOnly] = useState(true)
  const [searchResults, setSearchResults] = useState<CardData[]>([])
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showToast = useCallback((msg: string, type: string = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }, [])

  // Execute search against API
  const performSearch = useCallback(async (
    searchQuery: string,
    typeFilter: string,
    dlOnly: boolean,
  ) => {
    if (!searchQuery.trim()) {
      setSearchResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      let apiType: string | undefined = undefined
      if (typeFilter === 'monster') apiType = 'Main Deck Monster'
      else if (typeFilter === 'spell') apiType = 'Spell Card'
      else if (typeFilter === 'trap') apiType = 'Trap Card'
      else if (typeFilter === 'extra') apiType = 'Fusion Monster,Synchro Monster,XYZ Monster,Link Monster'

      const res = await apiSearchCards({
        fname: searchQuery.trim(),
        type: apiType,
        format: dlOnly ? 'duel links' : undefined,
        num: 50,
      })

      const cards = (res.data || []).map(c => normalizeCard(c)).filter((c): c is CardData => c !== null)
      setSearchResults(cards)
      // Cache searched cards in IndexedDB
      if (cards.length > 0) {
        fetchAndCacheCards(cards.map(c => c.id)).catch(() => {})
      }
    } catch (err) {
      console.error('Search error:', err)
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }, [fetchAndCacheCards])

  const handleQueryChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performSearch(val, filterType, duelLinksOnly)
    }, 300)
  }

  const handleFilterChange = (type: 'all' | 'monster' | 'spell' | 'trap' | 'extra') => {
    setFilterType(type)
    performSearch(query, type, duelLinksOnly)
  }

  const handleToggleDuelLinks = () => {
    const next = !duelLinksOnly
    setDuelLinksOnly(next)
    if (query.trim()) performSearch(query, filterType, next)
  }

  const handleAddCard = useCallback((card: CardData) => {
    const ok = deck.addCard(card)
    if (!ok) {
      const currentCount = deck.getCardCount(card.id)
      if (currentCount >= 3) {
        showToast(`Cannot add ${card.name} — maximum 3 copies reached`, 'error')
      } else {
        showToast('Cannot add — deck capacity full (30 Main / 9 Extra)', 'error')
      }
    } else {
      showToast(`Added ${card.name} to deck`, 'success')
    }
  }, [deck, showToast])

  // Resolve card data for main and extra deck display
  useEffect(() => {
    if (deck.mainDeck.length > 0) {
      getCards(deck.mainDeck).then(setMainCards)
    } else {
      setMainCards([])
    }
  }, [deck.mainDeck, getCards])

  useEffect(() => {
    if (deck.extraDeck.length > 0) {
      getCards(deck.extraDeck).then(setExtraCards)
    } else {
      setExtraCards([])
    }
  }, [deck.extraDeck, getCards])

  // YDK file import
  const handleFileImport = useCallback(async (file: File) => {
    try {
      setImporting(true)
      const parsed = await readYDKFile(file)
      const allIds = [...parsed.main, ...(parsed.extra || [])]
      await fetchAndCacheCards(allIds)
      deck.importDeck(parsed)
      showToast(`Imported ${parsed.main.length} main + ${(parsed.extra || []).length} extra deck cards`, 'success')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      showToast(`Import failed: ${message}`, 'error')
    } finally {
      setImporting(false)
    }
  }, [deck, fetchAndCacheCards, showToast])

  // Drag-and-drop file support
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file && (file.name.endsWith('.ydk') || file.type === 'text/plain')) {
      handleFileImport(file)
    }
  }, [handleFileImport])

  // YDK export
  const handleExport = useCallback(() => {
    const content = exportYDK({ main: deck.mainDeck, extra: deck.extraDeck })
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${deck.deckName || 'deck'}.ydk`
    a.click()
    URL.revokeObjectURL(url)
  }, [deck])

  const handleSort = useCallback(async () => {
    if (deck.mainDeck.length === 0 && deck.extraDeck.length === 0) return
    await deck.sortDeck()
    showToast('Sorted deck cards', 'success')
  }, [deck, showToast])

  const countInDeck = (cardId: number) => deck.getCardCount(cardId)

  return (
    <div className="flex h-[calc(100dvh-56px)] overflow-hidden">
      {/* Left Panel: Card Search & Catalog */}
      <div className="w-80 flex-shrink-0 flex flex-col bg-[var(--color-bg-secondary)] border-r border-[var(--color-border)] overflow-hidden">
        <div className="p-3 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
              Card Library Search
            </span>
            <button
              onClick={handleToggleDuelLinks}
              title={duelLinksOnly ? 'Showing Duel Links cards only — click to search all TCG/OCG cards' : 'Showing all cards — click to limit to Duel Links'}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition-colors border ${
                duelLinksOnly
                  ? 'bg-[var(--color-accent-teal)]/15 text-[var(--color-accent-teal)] border-[var(--color-accent-teal)]/40'
                  : 'bg-[var(--color-bg-primary)] text-[var(--color-text-muted)] border-[var(--color-border)] hover:border-[var(--color-gold-500)]'
              }`}
            >
              <span>{duelLinksOnly ? '🔒' : '🌐'}</span>
              <span>{duelLinksOnly ? 'DL Only' : 'All Cards'}</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder={duelLinksOnly ? 'Search Duel Links cards...' : 'Search all Yu-Gi-Oh! cards...'}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-gold-400)] transition-colors"
            />
            <span className="absolute left-2.5 top-1.5 text-xs text-[var(--color-text-muted)]">🔍</span>
            {query && (
              <button
                onClick={() => handleQueryChange('')}
                className="absolute right-2 top-1.5 text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
              >
                ✕
              </button>
            )}
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5 text-[10px]">
            {[
              { id: 'all', label: 'All' },
              { id: 'monster', label: 'Monsters' },
              { id: 'spell', label: 'Spells' },
              { id: 'trap', label: 'Traps' },
              { id: 'extra', label: 'Extra' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => handleFilterChange(tab.id as any)}
                className={`px-2 py-0.5 rounded font-medium transition-colors ${
                  filterType === tab.id
                    ? 'bg-[var(--color-gold-500)] text-black font-bold'
                    : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search Results Catalog */}
        <div className="flex-1 overflow-y-auto p-3">
          {searching ? (
            <div className="flex items-center justify-center h-32 text-xs text-[var(--color-text-muted)]">
              ⏳ Searching cards...
            </div>
          ) : !query.trim() ? (
            <div className="flex flex-col items-center justify-center h-48 text-center text-xs text-[var(--color-text-muted)] p-4">
              <span className="text-2xl mb-2">🃏</span>
              <p>Type a card name above to search and add cards to your deck</p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-center text-xs text-[var(--color-text-muted)]">
              No cards found matching "{query}"
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {searchResults.map(card => {
                const count = countInDeck(card.id)
                return (
                  <div key={card.id} className="relative group">
                    <CardThumbnail
                      card={card}
                      onClick={setSelectedCard}
                      selected={selectedCard?.id === card.id}
                      count={count}
                    />
                    {/* Add button overlay on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleAddCard(card)
                      }}
                      className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center rounded text-white font-bold text-xs gap-1 backdrop-blur-[1px]"
                      title="Add to Deck"
                    >
                      <span className="w-6 h-6 rounded-full bg-[var(--color-gold-500)] text-black flex items-center justify-center text-sm font-black shadow">
                        +
                      </span>
                      <span className="text-[9px] font-semibold text-[var(--color-gold-300)]">
                        {count}/3 in deck
                      </span>
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Center Panel: Deck Workspace */}
      <div
        className="flex-1 flex flex-col overflow-hidden bg-[var(--color-bg-primary)]"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Deck Header */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={deck.deckName}
              onChange={(e) => deck.setDeckName(e.target.value)}
              placeholder="My Deck Name"
              className="bg-transparent text-lg font-semibold text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none border-b border-transparent focus:border-[var(--color-gold-500)] transition-colors"
            />
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${deck.validation.valid ? 'bg-[var(--color-accent-teal)]/15 text-[var(--color-accent-teal)]' : 'bg-[var(--color-accent-rose)]/15 text-[var(--color-accent-rose)]'}`}>
              {deck.mainDeck.length}/20-30 Main • {deck.extraDeck.length}/9 Extra
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] text-[var(--color-bg-primary)] hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] transition-all active:scale-95 disabled:opacity-50"
            >
              {importing ? 'Importing...' : '📥 Import YDK'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".ydk,.txt"
              className="hidden"
              onChange={(e) => {
                const file = e.currentTarget.files?.[0]
                if (file) handleFileImport(file)
                e.currentTarget.value = ''
              }}
            />
            <button
              onClick={handleExport}
              disabled={deck.mainDeck.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              💾 Export
            </button>
            <button
              onClick={handleSort}
              disabled={deck.mainDeck.length === 0 && deck.extraDeck.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
              title="Sort cards in Main and Extra Deck by Category, Level, and Name"
            >
              📶 Sort
            </button>
            <button
              onClick={deck.clearDeck}
              disabled={deck.mainDeck.length === 0 && deck.extraDeck.length === 0}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--color-accent-rose)] hover:bg-[var(--color-accent-rose)]/10 border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              🗑️ Clear
            </button>
            <Link
              to="/sim"
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all active:scale-95 ${
                deck.validation.valid && deck.mainDeck.length > 0
                  ? 'bg-[var(--color-accent-teal)] text-white hover:bg-[var(--color-accent-teal)]/80 shadow'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-muted)] border border-[var(--color-border)] pointer-events-none opacity-40'
              }`}
              title={deck.validation.valid ? 'Open simulator with this deck' : 'Deck is not valid yet'}
            >
              ▶ Simulate
            </Link>
          </div>
        </div>

        {/* Validation Error Warnings */}
        {deck.validation.errors.length > 0 && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[var(--color-accent-rose)]/10 border border-[var(--color-accent-rose)]/30 flex flex-col gap-1">
            {deck.validation.errors.map((e, i) => (
              <p key={i} className="text-xs text-[var(--color-accent-rose)] font-medium flex items-center gap-1.5">
                <span>⚠️</span> {e}
              </p>
            ))}
          </div>
        )}

        {/* Deck Content Workspace */}
        <div className="flex-1 overflow-y-auto p-4">
          {deck.mainDeck.length === 0 && deck.extraDeck.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center border-2 border-dashed border-[var(--color-border)]/70 rounded-xl p-8 max-w-md mx-auto my-12">
              <h3 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
                Your Deck is Empty
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mb-6 leading-relaxed">
                Use the search panel on the left to search and add cards, or import a .ydk file from Duel Links Meta.
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] text-[var(--color-bg-primary)] font-semibold text-sm hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] transition-all active:scale-95 disabled:opacity-50 shadow"
              >
                {importing ? 'Importing...' : 'Import YDK File'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Deck Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                      Main Deck <span className="text-[var(--color-gold-400)] font-mono">({deck.mainDeck.length}/30)</span>
                    </h3>
                    <button
                      onClick={handleSort}
                      disabled={deck.mainDeck.length === 0 && deck.extraDeck.length === 0}
                      className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                      title="Sort deck cards"
                    >
                      📶 Sort Deck
                    </button>
                  </div>
                  <span className="text-[10px] text-[var(--color-text-muted)]">
                    Hover card to remove or right-click
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[100px] p-3 bg-[var(--color-bg-secondary)]/50 rounded-xl border border-[var(--color-border)]/50">
                  {deck.mainDeck.map((id, index) => {
                    const card = mainCards.find(c => c.id === id)
                    return card ? (
                      <div key={`main-${index}-${id}`} className="relative group">
                        <CardThumbnail
                          card={card}
                          onClick={setSelectedCard}
                          onContextMenu={() => deck.removeFromMainDeck(index)}
                          selected={selectedCard?.id === card.id}
                        />
                        {/* Remove button badge on hover */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deck.removeFromMainDeck(index)
                            showToast(`Removed ${card.name}`, 'info')
                          }}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-500"
                          title="Remove card"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <div key={`main-${index}`} className="w-[60px] h-[87px] rounded loading-shimmer" />
                    )
                  })}
                </div>
              </div>

              {/* Extra Deck Section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-[var(--color-text-secondary)] uppercase tracking-wider">
                    Extra Deck <span className="text-[var(--color-accent-purple)] font-mono">({deck.extraDeck.length}/9)</span>
                  </h3>
                </div>

                <div className="flex flex-wrap gap-2 min-h-[100px] p-3 bg-[var(--color-bg-secondary)]/50 rounded-xl border border-[var(--color-border)]/50">
                  {deck.extraDeck.length === 0 ? (
                    <div className="w-full py-4 text-center text-xs text-[var(--color-text-muted)]">
                      No Extra Deck cards (Fusion, Synchro, XYZ, Link)
                    </div>
                  ) : (
                    deck.extraDeck.map((id, index) => {
                      const card = extraCards.find(c => c.id === id)
                      return card ? (
                        <div key={`extra-${index}-${id}`} className="relative group">
                          <CardThumbnail
                            card={card}
                            onClick={setSelectedCard}
                            onContextMenu={() => deck.removeFromExtraDeck(index)}
                            selected={selectedCard?.id === card.id}
                          />
                          {/* Remove button badge on hover */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              deck.removeFromExtraDeck(index)
                              showToast(`Removed ${card.name}`, 'info')
                            }}
                            className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-600 text-white font-bold text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-500"
                            title="Remove card"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div key={`extra-${index}`} className="w-[60px] h-[87px] rounded loading-shimmer" />
                      )
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Card Detail Inspector & Add/Remove Action Controls */}
      <div className="w-80 flex-shrink-0 flex flex-col border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] relative overflow-hidden">
        <div className="flex-1 overflow-y-auto">
          <CardDetailPanel
            card={selectedCard}
            onClose={selectedCard ? () => setSelectedCard(null) : undefined}
          />
        </div>

        {/* Action Controls for Selected Card */}
        {selectedCard && (
          <div className="p-3 border-t border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
              <span className="font-semibold">In Deck:</span>
              <span className="font-mono font-bold text-[var(--color-gold-400)]">
                {countInDeck(selectedCard.id)} / 3 copies
              </span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleAddCard(selectedCard)}
                disabled={countInDeck(selectedCard.id) >= 3}
                className="flex-1 py-2 rounded-lg bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] text-[var(--color-bg-primary)] font-bold text-xs transition-all shadow active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                + Add to Deck
              </button>

              {countInDeck(selectedCard.id) > 0 && (
                <button
                  onClick={() => {
                    const mainIdx = deck.mainDeck.lastIndexOf(selectedCard.id)
                    if (mainIdx !== -1) {
                      deck.removeFromMainDeck(mainIdx)
                      showToast(`Removed ${selectedCard.name}`, 'info')
                      return
                    }
                    const extraIdx = deck.extraDeck.lastIndexOf(selectedCard.id)
                    if (extraIdx !== -1) {
                      deck.removeFromExtraDeck(extraIdx)
                      showToast(`Removed ${selectedCard.name}`, 'info')
                    }
                  }}
                  className="py-2 px-3 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs transition-all active:scale-95"
                >
                  - Remove 1
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl animate-slide-up ${
            toast.type === 'error'
              ? 'bg-[var(--color-accent-rose)] text-white'
              : toast.type === 'success'
              ? 'bg-[var(--color-accent-teal)] text-white'
              : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] border border-[var(--color-border)]'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  )
}
