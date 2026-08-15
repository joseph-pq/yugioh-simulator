import { useState, useCallback, useEffect, useRef } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useGame, POSITION, MONSTER_ZONES, SPELL_ZONES } from '../context/GameContext'
import type { CardData, CardInstance, Phase } from '../types'
import { ZONES } from '../types'
import { getCardImageUrl } from '../services/ygoproApi'
import CardContextMenu from './CardContextMenu'
import skillIcon from '../assets/skill.png'

const FIELD_NATURAL_WIDTH = 720

export interface DuelBoardProps {
  onSelectCard?: (card?: CardData) => void
  onHoverCard?: (card?: CardData) => void
}

interface ContextMenuState {
  x: number
  y: number
  card: CardInstance
  zone: string
}

interface FlyingCardState {
  id: number
  cardId: number
  start: { x: number; y: number }
  end: { x: number; y: number }
  animating: boolean
}

interface ActiveCardData {
  instanceId: number
  cardId: number
  fromZone: string
  data?: CardData
}

/**
 * Main Duel Board — Exact Duel Links Field Layout with:
 * - Flying card drag animation during record playback
 * - Dynamic vertical card spacing in GY and Banish piles so all cards remain visible regardless of count
 * - Highlight glow animation reserved exclusively for Effect Activation
 */
