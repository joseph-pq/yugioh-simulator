import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react'

const GameContext = createContext(null)

const getOrderValue = (card) => {
  if (!card || !card.type) return 0
  const type = card.type.toLowerCase()
  if (type.includes('spell')) return 2
  if (type.includes('trap')) return 3
  return 1 // monster or other types
}

export function useGame() {
  const ctx = useContext(GameContext)
  if (!ctx) throw new Error('useGame must be used within GameProvider')
  return ctx
}

/**
 * Zone IDs for Duel Links 3-zone board
 */
export const ZONES = {
  HAND: 'hand',
  M1: 'm1', M2: 'm2', M3: 'm3',
  ST1: 'st1', ST2: 'st2', ST3: 'st3',
  FIELD: 'field',
  GY: 'gy',
  BANISH: 'banish',
  DECK: 'deck',
  EXTRA: 'extra',
  FREE: 'free',
  EMZ1: 'emz1',
  EMZ2: 'emz2',
  EXTRA_PILE: 'extra_pile',
}

export const MONSTER_ZONES = [ZONES.M1, ZONES.M2, ZONES.M3, ZONES.EMZ1, ZONES.EMZ2]
export const SPELL_ZONES = [ZONES.ST1, ZONES.ST2, ZONES.ST3]
export const BOARD_ZONES = [...MONSTER_ZONES, ...SPELL_ZONES, ZONES.FIELD, ZONES.EXTRA_PILE]

/**
 * Card position on the field
 */
export const POSITION = {
  FACE_UP_ATK: 'fua',
  FACE_UP_DEF: 'fud',
  FACE_DOWN_DEF: 'fdd',
  FACE_DOWN: 'fd',  // for spells/traps
  FACE_UP: 'fu',    // for activated spells/traps
}

function createEmptyBoard() {
  return {
    hand: [],         // array of { id, cardId, data }
    m1: null, m2: null, m3: null,
    st1: null, st2: null, st3: null,
    field: null,
    gy: [],
    banish: [],
    deck: [],         // array of { id, cardId, data }
    extra: [],        // array of { id, cardId, data }
    free: [],         // array of { id, cardId, data }
    emz1: null,
    emz2: null,
    extra_pile: null,
    lp: 4000,
  }
}

