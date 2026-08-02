import { createContext, useContext, type ReactNode } from 'react'
import { getCachedCardCount, searchLocalCards, getCard, getCards, fetchAndCacheCards } from '../services/cardCache'
import type { CardData, CardFilter, CacheContextValue } from '../types'

const CacheContext = createContext<CacheContextValue | null>(null)

export function useCacheContext() {
  const ctx = useContext(CacheContext)
  if (!ctx) throw new Error('useCacheContext must be used within CacheProvider')
  return ctx
}

export function CacheProvider({ children }: { children: ReactNode }) {
  const searchCards = async (query: string, filters: CardFilter, limit = 30): Promise<CardData[]> => {
    return searchLocalCards(query, filters, limit)
  }

  const value: CacheContextValue = {
    cacheStatus: 'ready',
    progress: { fetched: 0, total: 0 },
    totalCards: 0,
    error: null,
    searchCards,
    getCard,
    getCards,
    fetchAndCacheCards,
  }

  return (
    <CacheContext.Provider value={value} >
      {children}
    </CacheContext.Provider>
  )
}

export { getCachedCardCount }
