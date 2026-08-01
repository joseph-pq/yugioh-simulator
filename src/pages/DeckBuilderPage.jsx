import { useState, useCallback, useRef, useEffect } from 'react'
import { useCacheContext } from '../context/CacheContext'
import { useDeck } from '../context/DeckContext'
import { readYDKFile, exportYDK } from '../utils/ydkParser'
import CardDetailPanel from '../components/CardDetailPanel'
import CardThumbnail from '../components/CardThumbnail'

export default function DeckBuilderPage() {
  const { getCards, fetchAndCacheCards } = useCacheContext()
  const deck = useDeck()
  const [selectedCard, setSelectedCard] = useState(null)
  const [mainCards, setMainCards] = useState([])
  const [extraCards, setExtraCards] = useState([])
  const [toast, setToast] = useState(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef(null)

  // ----------- Search state (disabled for now, kept for future use) -----------
  // const [query, setQuery] = useState('')
  // const [results, setResults] = useState([])
  // const [searching, setSearching] = useState(false)
  // const debounceRef = useRef(null)
  //
  // const handleSearch = useCallback((value) => {
  //   setQuery(value)
  //   if (debounceRef.current) clearTimeout(debounceRef.current)
  //   if (!value.trim()) { setResults([]); return }
  //   debounceRef.current = setTimeout(async () => {
  //     setSearching(true)
  //     const res = await searchCards(value.trim(), {}, 60)
  //     setResults(res)
  //     setSearching(false)
  //   }, 250)
  // }, [searchCards])
  //
  // const handleAddCard = useCallback((card) => {
  //   const ok = deck.addCard(card)
  //   if (!ok) {
  //     showToast('Cannot add — deck limit or 3-copy max reached', 'error')
  //   } else {
  //     showToast(`Added ${card.name}`, 'success')
  //   }
  // }, [deck])
  // ---------------------------------------------------------------------------

  // Resolve card data for deck display
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

  // YDK file import — fetches card data from API on-demand
  const handleFileImport = useCallback(async (file) => {
    try {
      setImporting(true)
      const parsed = await readYDKFile(file)

      // Fetch card data from API and cache in IndexedDB
      const allIds = [...parsed.main, ...(parsed.extra || [])]
      await fetchAndCacheCards(allIds)

      // Import the deck
      deck.importDeck(parsed)
      showToast(`Imported ${parsed.main.length} main + ${(parsed.extra || []).length} extra deck cards`, 'success')
    } catch (err) {
      showToast(`Import failed: ${err.message}`, 'error')
    } finally {
      setImporting(false)
    }
  }, [deck, fetchAndCacheCards])

  // Drag-and-drop handler
  const handleDrop = useCallback((e) => {
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

  const showToast = (msg, type) => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <div className="flex h-[calc(100dvh-56px)]">

      {/* Main Panel: Deck */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
      >
        {/* Deck header */}
        <div className="px-4 py-3 border-b border-[var(--color-border)] flex items-center justify-between bg-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={deck.deckName}
              onChange={(e) => deck.setDeckName(e.target.value)}
              placeholder="Deck Name"
              className="bg-transparent text-lg font-semibold text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none border-b border-transparent focus:border-[var(--color-gold-500)] transition-colors"
            />
            <span className={`text-xs px-2 py-0.5 rounded-full ${deck.validation.valid ? 'bg-[var(--color-accent-teal)]/15 text-[var(--color-accent-teal)]' : 'bg-[var(--color-accent-rose)]/15 text-[var(--color-accent-rose)]'}`}>
              {deck.mainDeck.length}/20-30 Main • {deck.extraDeck.length}/9 Extra
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="px-4 py-1.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] text-[var(--color-bg-primary)] hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing ? 'Importing...' : 'Import YDK'}
            </button>
            <input ref={fileInputRef} type="file" accept=".ydk,.txt" className="hidden" onChange={(e) => { if (e.target.files[0]) handleFileImport(e.target.files[0]); e.target.value = '' }} />
            <button onClick={handleExport} disabled={deck.mainDeck.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Export
            </button>
            <button onClick={deck.clearDeck} disabled={deck.mainDeck.length === 0 && deck.extraDeck.length === 0} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-accent-rose)] hover:bg-[var(--color-accent-rose)]/10 border border-[var(--color-border)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
              Clear
            </button>
          </div>
        </div>

        {/* Validation errors */}
        {deck.validation.errors.length > 0 && (
          <div className="mx-4 mt-3 p-2.5 rounded-lg bg-[var(--color-accent-rose)]/10 border border-[var(--color-accent-rose)]/30">
            {deck.validation.errors.map((e, i) => (
              <p key={i} className="text-xs text-[var(--color-accent-rose)]">⚠ {e}</p>
            ))}
          </div>
        )}

        {/* Deck content */}
        <div className="flex-1 overflow-y-auto p-4">
          {deck.mainDeck.length === 0 && deck.extraDeck.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center border-2 border-dashed border-[var(--color-border)] rounded-xl p-8">
              <h3 className="text-lg font-semibold text-[var(--color-text-secondary)] mb-1">No cards yet</h3>
              <p className="text-sm text-[var(--color-text-muted)] max-w-xs mb-4">
                Import a .ydk file to load your deck, or drag & drop it here
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] text-[var(--color-bg-primary)] font-semibold text-sm hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] transition-all active:scale-95 disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import YDK File'}
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Main Deck */}
              <div>
                <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                  Main Deck <span className="text-[var(--color-text-muted)]">({deck.mainDeck.length})</span>
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {deck.mainDeck.map((id, i) => {
                    const card = mainCards.find(c => c.id === id)
                    return card ? (
                      <CardThumbnail
                        key={`main-${i}`}
                        card={card}
                        onClick={setSelectedCard}
                        onContextMenu={() => deck.removeFromMainDeck(i)}
                        selected={selectedCard?.id === card.id}
                      />
                    ) : (
                      <div key={`main-${i}`} className="card-thumbnail loading-shimmer" />
                    )
                  })}
                </div>
              </div>

              {/* Extra Deck */}
              {deck.extraDeck.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-[var(--color-text-secondary)] mb-2 uppercase tracking-wider">
                    Extra Deck <span className="text-[var(--color-text-muted)]">({deck.extraDeck.length})</span>
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {deck.extraDeck.map((id, i) => {
                      const card = extraCards.find(c => c.id === id)
                      return card ? (
                        <CardThumbnail
                          key={`extra-${i}`}
                          card={card}
                          onClick={setSelectedCard}
                          onContextMenu={() => deck.removeFromExtraDeck(i)}
                          selected={selectedCard?.id === card.id}
                        />
                      ) : (
                        <div key={`extra-${i}`} className="card-thumbnail loading-shimmer" />
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Card Details */}
      <div className="w-72 flex-shrink-0 border-l border-[var(--color-border)] bg-[var(--color-bg-secondary)] relative">
        <CardDetailPanel
          card={selectedCard}
          onClose={selectedCard ? () => setSelectedCard(null) : undefined}
        />
      </div>

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl animate-slide-up ${toast.type === 'error' ? 'bg-[var(--color-accent-rose)] text-white' : 'bg-[var(--color-accent-teal)] text-white'
          }`}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}