export default function DuelBoard({ onSelectCard, onHoverCard }: DuelBoardProps) {
  const game = useGame()
  const { board } = game
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [activeCard, setActiveCard] = useState<ActiveCardData | null>(null)
  const [effectCardId, setEffectCardId] = useState<number | null>(null) // Glow ONLY when effect is activated
  const [skillActive, setSkillActive] = useState(false)
  const [flyingCard, setFlyingCard] = useState<FlyingCardState | null>(null)
  const fieldWrapRef = useRef<HTMLDivElement>(null)
  const fieldInnerRef = useRef<HTMLDivElement>(null)
  const [fieldScale, setFieldScale] = useState(1)
  const [scaledFieldHeight, setScaledFieldHeight] = useState<number | undefined>()
  const playbackGlowTimers = useRef<{
    effect: ReturnType<typeof setTimeout> | null
    skill: ReturnType<typeof setTimeout> | null
  }>({ effect: null, skill: null })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )
  // Derive hiddenPlaybackCardId synchronously during render
  // This avoids a mismatch between the visual state and the actual board
  // state during playback, which can cause flickering or incorrect card
  // visibility.
  let hiddenPlaybackCardId: number | null = null
  if (game.playbackVisualizing && game.playbackIndex >= 0 && game.combo[game.playbackIndex]) {
    const step = game.combo[game.playbackIndex]
    if (step.a === 'move') {
      hiddenPlaybackCardId = step.i || step.instanceId || null
    } else if (step.a === 'draw') {
      const drawnCount = Math.max(1, step.n || 1)
      const drawnCards = board.hand.slice(Math.max(0, board.hand.length - drawnCount))
      hiddenPlaybackCardId = drawnCards[0]?.id || null
    }
  }


  // Animated Flying Drag Movement during Record Playback
  useEffect(() => {
    let frameId: number | null = null
    let animTimer: ReturnType<typeof setTimeout> | null = null
    let endTimer: ReturnType<typeof setTimeout> | null = null

    if (!game.playbackVisualizing) {
      setFlyingCard(null)
      return undefined
    }

    const speed = game.playbackSpeed || 1
    const startDelay = Math.max(20, Math.round(80 / speed))
    const animDuration = Math.max(100, Math.round(350 / speed))
    const totalDuration = startDelay + animDuration + Math.max(20, Math.round(50 / speed))

    if (game.playbackIndex >= 0 && game.combo[game.playbackIndex]) {
      const step = game.combo[game.playbackIndex]
      frameId = requestAnimationFrame(() => {
        let cardId = step.i || step.instanceId
        let fromZone = step.f || step.from
        let toZone = step.to
        let cardImgId = step.cardId || step.card?.id || 99999999

        if (step.a === 'draw') {
          const drawnCount = Math.max(1, step.n || 1)
          const drawnCards = board.hand.slice(Math.max(0, board.hand.length - drawnCount))
          const drawnCard = drawnCards[0]

          cardId = drawnCard?.id || cardId
          cardImgId = drawnCard?.cardId || cardImgId
          fromZone = ZONES.DECK
          toZone = ZONES.HAND
        }

        if (cardId && fromZone && toZone && fromZone !== toZone) {
          const fromEl = document.getElementById(`zone-${fromZone}`)
          const toEl = document.getElementById(`zone-${toZone}`)

          if (fromEl && toEl) {
            const startRect = fromEl.getBoundingClientRect()
            const endRect = toEl.getBoundingClientRect()

            setFlyingCard({
              id: cardId,
              cardId: cardImgId,
              start: {
                x: startRect.left + startRect.width / 2 - (60/2),
                y: startRect.top + startRect.height / 2 - (87/2),
              },
              end: {
                x: endRect.left + endRect.width / 2 - (60/2),
                y: endRect.top + endRect.height / 2 - (87/2),
              },
              animating: false,
            })

            animTimer = setTimeout(() => {
              setFlyingCard(prev => prev ? { ...prev, animating: true } : null)
            }, startDelay)

            endTimer = setTimeout(() => {
              setFlyingCard(null)
              // Setting visualization to false makes hiddenPlaybackCardId
              // synchronously null on next render
              game.setPlaybackVisualizing(false)
            }, totalDuration)
          }
        }
      })
    }

    return () => {
      if (frameId !== null) cancelAnimationFrame(frameId)
      if (animTimer) clearTimeout(animTimer)
      if (endTimer) clearTimeout(endTimer)
    }
  }, [board, game.playbackIndex, game.combo, game.playbackVisualizing, game.playbackSpeed])

  useEffect(() => {
    if (!game.playbackVisualizing) {
      return
    }
    const speed = game.playbackSpeed || 1
    const effectGlowDuration = Math.max(150, Math.round(600 / speed))
    const skillGlowDuration = Math.max(150, Math.round(350 / speed))

    const glowTimers = playbackGlowTimers.current
    if (glowTimers.effect) clearTimeout(glowTimers.effect)
    if (glowTimers.skill) clearTimeout(glowTimers.skill)

    const step = game.playbackIndex >= 0 ? game.combo[game.playbackIndex] : null

    if (!step) {
      setEffectCardId(null)
      setSkillActive(false)
      return undefined
    }

    if (step.a === 'effect' || step.a === 'pos' || step.a === 'token' || step.a === 'removetoken') {
      let cardId = step.i || step.instanceId
      if (!cardId && (step.z || step.to)) {
        const targetZone = (step.z || step.to) as string
        const zoneCard = (board as Record<string, unknown>)[targetZone] as CardInstance | null
        cardId = zoneCard?.id
      }
      setSkillActive(false)
      if (cardId) {
        setEffectCardId(cardId)
        glowTimers.effect = setTimeout(() => setEffectCardId(null), effectGlowDuration)
      } else {
        setEffectCardId(null)
      }
    } else if (step.a === 'skill') {
      setEffectCardId(null)
      setSkillActive(true)
      glowTimers.skill = setTimeout(() => setSkillActive(false), skillGlowDuration)
    } else {
      setEffectCardId(null)
      setSkillActive(false)
    }

    return () => {
      if (glowTimers.effect) clearTimeout(glowTimers.effect)
      if (glowTimers.skill) clearTimeout(glowTimers.skill)
    }
  }, [game.playbackIndex, game.combo, game.playbackSpeed])

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const { active } = event
    setActiveCard(active.data.current as ActiveCardData)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    game.setPlaybackVisualizing(false)
    setActiveCard(null)

    if (!over || !active.data.current) return

    const { instanceId, fromZone } = active.data.current as ActiveCardData
    const toZone = String(over.id)

    if (fromZone === 'token_generator') {
      game.generateToken(toZone)
      return
    }

    if (fromZone === toZone) return

    let position: string = POSITION.FACE_UP_ATK
    if ((SPELL_ZONES as readonly string[]).includes(toZone) || toZone === ZONES.FIELD || toZone === ZONES.EXTRA_PILE) {
      position = POSITION.FACE_UP
    }

    game.moveCard(instanceId, fromZone, toZone, position)
  }, [game])

  const handleDragCancel = useCallback(() => {
    setActiveCard(null)
  }, [])

  const handleContextMenu = useCallback((e: React.MouseEvent, card: CardInstance, zone: string) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, card, zone })
  }, [])

  const handleContextAction = useCallback((action: string, card: CardInstance, zone: string) => {
    game.setPlaybackVisualizing(false)
    const id = card.id
    switch (action) {
      case 'activate_effect':
        game.activateEffect(id, zone)
        setEffectCardId(id)
        setTimeout(() => setEffectCardId(null), 1200)
        break
      case 'remove_token':
        game.removeToken(id, zone)
        break
      case 'summon_atk':
      case 'ss_atk': {
        const target = MONSTER_ZONES.find(z => !board[z as keyof typeof board])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_UP_ATK)
        break
      }
      case 'ss_def': {
        const target = MONSTER_ZONES.find(z => !board[z as keyof typeof board])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_UP_DEF)
        break
      }
      case 'set_monster': {
        const target = MONSTER_ZONES.find(z => !board[z as keyof typeof board])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_DOWN_DEF)
        break
      }
      case 'set_st': {
        const target = SPELL_ZONES.find(z => !board[z as keyof typeof board])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_DOWN)
        break
      }
      case 'set_field':
        game.moveCard(id, zone, ZONES.FIELD, POSITION.FACE_UP)
        break
      case 'to_gy':
        game.moveCard(id, zone, ZONES.GY)
        break
      case 'to_banish':
        game.moveCard(id, zone, ZONES.BANISH)
        break
      case 'to_hand':
        game.moveCard(id, zone, ZONES.HAND)
        break
      case 'to_deck_top':
      case 'to_deck_bottom':
        game.moveCard(id, zone, ZONES.DECK)
        break
      case 'flip_atk':
        game.changePosition(zone, POSITION.FACE_UP_ATK)
        break
      case 'flip_def':
        game.changePosition(zone, POSITION.FACE_UP_DEF)
        break
      case 'to_def':
        game.changePosition(zone, POSITION.FACE_UP_DEF)
        break
      case 'to_atk':
        game.changePosition(zone, POSITION.FACE_UP_ATK)
        break
      case 'to_facedown':
        game.changePosition(zone, POSITION.FACE_DOWN_DEF)
        break
      case 'flip_up':
        game.changePosition(zone, POSITION.FACE_UP)
        break
      case 'to_facedown_st':
        game.changePosition(zone, POSITION.FACE_DOWN)
        break
    }
  }, [board, game])

  useEffect(() => {
    if (!activeCard) return

    const { instanceId, fromZone } = activeCard
    if (fromZone === 'token_generator') return

    const source = (board as Record<string, unknown>)[fromZone]

    const stillInSource = Array.isArray(source)
      ? source.some((c: any) => c.id === instanceId)
      : typeof source === 'object' && source !== null && 'id' in source && (source as any).id === instanceId

    if (!stillInSource) {
      setActiveCard(null)
    }
  }, [board, activeCard])

  const handleSkillClick = useCallback(() => {
    game.activateSkill()
    setSkillActive(true)
    setTimeout(() => setSkillActive(false), 400)
  }, [game])

  useEffect(() => {
    const wrap = fieldWrapRef.current
    const inner = fieldInnerRef.current
    if (!wrap || !inner) return

    const updateScale = () => {
      const scale = Math.min(1, wrap.clientWidth / FIELD_NATURAL_WIDTH)
      setFieldScale(scale)
      setScaledFieldHeight(inner.offsetHeight * scale)
    }

    updateScale()
    const ro = new ResizeObserver(updateScale)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [])

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <div className="flex flex-col h-full select-none justify-between overflow-hidden">
        {/* Phase Tracker Bar */}
        <PhaseTrackerBar phase={board.phase || 'dp'} turn={board.turn || 'player'} />
        {/* Main Duel Field Area */}
        <div ref={fieldWrapRef} className="flex-1 flex items-start justify-center p-2 min-h-0 overflow-hidden">
          <div
            className="w-full flex justify-center overflow-hidden"
            style={{ height: scaledFieldHeight }}
          >
          <div
            ref={fieldInnerRef}
            className="flex items-center justify-center gap-3"
            style={{
              width: FIELD_NATURAL_WIDTH,
              transform: `scale(${fieldScale})`,
              transformOrigin: 'top center',
            }}
          >

            <div className="flex flex-col justify-between gap-3 h-[480px]">
              <VerticalStackPileZone zone={ZONES.EBANISH} cards={board.ebanish} label="BANISH" color="var(--color-accent-blue)" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              {/* Left: FREE Zone (Vertical Rectangle Stack) */}
              <VerticalStackPileZone
                zone={ZONES.FREE}
                cards={board.free}
                label="FREE"
                color="var(--color-text-muted)"
                effectCardId={effectCardId}
                hiddenCardId={hiddenPlaybackCardId}
                onContextMenu={handleContextMenu}
                onSelectCard={onSelectCard}
                onHoverCard={onHoverCard}
                activeCard={activeCard}
              />
            </div>

            <div className="flex flex-col justify-between gap-3 h-[480px]">
              <VerticalStackPileZone zone={ZONES.EGY} cards={board.egy} label="GRAVE" color="var(--color-accent-rose)" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              {/* Left Column 2: FIELD (Top) & EXTRA (Bottom) */}
              <div className="flex flex-col justify-between gap-3 h-[240px]">
                <BoardZone zone={ZONES.FIELD} card={board.field} label="" outlineColor="border-yellow-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.EXTRA_PILE} card={board.extra_pile} label="" outlineColor="border-slate-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              </div>
            </div>

            {/* Center: EMZs (Top), Monster Zones (Middle), Spell/Trap Zones (Bottom) */}
            <div className="flex flex-col gap-2.5 items-center">
              {/* Spell/Trap Row: E S/T1, E S/T2, E S/T3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.EST1} card={board.est1} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.EST2} card={board.est2} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.EST3} card={board.est3} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              </div>
              {/* Monster Row: EM1, EM2, EM3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.EM1} card={board.em1} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.EM2} card={board.em2} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.EM3} card={board.em3} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              </div>

              {/* EMZ Row */}
              <div className="flex justify-center gap-22 py-0.5">
                <BoardZone zone={ZONES.EMZ1} card={board.emz1} label="" outlineColor="border-purple-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.EMZ2} card={board.emz2} label="" outlineColor="border-purple-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              </div>

              {/* Monster Row: M1, M2, M3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.M1} card={board.m1} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.M2} card={board.m2} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.M3} card={board.m3} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              </div>

              {/* Spell/Trap Row: S/T1, S/T2, S/T3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.ST1} card={board.st1} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.ST2} card={board.st2} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.ST3} card={board.st3} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              </div>
            </div>

            {/* Right: GRAVE & BANISH Vertical Rectangle Stacked Piles */}
            <div className="flex flex-col justify-between gap-3 h-[480px]">
              <div className="flex flex-col justify-between gap-3 h-[240px]">
                <BoardZone zone={ZONES.EEXTRA_PILE} card={board.eextra_pile} label="" outlineColor="border-slate-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <BoardZone zone={ZONES.EFIELD} card={board.efield} label="" outlineColor="border-yellow-600/50" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
              </div>
              <VerticalStackPileZone zone={ZONES.GY} cards={board.gy} label="GRAVE" color="var(--color-accent-rose)" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
            </div>
            <div className="flex flex-col justify-between gap-3 h-[480px]">
              <VerticalStackPileZone
                zone={ZONES.EFREE}
                cards={board.efree}
                label="FREE"
                color="var(--color-text-muted)"
                effectCardId={effectCardId}
                hiddenCardId={hiddenPlaybackCardId}
                onContextMenu={handleContextMenu}
                onSelectCard={onSelectCard}
                onHoverCard={onHoverCard}
                activeCard={activeCard}
              />
              <div className="flex items-end gap-2">
                <VerticalStackPileZone zone={ZONES.BANISH} cards={board.banish} label="BANISH" color="var(--color-accent-blue)" effectCardId={effectCardId} hiddenCardId={hiddenPlaybackCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} activeCard={activeCard} />
                <div className="flex flex-col items-center gap-2">
                  <NextPhaseButton onClick={game.advancePhase} phase={board.phase || 'dp'} turn={board.turn || 'player'} />
                  <SkillActionButton onClick={handleSkillClick} isActive={skillActive} />
                </div>
              </div>
            </div>

          </div>
          </div>
        </div>

        {/* Hand, Extra Deck & Token Generator Pools */}
        <div className="grid grid-cols-12 gap-2 px-2 sm:px-3 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          <div className="col-span-5 sm:col-span-4 border border-dashed border-[var(--color-accent-blue)]/30 rounded-lg bg-[var(--color-bg-primary)]/40 p-1.5 min-w-0">
            <div className="text-[10px] font-bold text-[var(--color-accent-blue)] mb-0.5 uppercase tracking-wider">Hand ({board.hand.length})</div>
            <HorizontalStackPileZone
              zone={ZONES.HAND}
              cards={board.hand}
              effectCardId={effectCardId}
              onContextMenu={handleContextMenu}
              onSelectCard={onSelectCard}
              onHoverCard={onHoverCard}
              activeCard={activeCard}
            />
          </div>

          <div className="col-span-5 sm:col-span-6 border border-dashed border-[var(--color-accent-purple)]/30 rounded-lg bg-[var(--color-bg-primary)]/40 p-1.5 min-w-0">
            <div className="text-[10px] font-bold text-[var(--color-accent-purple)] mb-0.5 uppercase tracking-wider">Extra Deck ({board.extra.length})</div>
            <HorizontalStackPileZone
              zone={ZONES.EXTRA}
              cards={board.extra}
              effectCardId={effectCardId}
              onContextMenu={handleContextMenu}
              onSelectCard={onSelectCard}
              onHoverCard={onHoverCard}
              activeCard={activeCard}
            />
          </div>

          <div className="col-span-2 border border-dashed border-amber-500/40 rounded-lg bg-[var(--color-bg-primary)]/40 p-1.5 flex flex-col justify-between min-w-0">
            <div className="text-[10px] font-bold text-amber-400 mb-0.5 uppercase tracking-wider flex items-center justify-between">
              <span>✨ Tokens</span>
              <span className="text-[11px] font-mono text-amber-300 font-extrabold">∞</span>
            </div>
            <TokenGeneratorBox onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
          </div>
        </div>

        {/* Main Deck Pool */}
        <div className="px-3 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          <div className="border border-dashed border-[var(--color-text-muted)]/30 rounded-lg bg-[var(--color-bg-primary)]/40 p-1.5">
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] mb-1 uppercase tracking-wider flex items-center justify-between">
              <span>Main Deck ({board.deck.length})</span>
              <div className="flex items-center gap-2">
                <button onClick={game.shuffleDeck} className="px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[9px] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-colors">
                  🔀 Shuffle Deck
                </button>
                <button onClick={game.sortDeck} className="px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[9px] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-colors">
                  📶 Sort Deck
                </button>
              </div>
            </div>
            <HorizontalStackPileZone
              zone={ZONES.DECK}
              cards={board.deck}
              effectCardId={effectCardId}
              hiddenCardId={hiddenPlaybackCardId}
              onContextMenu={handleContextMenu}
              onSelectCard={onSelectCard}
              onHoverCard={onHoverCard}
              activeCard={activeCard}
            />
          </div>
        </div>
      </div>

      {/* Manual Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeCard?.data ? (
          <img src={getCardImageUrl(activeCard.data.id || activeCard.cardId, 'small')} alt="" className="card-thumbnail opacity-85 shadow-2xl" />
        ) : null}
      </DragOverlay>

      {/* Animated Flying Drag Overlay during Record Playback */}
      {flyingCard && (
        <div
          className="fixed z-[999] pointer-events-none transform-gpu shadow-2xl rounded"
          style={{
            left: `${flyingCard.animating ? flyingCard.end.x : flyingCard.start.x}px`,
            top: `${flyingCard.animating ? flyingCard.end.y : flyingCard.start.y}px`,
            width: 'var(--card-width)',
            height: 'var(--card-height)',
            transition: flyingCard.animating
              ? `left ${Math.max(100, Math.round(350 / (game.playbackSpeed || 1)))}ms ease-in-out, top ${Math.max(100, Math.round(350 / (game.playbackSpeed || 1)))}ms ease-in-out`
              : 'none',
          }}
        >
          <img
            src={getCardImageUrl(flyingCard.cardId, 'small')}
            alt=""
            className="w-full h-full object-cover rounded border border-yellow-400/80 shadow-[0_0_15px_rgba(250,204,21,0.6)]"
          />
        </div>
      )}

      {contextMenu && (
        <CardContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          card={contextMenu.card}
          zone={contextMenu.zone}
          onAction={handleContextAction}
          onClose={() => setContextMenu(null)}
        />
      )}
    </DndContext>
  )
}