let nextInstanceId = 1
function makeInstance(cardId, data) {
  return { id: nextInstanceId++, cardId, data }
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function GameProvider({ children }) {
  const [board, setBoard] = useState(createEmptyBoard)
  const [recording, setRecording] = useState(false)
  const [combo, setCombo] = useState([])         // recorded steps: [{ a: action, ... }]

  // History system for playback / undo / redo
  const [history, setHistory] = useState([createEmptyBoard()])
  const [historyIndex, setHistoryIndex] = useState(0)

  const cardsRef = useRef({})  // cardId -> card data lookup

  // Sync board with history index
  useEffect(() => {
    if (history[historyIndex]) {
      setBoard(history[historyIndex])
    }
  }, [historyIndex, history])

  // Initialize the board from a deck
  const initBoard = useCallback((mainIds, extraIds, cardDataMap) => {
    nextInstanceId = 1
    cardsRef.current = cardDataMap

    const newBoard = createEmptyBoard()
    newBoard.deck = mainIds.map(cid => makeInstance(cid, cardDataMap[cid]))
    newBoard.extra = extraIds.map(cid => makeInstance(cid, cardDataMap[cid]))
    newBoard.lp = 4000

    setBoard(newBoard)
    setCombo([])
    setHistory([newBoard])
    setHistoryIndex(0)
    setRecording(false)
  }, [])

  // Helper to apply a new state and record the step
  const updateBoardState = useCallback((updater, action, detail) => {
    setHistory(prev => {
      const currentBoard = prev[historyIndex] || createEmptyBoard()
      const nextBoard = updater(JSON.parse(JSON.stringify(currentBoard)))

      // Truncate history if we were playing back and did a new action
      const nextHistory = prev.slice(0, historyIndex + 1)
      nextHistory.push(nextBoard)

      // Add to combo steps
      if (recording) {
        setCombo(prevCombo => {
          const nextCombo = prevCombo.slice(0, historyIndex)
          nextCombo.push({ a: action, ...detail, t: Date.now() })
          return nextCombo
        })
      }

      // Advance index
      setTimeout(() => setHistoryIndex(nextHistory.length - 1), 0)
      return nextHistory
    })
  }, [historyIndex, recording])

  // ====== Board Actions ======

  const draw = useCallback((count = 1) => {
    updateBoardState(prev => {
      if (prev.deck.length === 0) return prev
      const n = Math.min(count, prev.deck.length)
      const drawn = prev.deck.slice(0, n)
      prev.deck = prev.deck.slice(n)
      prev.hand = [...prev.hand, ...drawn]
      return prev
    }, 'draw', { n: count })
  }, [updateBoardState])

  const shuffleDeck = useCallback(() => {
    updateBoardState(prev => {
      prev.deck = shuffleArray(prev.deck)
      return prev
    }, 'shuffle', {})
  }, [updateBoardState])

  const sortDeck = useCallback(() => {
    // Sort deck by type card: spell, trap, monster and then by name
    updateBoardState(prev => {
      prev.deck.sort((a, b) => {
        const cardA = cardsRef.current[a.cardId]
        const cardB = cardsRef.current[b.cardId]
        if (!cardA || !cardB) return 0
        const typeA = getOrderValue(cardA)
        const typeB = getOrderValue(cardB)
        if (typeA !== typeB) return typeA - typeB

        return cardA.name.localeCompare(cardB.name)
      })
      return prev
    }, 'sort', {})
  }, [updateBoardState])

  const moveCard = useCallback((instanceId, fromZone, toZone, position) => {
    updateBoardState(prev => {
      let card = null

      // Remove from source
      if (['hand', 'gy', 'banish', 'extra', 'deck', 'free'].includes(fromZone)) {
        const arr = prev[fromZone]
        const idx = arr.findIndex(c => c.id === instanceId)
        if (idx !== -1) {
          card = arr[idx]
          arr.splice(idx, 1)
        }
      } else {
        card = prev[fromZone]
        if (card && card.id === instanceId) {
          prev[fromZone] = null
        } else {
          card = null
        }
      }

      if (!card) return prev

      // Add to destination
      if (['hand', 'gy', 'banish', 'extra', 'deck', 'free'].includes(toZone)) {
        prev[toZone].push(card)
      } else {
        if (prev[toZone] !== null) {
          prev.hand.push(prev[toZone])
        }
        prev[toZone] = { ...card, position: position || POSITION.FACE_UP_ATK }
      }

      return prev
    }, 'move', { i: instanceId, f: fromZone, to: toZone, p: position })
  }, [updateBoardState])

  const changePosition = useCallback((zone, newPosition) => {
    updateBoardState(prev => {
      if (prev[zone]) {
        prev[zone].position = newPosition
      }
      return prev
    }, 'pos', { z: zone, p: newPosition })
  }, [updateBoardState])

  const setLP = useCallback((lp) => {
    updateBoardState(prev => {
      prev.lp = Math.max(0, lp)
      return prev
    }, 'lp', { v: lp })
  }, [updateBoardState])

  const sendToGY = useCallback((instanceId, fromZone) => {
    moveCard(instanceId, fromZone, 'gy')
  }, [moveCard])

  const sendToBanish = useCallback((instanceId, fromZone) => {
    moveCard(instanceId, fromZone, 'banish')
  }, [moveCard])

  const addToHand = useCallback((instanceId, fromZone) => {
    moveCard(instanceId, fromZone, 'hand')
  }, [moveCard])

  const returnToDeck = useCallback((instanceId, fromZone, toTop = true) => {
    updateBoardState(prev => {
      let card = null

      if (['hand', 'gy', 'banish', 'extra', 'free'].includes(fromZone)) {
        const arr = prev[fromZone]
        const idx = arr.findIndex(c => c.id === instanceId)
        if (idx !== -1) {
          card = arr[idx]
          arr.splice(idx, 1)
        }
      } else {
        card = prev[fromZone]
        if (card && card.id === instanceId) {
          prev[fromZone] = null
        }
      }

      if (!card) return prev

      if (toTop) {
        prev.deck.unshift(card)
      } else {
        prev.deck.push(card)
      }
      return prev
    }, 'todeck', { i: instanceId, f: fromZone, top: toTop })
  }, [updateBoardState])

  const millCards = useCallback((count = 1) => {
    updateBoardState(prev => {
      const n = Math.min(count, prev.deck.length)
      const milled = prev.deck.slice(0, n)
      prev.deck = prev.deck.slice(n)
      prev.gy = [...prev.gy, ...milled]
      return prev
    }, 'mill', { n: count })
  }, [updateBoardState])

  const generateToken = useCallback((targetZone = 'hand') => {
    updateBoardState(prev => {
      const tokenInstance = makeInstance(99999999, {
        id: 99999999,
        name: 'Monster Token',
        type: 'Token',
        humanType: 'Token Monster',
        frameType: 'token',
        race: 'Cyberse',
        attribute: 'LIGHT',
        atk: 0,
        def: 0,
        level: 1,
        desc: 'This card can be used as any Monster Token.',
      })

      if (['hand', 'gy', 'banish', 'free', 'deck'].includes(targetZone)) {
        prev[targetZone].push(tokenInstance)
      } else {
        if (prev[targetZone] === null) {
          prev[targetZone] = { ...tokenInstance, position: POSITION.FACE_UP_ATK }
        } else {
          prev.hand.push(tokenInstance)
        }
      }
      return prev
    }, 'token', { to: targetZone })
  }, [updateBoardState])

  const activateEffect = useCallback((instanceId, zone) => {
    updateBoardState(prev => {
      return prev
    }, 'effect', { i: instanceId, z: zone })
  }, [updateBoardState])

  const removeToken = useCallback((instanceId, zone) => {
    updateBoardState(prev => {
      if (['hand', 'gy', 'banish', 'free', 'deck', 'extra'].includes(zone)) {
        prev[zone] = prev[zone].filter(c => c.id !== instanceId)
      } else {
        if (prev[zone]?.id === instanceId) {
          prev[zone] = null
        }
      }
      return prev
    }, 'removetoken', { i: instanceId, z: zone })
  }, [updateBoardState])

  const resetBoard = useCallback(() => {
    setBoard(createEmptyBoard())
    setCombo([])
    setHistory([createEmptyBoard()])
    setHistoryIndex(0)
    setRecording(false)
  }, [])

  // ====== Recording & Playback Control ======

  const startRecording = useCallback(() => {
    setCombo([])
    // Set starting snapshot as base history
    setHistory([JSON.parse(JSON.stringify(board))])
    setHistoryIndex(0)
    setRecording(true)
  }, [board])

  const stopRecording = useCallback(() => {
    setRecording(false)
  }, [])

  const jumpToStep = useCallback((index) => {
    // index is -1 (initial state) or 0 to combo.length - 1
    const targetHistoryIndex = index + 1
    if (targetHistoryIndex >= 0 && targetHistoryIndex < history.length) {
      setHistoryIndex(targetHistoryIndex)
    }
  }, [history])

  const resetCombo = useCallback(() => {
    setCombo([])
    setHistory(prev => prev.length > 0 ? [prev[0]] : [createEmptyBoard()])
    setHistoryIndex(0)
    setRecording(false)
  }, [])

  const value = {
    board,
    recording,
    combo,
    playbackIndex: historyIndex - 1, // index in combo list
    maxPlaybackIndex: combo.length - 1,
    initBoard,
    draw,
    shuffleDeck,
    sortDeck,
    moveCard,
    changePosition,
    setLP,
    sendToGY,
    sendToBanish,
    addToHand,
    returnToDeck,
    millCards,
    generateToken,
    removeToken,
    activateEffect,
    resetBoard,
    resetCombo,
    startRecording,
    stopRecording,
    jumpToStep,
    setCombo,
    setHistory,
    setHistoryIndex,
  }

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}
