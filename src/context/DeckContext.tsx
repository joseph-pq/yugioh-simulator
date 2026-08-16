import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import { fetchAndCacheCards } from '../services/cardCache'
import { validateDuelLinksDeck } from '../utils/ydkParser'
import type { CardData, DeckContextValue, DeckValidationResult } from '../types'

const DeckContext = createContext<DeckContextValue | null>(null)

export function useDeck() {
  const ctx = useContext(DeckContext)
  if (!ctx) throw new Error('useDeck must be used within DeckProvider')
  return ctx
}

export function DeckProvider({ children }: { children: ReactNode }) {
  const [deckName, setDeckName] = useState('')
  const [mainDeck, setMainDeck] = useState<number[]>([])
  const [extraDeck, setExtraDeck] = useState<number[]>([])
  const [validation, setValidation] = useState<DeckValidationResult>({ valid: true, errors: [], warnings: [] })

  const revalidate = useCallback((main: number[], extra: number[]) => {
    const result = validateDuelLinksDeck({ main, extra })
    setValidation(result)
    return result
  }, [])

  const addToMainDeck = useCallback((cardId: number) => {
    setMainDeck(prev => {
      const next = [...prev, cardId]
      revalidate(next, extraDeck)
      return next
    })
  }, [extraDeck, revalidate])

  const addToExtraDeck = useCallback((cardId: number) => {
    setExtraDeck(prev => {
      const next = [...prev, cardId]
      revalidate(mainDeck, next)
      return next
    })
  }, [mainDeck, revalidate])

  const removeFromMainDeck = useCallback((index: number) => {
    setMainDeck(prev => {
      const next = prev.filter((_, i) => i !== index)
      revalidate(next, extraDeck)
      return next
    })
  }, [extraDeck, revalidate])

  const removeFromExtraDeck = useCallback((index: number) => {
    setExtraDeck(prev => {
      const next = prev.filter((_, i) => i !== index)
      revalidate(mainDeck, next)
      return next
    })
  }, [mainDeck, revalidate])

  const addCard = useCallback((card: CardData) => {
    const isExtra = ['Fusion Monster', 'Synchro Monster', 'XYZ Monster', 'Link Monster'].some(
      t => card.type?.includes(t) || card.humanType?.includes(t),
    )

    const allIds = [...mainDeck, ...extraDeck]
    const currentCount = allIds.filter(id => id === card.id).length
    if (currentCount >= 3) return false

    if (isExtra) {
      if (extraDeck.length >= 15) return false
      addToExtraDeck(card.id)
    } else {
      if (mainDeck.length >= 60) return false
      addToMainDeck(card.id)
    }
    return true
  }, [mainDeck, extraDeck, addToMainDeck, addToExtraDeck])

  const importDeck = useCallback((parsed: { main?: number[]; extra?: number[] }) => {
    setMainDeck(parsed.main || [])
    setExtraDeck(parsed.extra || [])
    revalidate(parsed.main || [], parsed.extra || [])
  }, [revalidate])

  const clearDeck = useCallback(() => {
    setMainDeck([])
    setExtraDeck([])
    setDeckName('')
    setValidation({ valid: true, errors: [], warnings: [] })
  }, [])

  const getCardCount = useCallback((cardId: number) => {
    return [...mainDeck, ...extraDeck].filter(id => id === cardId).length
  }, [mainDeck, extraDeck])

  const sortDeck = useCallback(async () => {
    const allIds = [...mainDeck, ...extraDeck]
    if (allIds.length === 0) return

    const cardList = await fetchAndCacheCards(allIds)
    const cardMap = new Map<number, CardData>()
    cardList.forEach(c => cardMap.set(c.id, c))

    const getSortCategory = (card: CardData | undefined): number => {
      if (!card) return 99
      const type = (card.type || '').toLowerCase()
      const humanType = (card.humanType || '').toLowerCase()
      const isType = (str: string) => type.includes(str) || humanType.includes(str)

      if (isType('fusion monster')) return 10
      if (isType('synchro monster')) return 11
      if (isType('xyz monster')) return 12
      if (isType('link monster')) return 13
      if (isType('monster')) return 1
      if (isType('spell')) return 2
      if (isType('trap')) return 3
      return 4
    }

    const compareCards = (idA: number, idB: number) => {
      const cardA = cardMap.get(idA)
      const cardB = cardMap.get(idB)
      if (!cardA && !cardB) return 0
      if (!cardA) return 1
      if (!cardB) return -1

      const catA = getSortCategory(cardA)
      const catB = getSortCategory(cardB)
      if (catA !== catB) return catA - catB

      const levelA = cardA.level ?? cardA.rank ?? 0
      const levelB = cardB.level ?? cardB.rank ?? 0
      if (levelA !== levelB) return levelB - levelA

      return cardA.name.localeCompare(cardB.name)
    }

    const sortedMain = [...mainDeck].sort(compareCards)
    const sortedExtra = [...extraDeck].sort(compareCards)

    setMainDeck(sortedMain)
    setExtraDeck(sortedExtra)
    revalidate(sortedMain, sortedExtra)
  }, [mainDeck, extraDeck, revalidate])

  const value: DeckContextValue = {
    deckName,
    setDeckName,
    mainDeck,
    extraDeck,
    validation,
    addCard,
    removeFromMainDeck,
    removeFromExtraDeck,
    importDeck,
    clearDeck,
    getCardCount,
    sortDeck,
  }

  return (
    <DeckContext.Provider value={value}>
      {children}
    </DeckContext.Provider>
  )
}