interface BoardZoneProps {
  zone: string
  card: CardInstance | null
  label?: string
  outlineColor?: string
  effectCardId?: number | null
  hiddenCardId?: number | null
  onContextMenu: (e: React.MouseEvent, card: CardInstance, zone: string) => void
  onSelectCard?: (card?: CardData) => void
  onHoverCard?: (card?: CardData) => void
  activeCard?: ActiveCardData | null
}

function BoardZone({ zone, card, label, outlineColor, effectCardId, hiddenCardId, onContextMenu, onSelectCard, onHoverCard, activeCard }: BoardZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  const isFaceDown = card?.position === POSITION.FACE_DOWN_DEF || card?.position === POSITION.FACE_DOWN
  const isDefense = card?.position === POSITION.FACE_UP_DEF || card?.position === POSITION.FACE_DOWN_DEF
  const isHidden = card && card.id === hiddenCardId

  return (
    <div
      ref={setNodeRef}
      id={`zone-${zone}`}
      className={`relative w-[64px] h-[86px] rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-200
        ${isOver ? 'border-[var(--color-gold-400)] bg-[var(--color-gold-500)]/10 scale-105' : `${outlineColor || 'border-[var(--color-border)]'} bg-[var(--color-bg-tertiary)]/50`}
        ${card && !isHidden ? 'border-solid' : ''}`}
    >
      {card && !isHidden ? (
        <DraggableCard
          card={card}
          zone={zone}
          isFaceDown={isFaceDown}
          isDefense={isDefense}
          isEffectActivated={card.id === effectCardId}
          onContextMenu={onContextMenu}
          onClick={() => onSelectCard?.(card.data || undefined)}
          onMouseEnter={() => onHoverCard?.(card.data || undefined)}
          hoverDirection='up'
          isGhost={activeCard?.instanceId === card.id}
        />
      ) : (
        <span className="text-[9px] text-[var(--color-text-muted)] font-bold font-sans uppercase tracking-wider">{label}</span>
      )}
    </div>
  )
}

