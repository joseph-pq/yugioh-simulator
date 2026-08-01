import { useState, useCallback, useEffect } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useGame, ZONES, POSITION, MONSTER_ZONES, SPELL_ZONES } from '../context/GameContext'
import { getCardImageUrl } from '../services/ygoproApi'
import CardContextMenu from './CardContextMenu'

/**
 * Main Duel Board — Exact Duel Links Field Layout with:
 * - Flying card drag animation during record playback
 * - Dynamic vertical card spacing in GY and Banish piles so all cards remain visible regardless of count
 * - Highlight glow animation reserved exclusively for Effect Activation
 */
export default function DuelBoard({ onSelectCard, onHoverCard }) {
  const game = useGame()
  const { board } = game
  const [contextMenu, setContextMenu] = useState(null)
  const [activeCard, setActiveCard] = useState(null)
  const [effectCardId, setEffectCardId] = useState(null) // Glow ONLY when effect is activated
  const [flyingCard, setFlyingCard] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  // Animated Flying Drag Movement during Record Playback
  useEffect(() => {
    if (game.playbackIndex >= 0 && game.combo[game.playbackIndex]) {
      const step = game.combo[game.playbackIndex]
      const cardId = step.i || step.instanceId
      const fromZone = step.f || step.from
      const toZone = step.t || step.to

      if (cardId && fromZone && toZone && fromZone !== toZone) {
        const fromEl = document.getElementById(`zone-${fromZone}`)
        const toEl = document.getElementById(`zone-${toZone}`)

        if (fromEl && toEl) {
          const startRect = fromEl.getBoundingClientRect()
          const endRect = toEl.getBoundingClientRect()
          const cardImgId = step.cardId || step.card?.id || 99999999

          setFlyingCard({
            id: cardId,
            cardId: cardImgId,
            start: { x: startRect.left + startRect.width / 2 - 25, y: startRect.top + startRect.height / 2 - 35 },
            end: { x: endRect.left + endRect.width / 2 - 25, y: endRect.top + endRect.height / 2 - 35 },
            animating: false,
          })

          const animTimer = setTimeout(() => {
            setFlyingCard(prev => prev ? { ...prev, animating: true } : null)
          }, 20)

          const endTimer = setTimeout(() => {
            setFlyingCard(null)
          }, 550)

          return () => {
            clearTimeout(animTimer)
            clearTimeout(endTimer)
          }
        }
      }
    }
  }, [game.playbackIndex, game.combo])

  const handleDragStart = useCallback((event) => {
    const { active } = event
    setActiveCard(active.data.current)
  }, [])

  const handleDragEnd = useCallback((event) => {
    const { active, over } = event
    setActiveCard(null)
    if (!over || !active.data.current) return

    const { instanceId, fromZone } = active.data.current
    const toZone = over.id

    if (fromZone === toZone) return

    let position = POSITION.FACE_UP_ATK
    if (SPELL_ZONES.includes(toZone) || toZone === ZONES.FIELD || toZone === ZONES.EXTRA_PILE) {
      position = POSITION.FACE_UP
    }

    game.moveCard(instanceId, fromZone, toZone, position)
  }, [game])

  const handleContextMenu = useCallback((e, card, zone) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, card, zone })
  }, [])

  const handleContextAction = useCallback((action, card, zone) => {
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
        const target = MONSTER_ZONES.find(z => !board[z])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_UP_ATK)
        break
      }
      case 'ss_def': {
        const target = MONSTER_ZONES.find(z => !board[z])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_UP_DEF)
        break
      }
      case 'set_monster': {
        const target = MONSTER_ZONES.find(z => !board[z])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_DOWN_DEF)
        break
      }
      case 'set_st': {
        const target = SPELL_ZONES.find(z => !board[z])
        if (target) game.moveCard(id, zone, target, POSITION.FACE_DOWN)
        break
      }
      case 'set_field':
        game.moveCard(id, zone, ZONES.FIELD, POSITION.FACE_UP)
        break
      case 'to_gy':
        game.sendToGY(id, zone)
        break
      case 'to_banish':
        game.sendToBanish(id, zone)
        break
      case 'to_hand':
        game.addToHand(id, zone)
        break
      case 'to_deck_top':
        game.returnToDeck(id, zone, true)
        break
      case 'to_deck_bottom':
        game.returnToDeck(id, zone, false)
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

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex flex-col h-full select-none justify-between overflow-hidden">
        {/* Main Duel Field Area */}
        <div className="flex-1 flex items-center justify-center p-2 min-h-0">
          <div className="flex items-center justify-center gap-3 w-full max-w-4xl">

            {/* Left: FREE Zone (Vertical Rectangle Stack) */}
            <VerticalStackPileZone
              zone={ZONES.FREE}
              cards={board.free}
              label="FREE"
              color="var(--color-text-muted)"
              effectCardId={effectCardId}
              onContextMenu={handleContextMenu}
              onSelectCard={onSelectCard}
              onHoverCard={onHoverCard}
            />

            {/* Left Column 2: FIELD (Top) & EXTRA (Bottom) */}
            <div className="flex flex-col justify-between gap-3 h-[200px]">
              <BoardZone zone={ZONES.FIELD} card={board.field} label="" outlineColor="border-yellow-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
              <BoardZone zone={ZONES.EXTRA_PILE} card={board.extra_pile} label="" outlineColor="border-slate-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
            </div>

            {/* Center: EMZs (Top), Monster Zones (Middle), Spell/Trap Zones (Bottom) */}
            <div className="flex flex-col gap-2.5 items-center">
              {/* Spell/Trap Row: E S/T1, E S/T2, E S/T3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.EST1} card={board.est1} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.EST2} card={board.est2} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.EST3} card={board.est3} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
              </div>
              {/* Monster Row: EM1, EM2, EM3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.EM1} card={board.em1} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.EM2} card={board.em2} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.EM3} card={board.em3} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
              </div>

              {/* EMZ Row */}
              <div className="flex justify-center gap-22 py-0.5">
                <BoardZone zone={ZONES.EMZ1} card={board.emz1} label="" outlineColor="border-purple-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.EMZ2} card={board.emz2} label="" outlineColor="border-purple-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
              </div>

              {/* Monster Row: M1, M2, M3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.M1} card={board.m1} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.M2} card={board.m2} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.M3} card={board.m3} label="" outlineColor="border-blue-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
              </div>

              {/* Spell/Trap Row: S/T1, S/T2, S/T3 */}
              <div className="flex gap-3">
                <BoardZone zone={ZONES.ST1} card={board.st1} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.ST2} card={board.st2} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
                <BoardZone zone={ZONES.ST3} card={board.st3} label="" outlineColor="border-emerald-600/50" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
              </div>
            </div>

            {/* Right: GRAVE & BANISH Vertical Rectangle Stacked Piles */}
            <div className="flex gap-2.5">
              <VerticalStackPileZone zone={ZONES.GY} cards={board.gy} label="GRAVE" color="var(--color-accent-rose)" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
              <VerticalStackPileZone zone={ZONES.BANISH} cards={board.banish} label="BANISH" color="var(--color-accent-blue)" effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} />
            </div>

          </div>
        </div>

        {/* Hand & Extra Deck Pools */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 px-3 py-1.5 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          <div className="col-span-1 border border-dashed border-[var(--color-accent-blue)]/30 rounded-lg bg-[var(--color-bg-primary)]/40 p-1.5">
            <div className="text-[10px] font-bold text-[var(--color-accent-blue)] mb-0.5 uppercase tracking-wider">Hand ({board.hand.length})</div>
            {/* <HandZone cards={board.hand} effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} /> */}
            <HorizontalStackPileZone
              zone={ZONES.HAND}
              cards={board.hand}
              effectCardId={effectCardId}
              onContextMenu={handleContextMenu}
              onSelectCard={onSelectCard}
              onHoverCard={onHoverCard}
            />
          </div>

          <div className="col-span-2 border border-dashed border-[var(--color-accent-purple)]/30 rounded-lg bg-[var(--color-bg-primary)]/40 p-1.5">
            <div className="text-[10px] font-bold text-[var(--color-accent-purple)] mb-0.5 uppercase tracking-wider">Extra Deck ({board.extra.length})</div>
            {/* <ExtraDeckZone cards={board.extra} effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} /> */}
            <HorizontalStackPileZone
              zone={ZONES.EXTRA}
              cards={board.extra}
              effectCardId={effectCardId}
              onContextMenu={handleContextMenu}
              onSelectCard={onSelectCard}
              onHoverCard={onHoverCard}
            />
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
            {/* <DeckZone cards={board.deck} effectCardId={effectCardId} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} onHoverCard={onHoverCard} /> */}
            <HorizontalStackPileZone
              zone={ZONES.DECK}
              cards={board.deck}
              effectCardId={effectCardId}
              onContextMenu={handleContextMenu}
              onSelectCard={onSelectCard}
              onHoverCard={onHoverCard}
            />
          </div>
        </div>
      </div>

      {/* Manual Drag Overlay */}
      <DragOverlay dropAnimation={null}>
        {activeCard?.data ? (
          <img src={getCardImageUrl(activeCard.data.id || activeCard.cardId, 'small')} alt="" className="card-thumbnail opacity-85 rotate-2 shadow-2xl" />
        ) : null}
      </DragOverlay>

      {/* Animated Flying Drag Overlay during Record Playback */}
      {flyingCard && (
        <div
          className="fixed z-[999] pointer-events-none transition-all duration-500 ease-in-out transform-gpu shadow-2xl rounded"
          style={{
            left: `${flyingCard.animating ? flyingCard.end.x : flyingCard.start.x}px`,
            top: `${flyingCard.animating ? flyingCard.end.y : flyingCard.start.y}px`,
            width: '56px',
            height: '80px',
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

function BoardZone({ zone, card, label, outlineColor, effectCardId, onContextMenu, onSelectCard, onHoverCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  const isFaceDown = card?.position === POSITION.FACE_DOWN_DEF || card?.position === POSITION.FACE_DOWN
  const isDefense = card?.position === POSITION.FACE_UP_DEF || card?.position === POSITION.FACE_DOWN_DEF

  return (
    <div
      ref={setNodeRef}
      id={`zone-${zone}`}
      className={`relative w-[64px] h-[86px] rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-200
        ${isOver ? 'border-[var(--color-gold-400)] bg-[var(--color-gold-500)]/10 scale-105' : `${outlineColor || 'border-[var(--color-border)]'} bg-[var(--color-bg-tertiary)]/50`}
        ${card ? 'border-solid' : ''}`}
    >
      {card ? (
        <DraggableCard
          card={card}
          zone={zone}
          isFaceDown={isFaceDown}
          isDefense={isDefense}
          isEffectActivated={card.id === effectCardId}
          onContextMenu={onContextMenu}
          onClick={() => onSelectCard?.(card.data)}
          onMouseEnter={() => onHoverCard?.(card.data)}
        />
      ) : (
        <span className="text-[9px] text-[var(--color-text-muted)] font-bold font-sans uppercase tracking-wider">{label}</span>
      )}
    </div>
  )
}
function HorizontalStackPileZone({
  zone,
  cards,
  effectCardId,
  onContextMenu,
  onSelectCard,
  onHoverCard,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })

  const [hoveredCardId, setHoveredCardId] = useState(null)

  const cardWidth = 56
  const availableWidth = 1100 // adjust to your container
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

  return (
    <div
      ref={setNodeRef}
      id={`zone-${zone}`}
      className={`relative flex items-start min-h-[78px] overflow-hidden transition-colors duration-200 ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''
        }`}
    >
      {cards.length === 0 ? (
        <span className="m-auto text-[10px] text-[var(--color-text-muted)] font-mono">
          Empty
        </span>
      ) : (
        cards.map((card, idx) => (
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
              onClick={() => onSelectCard?.(card.data)}
              onMouseEnter={() => {
                setHoveredCardId(card.id)
                onHoverCard?.(card.data)
              }}
              onMouseLeave={() => setHoveredCardId(null)}
            />
          </div>
        ))
      )}
    </div>
  )
}

function VerticalStackPileZone({ zone, cards, label, color, effectCardId, onContextMenu, onSelectCard, onHoverCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  const [hoveredCardId, setHoveredCardId] = useState(null)

  const availableHeight = 210 // space available for cards
  const cardHeight = 86

  let stepOffset = cardHeight + 1
  const cardCount = cards.length

  if (cardCount > 1) {
    // Total height if cards don't overlap
    const requiredHeight = cardHeight * cardCount

    if (requiredHeight > availableHeight) {
      // Compress spacing only when we run out of room
      stepOffset = Math.max(
        4,
        Math.floor((availableHeight - cardHeight) / (cardCount - 1))
      )
    }
  }

  const overlapMargin = stepOffset - cardHeight

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

      {cards.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-[8px] text-[var(--color-text-muted)] font-mono">
          {/* Empty */}
        </div>
      ) : (
        /* Dynamic Vertical Stack Cascade */
        <div className="relative flex flex-col items-center w-full flex-1 pt-1 overflow-hidden">
          {cards.map((card, idx) => (
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
                onClick={() => onSelectCard?.(card.data)}
                onMouseEnter={() => {
                  setHoveredCardId(card.id)
                  onHoverCard?.(card.data)
                }}
                onMouseLeave={() => setHoveredCardId(null)}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HandZone({ cards, effectCardId, onContextMenu, onSelectCard, onHoverCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONES.HAND })

  return (
    <div
      ref={setNodeRef}
      id={`zone-${ZONES.HAND}`}
      className={`flex flex-wrap gap-1 p-0.5 min-h-[78px] transition-colors duration-200 ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''}`}
    >
      {cards.length === 0 ? (
        <span className="text-[10px] text-[var(--color-text-muted)] m-auto font-mono">Empty Hand</span>
      ) : (
        cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            zone={ZONES.HAND}
            isEffectActivated={card.id === effectCardId}
            onContextMenu={onContextMenu}
            onClick={() => onSelectCard?.(card.data)}
            onMouseEnter={() => onHoverCard?.(card.data)}
          />
        ))
      )}
    </div>
  )
}

function ExtraDeckZone({ cards, effectCardId, onContextMenu, onSelectCard, onHoverCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONES.EXTRA })

  return (
    <div
      ref={setNodeRef}
      id={`zone-${ZONES.EXTRA}`}
      className={`flex flex-wrap gap-1 p-0.5 min-h-[78px] transition-colors duration-200 ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''}`}
    >
      {cards.length === 0 ? (
        <span className="text-[10px] text-[var(--color-text-muted)] m-auto font-mono">Empty Extra Deck</span>
      ) : (
        cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            zone={ZONES.EXTRA}
            isEffectActivated={card.id === effectCardId}
            onContextMenu={onContextMenu}
            onClick={() => onSelectCard?.(card.data)}
            onMouseEnter={() => onHoverCard?.(card.data)}
          />
        ))
      )}
    </div>
  )
}

function DeckZone({ cards, effectCardId, onContextMenu, onSelectCard, onHoverCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONES.DECK })

  return (
    <div
      ref={setNodeRef}
      id={`zone-${ZONES.DECK}`}
      className={`flex flex-wrap gap-1 p-0.5 min-h-[78px] max-h-[180px] overflow-y-auto transition-colors duration-200 ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''}`}
    >
      {cards.length === 0 ? (
        <span className="text-[10px] text-[var(--color-text-muted)] m-auto font-mono">Empty Deck</span>
      ) : (
        cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            zone={ZONES.DECK}
            isEffectActivated={card.id === effectCardId}
            onContextMenu={onContextMenu}
            onClick={() => onSelectCard?.(card.data)}
            onMouseEnter={() => onHoverCard?.(card.data)}
          />
        ))
      )}
    </div>
  )
}

function DraggableCard({ card, zone, isFaceDown, isDefense, isEffectActivated, onContextMenu, onClick, onMouseEnter, onMouseLeave }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${zone}-${card.id}`,
    data: { instanceId: card.id, cardId: card.cardId, fromZone: zone, data: card.data },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`relative cursor-grab active:cursor-grabbing transition-all duration-200 ease-out flex-shrink-0 rounded transform-gpu
        ${isDragging ? 'opacity-30 scale-90' : 'hover:scale-110 hover:z-50 shadow-md'}
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
