import { createContext, useContext, useCallback } from 'react'
import { getCachedCardCount, searchLocalCards, getCard, getCards, fetchAndCacheCards } from '../services/cardCache'

const CacheContext = createContext(null)

export function useCacheContext() {
  const ctx = useContext(CacheContext)
  if (!ctx) throw new Error('useCacheContext must be used within CacheProvider')
  return ctx
}

export function CacheProvider({ children }) {
  // No bulk download needed — cards are fetched on-demand when importing decks

  const searchCards = useCallback(async (query, filters, limit) => {
    return searchLocalCards(query, filters, limit)
  }, [])

  const value = {
    cacheStatus: 'ready', // Always ready — no bulk download
    progress: { fetched: 0, total: 0 },
    totalCards: 0,
    error: null,
    searchCards,
    getCard,
    getCards,
    fetchAndCacheCards,
  }

  return (
    <CacheContext.Provider value={value}>
      {children}
    </CacheContext.Provider>
  )
}