interface HorizontalStackPileZoneProps {
  zone: string
  cards: CardInstance[]
  effectCardId?: number | null
  hiddenCardId?: number | null
  activeCard?: ActiveCardData | null
  onContextMenu: (e: React.MouseEvent, card: CardInstance, zone: string) => void
  onSelectCard?: (card?: CardData) => void
  onHoverCard?: (card?: CardData) => void
}

function HorizontalStackPileZone({
  zone,
  cards,
  effectCardId,
  hiddenCardId,
  onContextMenu,
  onSelectCard,
  onHoverCard,
  activeCard,
}: HorizontalStackPileZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })

  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null)

  const cardWidth = 56
  const availableWidth = 1100 // adjust to container
  const gap = 3

  let stepOffset = cardWidth + gap

  if (cards.length > 1) {
    const requiredWidth = cardWidth * cards.length

    if (requiredWidth > availableWidth) {
      stepOffset = Math.max(
        8,
        Math.floor((availableWidth - cardWidth) / (cards.length - 1))
      )
    }
  }

  const overlapMargin = stepOffset - cardWidth
  const visibleCards = hiddenCardId ? cards.filter(card => card.id !== hiddenCardId) : cards

  return (
    <div
      ref={setNodeRef}
      id={`zone-${zone}`}
      className={`relative flex items-start min-h-[78px] overflow-visible transition-colors duration-200 ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''
        }`}
    >
      {visibleCards.length === 0 ? (
        <span className="m-auto text-[10px] text-[var(--color-text-muted)] font-mono">
          Empty
        </span>
      ) : (
        visibleCards.map((card, idx) => (
          <div
            key={card.id}
            className="relative transition-all duration-200"
            style={{
              marginLeft: idx === 0 ? 0 : overlapMargin,
              zIndex: hoveredCardId === card.id ? 999 : idx + 1,
            }}
          >
            <DraggableCard
              card={card}
              zone={zone}
              isEffectActivated={card.id === effectCardId}
              onContextMenu={onContextMenu}
              onClick={() => onSelectCard?.(card.data || undefined)}
              onMouseEnter={() => {
                setHoveredCardId(card.id)
                onHoverCard?.(card.data || undefined)
              }}
              onMouseLeave={() => setHoveredCardId(null)}
              hoverDirection='up'
              isGhost={activeCard?.instanceId === card.id}
            />
          </div>
        ))
      )}
    </div>
  )
}

