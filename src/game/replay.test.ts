import { describe, expect, it } from 'vitest'
import { createInitialBoard, extractInitialStateInfo, replayCombo } from './replay'
import { POSITION, TOKEN_CARD } from './board'
import type { BoardState, CardData } from '../types'

const cards: Record<number, CardData> = {
  1: { id: 1, name: 'Alpha', frameType: 'effect' },
  2: { id: 2, name: 'Beta', frameType: 'effect' },
}

describe('shared-combo replay', () => {
  it('creates stable instance IDs and restores initial placement', () => {
    const board = createInitialBoard([1, 2], [], cards, { init: { hand: [1] } })

    expect(board.hand.map(card => card.id)).toEqual([1])
    expect(board.deck.map(card => card.id)).toEqual([2])
  })

  it('replays moves, draws, life points, positions, and phase changes without mutating history', () => {
    const initial = createInitialBoard([1, 2], [], cards)
    const history = replayCombo(initial, [
      { a: 'draw', n: 1 },
      { a: 'move', i: 1, f: 'hand', to: 'm1', p: POSITION.FACE_UP_ATK },
      { a: 'lp', v: 3200 },
      { a: 'phase', phase: 'mp1', turn: 'player' },
    ])

    expect(history).toHaveLength(5)
    expect(history[0].deck).toHaveLength(2)
    const finalBoard = history[history.length - 1]
    expect(finalBoard.deck.map(card => card.cardId)).toEqual([2])
    expect(finalBoard.m1).toMatchObject({ cardId: 1, position: POSITION.FACE_UP_ATK })
    expect(finalBoard.lp).toBe(3200)
    expect(finalBoard.phase).toBe('mp1')
  })

  it('preserves initial tokens separately from deck cards', () => {
    const board: BoardState = createInitialBoard([1], [], cards)
    board.hand.push({ id: 99, cardId: TOKEN_CARD.id, data: TOKEN_CARD })

    expect(extractInitialStateInfo(board)).toEqual({ tokens: [{ z: 'hand', i: 99, p: undefined }] })
  })
})
