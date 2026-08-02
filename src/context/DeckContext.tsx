import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
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
      if (extraDeck.length >= 9) return false
      addToExtraDeck(card.id)
    } else {
      if (mainDeck.length >= 30) return false
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
  }

  return (
    <DeckContext.Provider value={value}>
      {children}
    </DeckContext.Provider>
  )
}