interface VerticalStackPileZoneProps {
  zone: string
  cards: CardInstance[]
  label: string
  color?: string
  effectCardId?: number | null
  hiddenCardId?: number | null
  activeCard?: ActiveCardData | null
  onContextMenu: (e: React.MouseEvent, card: CardInstance, zone: string) => void
  onSelectCard?: (card?: CardData) => void
  onHoverCard?: (card?: CardData) => void
}

function VerticalStackPileZone({ zone, cards, label, color, effectCardId, hiddenCardId, onContextMenu, onSelectCard, onHoverCard, activeCard }: VerticalStackPileZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null)

  const availableHeight = 210 // space available for cards
  const cardHeight = 86

  let stepOffset = cardHeight + 1
  const cardCount = cards.length

  if (cardCount > 1) {
    // Total height if cards don't overlap
    const requiredHeight = cardHeight * cardCount

    if (requiredHeight > availableHeight) {
      // Compress spacing only when running out of room
      stepOffset = Math.max(
        4,
        Math.floor((availableHeight - cardHeight) / (cardCount - 1))
      )
    }
  }

  const overlapMargin = stepOffset - cardHeight
  const visibleCards = hiddenCardId ? cards.filter(card => card.id !== hiddenCardId) : cards

  return (
    <div
      ref={setNodeRef}
      id={`zone-${zone}`}
      className={`relative w-[74px] h-[255px] rounded-lg border-2 border-dashed flex flex-col p-1 transition-all duration-200 shadow-inner ${isOver
        ? 'border-[var(--color-gold-400)] bg-[var(--color-gold-500)]/15 scale-105 z-40'
        : 'border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/40'
        }`}
      style={{ borderColor: isOver ? undefined : color }}
    >
      {/* Zone Title Header */}
      <div className="flex items-center justify-between mb-1 px-1 border-b border-[var(--color-border)]/50 pb-0.5 sticky top-0 bg-[var(--color-bg-secondary)]/95 z-40 rounded">
        <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>{label}</span>
        <span className="text-[9px] font-mono font-extrabold text-[var(--color-text-primary)]">{cards.length}</span>
      </div>

      {visibleCards.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[8px] text-[var(--color-text-muted)] font-mono">
          {/* Empty */}
        </div>
      ) : (
        /* Dynamic Vertical Stack Cascade */
        <div className="relative flex flex-col items-center w-full flex-1 pt-1 overflow-visible">
          {visibleCards.map((card, idx) => (
            <div
              key={card.id}
              className="relative transition-all duration-200"
              style={{
                marginTop: idx === 0 ? '0px' : `${overlapMargin}px`,
                zIndex: hoveredCardId === card.id ? 999 : idx + 1,
              }}
            >
              <DraggableCard
                card={card}
                zone={zone}
                isEffectActivated={card.id === effectCardId}
                onContextMenu={onContextMenu}
                onClick={() => onSelectCard?.(card.data || undefined)}
                onMouseEnter={() => {
                  setHoveredCardId(card.id)
                  onHoverCard?.(card.data || undefined)
                }}
                onMouseLeave={() => setHoveredCardId(null)}
                hoverDirection='left'
                isGhost={activeCard?.instanceId === card.id}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Token Generator Box ───────────────────────────────────────────────────

const TOKEN_DATA: CardData = {
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
  desc: 'This card can be used as any Monster Token. Drag into any zone or pile to generate a token.',
}

function TokenGeneratorBox({ onSelectCard, onHoverCard }: { onSelectCard?: (card?: CardData) => void; onHoverCard?: (card?: CardData) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'token-generator-card',
    data: {
      instanceId: 99999999,
      cardId: 99999999,
      fromZone: 'token_generator',
      data: TOKEN_DATA,
    },
  })

  return (
    <div className="flex items-center justify-center flex-1 py-0.5">
      <div
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        className={`relative cursor-grab active:cursor-grabbing transition-all duration-200 group rounded transform-gpu ${
          isDragging ? 'opacity-40 scale-95' : 'hover:-translate-y-1 hover:shadow-[0_0_12px_rgba(245,158,11,0.5)]'
        }`}
        onClick={() => onSelectCard?.(TOKEN_DATA)}
        onMouseEnter={() => onHoverCard?.(TOKEN_DATA)}
      >
        <img
          src={getCardImageUrl(99999999, 'small')}
          alt="Monster Token"
          className="w-[52px] h-[72px] object-cover rounded border border-amber-400/60 shadow"
        />
        <div className="absolute -top-1.5 -right-1.5 bg-amber-500 text-slate-950 font-black text-[10px] w-4 h-4 rounded-full flex items-center justify-center shadow-md border border-amber-300">
          ∞
        </div>
        <div className="absolute inset-x-0 bottom-0 bg-black/75 text-[8px] text-amber-200 font-bold text-center py-0.5 rounded-b opacity-95 group-hover:bg-amber-600 group-hover:text-black transition-colors">
          DRAG
        </div>
      </div>
    </div>
  )
}

// ─── Phase Tracker Bar ──────────────────────────────────────────────────────

const PHASE_LABELS: Record<Phase, string> = {
  dp: 'DRAW',
  sp: 'STANDBY',
  mp1: 'MAIN',
  bp: 'BATTLE',
  ep: 'END',
}
const PHASE_ORDER: Phase[] = ['dp', 'sp', 'mp1', 'bp', 'ep']

function PhaseTrackerBar({ phase, turn }: { phase: Phase; turn: 'player' | 'opponent' }) {
  const isPlayer = turn === 'player'
  const activeColor = isPlayer
    ? 'bg-blue-500 text-white shadow-[0_0_12px_rgba(59,130,246,0.7)]'
    : 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.7)]'
  const inactiveColor = isPlayer
    ? 'bg-blue-950/40 text-blue-300/50 border border-blue-800/30'
    : 'bg-rose-950/40 text-rose-300/50 border border-rose-800/30'

  return (
    <div className="flex items-center gap-0 px-3 py-1.5 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]/60 select-none">
      {/* Turn badge */}
      <div
        className={`text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-md mr-3 whitespace-nowrap transition-all duration-300 ${
          isPlayer ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40' : 'bg-rose-600/20 text-rose-300 border border-rose-600/40'
        }`}
      >
        {isPlayer ? '⚔ Your Turn' : '🛡 Opp Turn'}
      </div>

      {/* Phase pills connected with arrow chevrons */}
      <div className="flex items-center gap-0 flex-1">
        {PHASE_ORDER.map((p, idx) => {
          const isActive = p === phase
          const isPast = PHASE_ORDER.indexOf(p) < PHASE_ORDER.indexOf(phase)
          const pastColor = isPlayer
            ? 'bg-blue-900/30 text-blue-400/60 border border-blue-800/20'
            : 'bg-rose-900/30 text-rose-400/60 border border-rose-800/20'
          return (
            <div key={p} className="flex items-center">
              {/* Phase pill */}
              <div
                className={`relative px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest rounded-sm transition-all duration-300 ${
                  isActive ? activeColor : isPast ? pastColor : inactiveColor
                }`}
                style={{
                  clipPath: idx < PHASE_ORDER.length - 1
                    ? 'polygon(0 0, calc(100% - 6px) 0, 100% 50%, calc(100% - 6px) 100%, 0 100%, 6px 50%)'
                    : 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 6px 50%)',
                  paddingLeft: idx === 0 ? '10px' : '14px',
                  paddingRight: idx < PHASE_ORDER.length - 1 ? '14px' : '10px',
                }}
              >
                {PHASE_LABELS[p]}
              </div>
              {/* Gap between pills is handled by clipPath arrow shape — no extra element needed */}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Next Phase Button ───────────────────────────────────────────────────────

function NextPhaseButton({ onClick, phase, turn }: { onClick: () => void; phase: Phase; turn: 'player' | 'opponent' }) {
  const isLastPhase = phase === 'ep'
  const isPlayer = turn === 'player'

  const label = isLastPhase
    ? (isPlayer ? '→ Opp' : '→ Mine')
    : '▶ Next'

  const color = isLastPhase
    ? (isPlayer ? 'bg-rose-700/80 hover:bg-rose-600 border-rose-500/60 text-rose-100' : 'bg-blue-700/80 hover:bg-blue-600 border-blue-500/60 text-blue-100')
    : (isPlayer ? 'bg-blue-700/80 hover:bg-blue-600 border-blue-500/60 text-blue-100' : 'bg-rose-700/80 hover:bg-rose-600 border-rose-500/60 text-rose-100')

  return (
    <button
      type="button"
      onClick={onClick}
      title={isLastPhase ? 'End turn, switch to opponent' : 'Advance to next phase'}
      className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border transition-all duration-200 hover:scale-105 active:scale-95 shadow-md whitespace-nowrap ${color}`}
    >
      {label}
    </button>
  )
}

// ─── Skill Button ────────────────────────────────────────────────────────────

interface SkillActionButtonProps {
  onClick: () => void
  isActive: boolean
}

function SkillActionButton({ onClick, isActive }: SkillActionButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 transition-transform duration-200 hover:scale-105"
      title="Activate Skill"
    >
      <img
        src={skillIcon}
        alt="Skill"
        className={`
          w-14 h-14 transition-all duration-400
          ${isActive
            ? 'drop-shadow-[0_0_18px_rgba(250,204,21,0.95)] scale-110 animate-pulse'
            : ''}
        `}
      />
    </button>
  )
}

interface DraggableCardProps {
  card: CardInstance
  zone: string
  isFaceDown?: boolean
  isDefense?: boolean
  isGhost?: boolean
  isEffectActivated?: boolean
  hoverDirection: string
  onContextMenu: (e: React.MouseEvent, card: CardInstance, zone: string) => void
  onClick?: () => void
  onMouseEnter?: () => void
  onMouseLeave?: () => void
}

function DraggableCard({ card, zone, isFaceDown, isDefense, isEffectActivated, onContextMenu, onClick, onMouseEnter, onMouseLeave, hoverDirection = 'up', isGhost }: DraggableCardProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${zone}-${card.id}`,
    data: { instanceId: card.id, cardId: card.cardId, fromZone: zone, data: card.data },
  })

  const hoverClass =
    hoverDirection === 'left'
      ? 'hover:-translate-x-3'
      : 'hover:-translate-y-3'

  const dragClass =
    hoverDirection === 'left'
      ? '-translate-x-3'
      : '-translate-y-3'

  return (
    <div
      ref={setNodeRef}
      id={`card-${card.id}`}
      {...attributes}
      {...listeners}
      className={`relative cursor-grab active:cursor-grabbing transition-all duration-200 ease-out flex-shrink-0 rounded transform-gpu
        ${isDragging ? dragClass : `${hoverClass} hover:z-50`}
        ${isGhost ? 'opacity-20' : ''}
        ${isDefense ? 'rotate-90' : ''}
        ${isEffectActivated ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,0.95)] scale-110 z-50 animate-pulse' : ''}`}
      onContextMenu={(e) => onContextMenu(e, card, zone)}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <img
        src={getCardImageUrl(card.cardId, 'small')}
        alt={card.data?.name || ''}
        className={`card-thumbnail transition-all duration-200 ${isFaceDown ? 'brightness-35' : ''
          }`}
      />
    </div>
  )
}
