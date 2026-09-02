import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'
import type { BoardState, CardData, CardInstance, ComboStep, GameContextValue } from '../types'
import { ARRAY_ZONES, BOARD_ZONES, cloneBoard, createEmptyBoard, makeInstance, MONSTER_ZONES, POSITION, resetInstanceIds, SPELL_ZONES, TOKEN_CARD } from '../game/board'
import { addTokenToBoard, advancePhase as getNextPhase, changeCardPosition, drawCards, moveCardOnBoard, removeTokenFromBoard, returnAllCardsToDecks, sortDeck as sortBoardDeck } from '../game/transitions'

const GameContext = createContext<GameContextValue | null>(null)

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

export { ARRAY_ZONES, BOARD_ZONES, createEmptyBoard, makeInstance, MONSTER_ZONES, POSITION, SPELL_ZONES }

export function GameProvider({ children }: { children: ReactNode }) {
  const [recording, setRecording] = useState(false)
  const [combo, setCombo] = useState<ComboStep[]>([])
  const [playbackVisualizing, setPlaybackVisualizing] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)

  const [history, setHistory] = useState<BoardState[]>([createEmptyBoard()])
  const [historyIndex, setHistoryIndex] = useState(0)

  const cardsRef = useRef<Record<number, CardData | undefined>>({})  // maps ygopro cardId to card info
  const initialMainIds = useRef<number[]>([])
  const initialExtraIds = useRef<number[]>([])

  // Derived board state directly computed during render pass (no useEffect required)
  const board = history[historyIndex] || history[0] || createEmptyBoard()

  const initBoard = useCallback((mainIds: number[], extraIds: number[], cardDataMap: Record<number, CardData | undefined>) => {
    resetInstanceIds()
    cardsRef.current = cardDataMap

    initialMainIds.current = mainIds
    initialExtraIds.current = extraIds
    const newBoard = createEmptyBoard()
    newBoard.deck = mainIds.map(cid => makeInstance(cid, cardDataMap[cid]))
    newBoard.extra = extraIds.map(cid => makeInstance(cid, cardDataMap[cid]))
    newBoard.lp = 4000

    setCombo([])
    setPlaybackVisualizing(false)
    setHistory([newBoard])
    setHistoryIndex(0)
    setRecording(false)
  }, [])

  const loadState = useCallback((comboSteps: ComboStep[], newHistory: BoardState[], targetIndex?: number) => {
    setCombo(comboSteps)
    setHistory(newHistory)
    setHistoryIndex(targetIndex ?? (newHistory.length > 0 ? newHistory.length - 1 : 0))
    setPlaybackVisualizing(false)
    setRecording(false)
  }, [])

  const updateBoardState = useCallback((updater: (prev: BoardState) => BoardState, action: string, detail: Record<string, unknown>) => {
    setHistory(prev => {
      const currentBoard = prev[historyIndex] || createEmptyBoard()
      const nextBoard = updater(cloneBoard(currentBoard))

      const nextHistory = prev.slice(0, historyIndex + 1)
      nextHistory.push(nextBoard)
      setHistoryIndex(nextHistory.length - 1)
      return nextHistory
    })

    if (recording) {
      setCombo(prevCombo => {
        const nextCombo = prevCombo.slice(0, historyIndex)
        nextCombo.push({ a: action, ...detail, t: Date.now() })
        return nextCombo
      })
    }
  }, [historyIndex, recording])

  const draw = useCallback((count = 1) => {
    updateBoardState(prev => drawCards(prev, count), 'draw', { n: count })
  }, [updateBoardState])

  const shuffleDeck = useCallback(() => {
    updateBoardState(prev => {
      for (let i = prev.deck.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[prev.deck[i], prev.deck[j]] = [prev.deck[j], prev.deck[i]]
      }
      return prev
    }, 'shuffle', {})
  }, [updateBoardState])

  const sortDeck = useCallback(() => {
    updateBoardState(prev => sortBoardDeck(prev, cardsRef.current), 'sort', {})
  }, [updateBoardState])

  const returnAllToDecks = useCallback(() => {
    updateBoardState(prev => returnAllCardsToDecks(prev, cardsRef.current), 'reset_board', {})
  }, [updateBoardState])

  const moveCard = useCallback((instanceId: number, fromZone: string, toZone: string, position?: string) => {
    const zones = ['hand', 'egy', 'gy', 'ebanish', 'banish', 'eextra', 'extra', 'deck', 'efree', 'free']
    const sourceCard = (() => {
      if (zones.includes(fromZone)) {
        const zoneVal = board[fromZone as keyof BoardState]
        return Array.isArray(zoneVal) ? zoneVal.find((c: CardInstance) => c.id === instanceId) || null : null
      }

      const zoneCard = board[fromZone as keyof BoardState]
      return zoneCard && typeof zoneCard === 'object' && 'id' in zoneCard && zoneCard.id === instanceId ? zoneCard : null
    })() as CardInstance | null

    updateBoardState(prev => moveCardOnBoard(prev, instanceId, fromZone, toZone, position), 'move', {
      i: instanceId, cardId: sourceCard?.cardId, f: fromZone, to: toZone, p: position,
    })
  }, [board, updateBoardState])

  const changePosition = useCallback((zone: string, newPosition: string) => {
    const card = (board[zone as keyof BoardState] as CardInstance | null)
    updateBoardState(prev => changeCardPosition(prev, zone, newPosition, card?.id), 'pos', { z: zone, p: newPosition, i: card?.id, cardId: card?.cardId })
  }, [board, updateBoardState])

  const setLP = useCallback((lp: number) => {
    updateBoardState(prev => {
      prev.lp = Math.max(0, lp)
      return prev
    }, 'lp', { v: lp })
  }, [updateBoardState])

  const generateToken = useCallback((targetZone = 'hand', position: string = POSITION.FACE_UP_ATK) => {
    let createdId = 0
    updateBoardState(prev => {
      const tokenInstance = makeInstance(TOKEN_CARD.id, TOKEN_CARD)
      createdId = tokenInstance.id
      return addTokenToBoard(prev, tokenInstance, targetZone, position)
    }, 'token', { to: targetZone, p: position, i: createdId, cardId: TOKEN_CARD.id })
  }, [updateBoardState])

  const activateEffect = useCallback((instanceId: number, zone: string, cardId?: number) => {
    let resolvedCardId = cardId
    if (!resolvedCardId) {
      const zones = ['hand', 'egy', 'gy', 'ebanish', 'banish', 'eextra', 'extra', 'deck', 'efree', 'free']
      const sourceCard = (() => {
        if (zones.includes(zone)) {
          const zoneVal = board[zone as keyof BoardState]
          return Array.isArray(zoneVal) ? zoneVal.find((c: CardInstance) => c.id === instanceId) || null : null
        }
        const zoneCard = board[zone as keyof BoardState]
        return zoneCard && typeof zoneCard === 'object' && 'id' in zoneCard && (zoneCard as any).id === instanceId ? zoneCard : null
      })() as CardInstance | null
      resolvedCardId = sourceCard?.cardId
    }

    updateBoardState(prev => prev, 'effect', { i: instanceId, z: zone, cardId: resolvedCardId })
  }, [board, updateBoardState])

  const target = useCallback((instanceId: number, zone: string, cardId?: number) => {
    let resolvedCardId = cardId
    if (!resolvedCardId) {
      const zones = ['hand', 'egy', 'gy', 'ebanish', 'banish', 'eextra', 'extra', 'deck', 'efree', 'free']
      const sourceCard = (() => {
        if (zones.includes(zone)) {
          const zoneVal = board[zone as keyof BoardState]
          return Array.isArray(zoneVal) ? zoneVal.find((c: CardInstance) => c.id === instanceId) || null : null
        }
        const zoneCard = board[zone as keyof BoardState]
        return zoneCard && typeof zoneCard === 'object' && 'id' in zoneCard && (zoneCard as any).id === instanceId ? zoneCard : null
      })() as CardInstance | null
      resolvedCardId = sourceCard?.cardId
    }

    updateBoardState(prev => prev, 'target', { i: instanceId, z: zone, cardId: resolvedCardId })
  }, [board, updateBoardState])

  const activateSkill = useCallback(() => {
    updateBoardState(prev => prev, 'skill', {})
  }, [updateBoardState])

  const advancePhase = useCallback(() => {
    const currentBoard = history[historyIndex] || createEmptyBoard()
    const { phase, turn } = getNextPhase(currentBoard)

    updateBoardState(prev => {
      prev.phase = phase
      prev.turn = turn
      return prev
    }, 'phase', { phase, turn })
  }, [updateBoardState, history, historyIndex])

  const removeToken = useCallback((instanceId: number, zone: string) => {
    updateBoardState(prev => removeTokenFromBoard(prev, instanceId, zone), 'removetoken', { i: instanceId, z: zone, cardId: TOKEN_CARD.id })
  }, [updateBoardState])

  const resetBoard = useCallback(() => {
    const empty = createEmptyBoard()
    setCombo([])
    setHistory([empty])
    setHistoryIndex(0)
    setRecording(false)
    setPlaybackVisualizing(false)
  }, [])

  const startRecording = useCallback(() => {
    setCombo([])
    setHistory([cloneBoard(board)])
    setHistoryIndex(0)
    setRecording(true)
    setPlaybackVisualizing(false)
  }, [board])

  const stopRecording = useCallback(() => {
    setRecording(false)
  }, [])

  const jumpToStep = useCallback((index: number) => {
    const targetHistoryIndex = index + 1
    if (targetHistoryIndex >= 0 && targetHistoryIndex < history.length) {
      setPlaybackVisualizing(true)
      setHistoryIndex(targetHistoryIndex)
    }
  }, [history.length])

  const resetCombo = useCallback(() => {
    setCombo([])
    setHistory(prev => prev.length > 0 ? [prev[0]] : [createEmptyBoard()])
    setHistoryIndex(0)
    setRecording(false)
    setPlaybackVisualizing(false)
  }, [])

  const value: GameContextValue = {
    board,
    history,
    recording,
    playbackVisualizing,
    playbackSpeed,
    setPlaybackSpeed,
    combo,
    playbackIndex: historyIndex - 1,
    maxPlaybackIndex: combo.length - 1,
    initBoard,
    loadState,
    draw,
    shuffleDeck,
    sortDeck,
    moveCard,
    changePosition,
    setLP,
    generateToken,
    removeToken,
    activateEffect,
    target,
    activateSkill,
    advancePhase,
    resetBoard,
    resetCombo,
    startRecording,
    stopRecording,
    jumpToStep,
    setPlaybackVisualizing,
    setCombo,
    setHistory,
    setHistoryIndex,
    returnAllToDecks,
    initialMainIds,
    initialExtraIds,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
