import { useState, useCallback } from 'react'
import { DndContext, DragOverlay, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { useGame, ZONES, POSITION, MONSTER_ZONES, SPELL_ZONES } from '../context/GameContext'
import { getCardImageUrl } from '../services/ygoproApi'
import CardContextMenu from './CardContextMenu'

/**
 * Main Duel Board — the VRAINS / Duel Links board layout.
 */
export default function DuelBoard({ onSelectCard }) {
  const game = useGame()
  const { board } = game
  const [contextMenu, setContextMenu] = useState(null)
  const [activeCard, setActiveCard] = useState(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

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

    // Determine position based on target zone
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
      <div className="flex flex-col h-full select-none justify-between">
        {/* Top Bar — LP & Deck info */}
        <div className="px-4 py-2 flex items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--color-text-muted)]">
              Deck: <span className="text-[var(--color-text-primary)] font-semibold">{board.deck.length}</span>
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              Extra: <span className="text-[var(--color-accent-purple)] font-semibold">{board.extra.length}</span>
            </span>
          </div>
          <LPCounter lp={board.lp} onChange={game.setLP} />
          <div className="flex items-center gap-4">
            <span className="text-xs text-[var(--color-text-muted)]">
              GY: <span className="text-[var(--color-accent-rose)] font-semibold">{board.gy.length}</span>
            </span>
            <span className="text-xs text-[var(--color-text-muted)]">
              Banish: <span className="text-[var(--color-accent-blue)] font-semibold">{board.banish.length}</span>
            </span>
          </div>
        </div>

        {/* Board grid (Exactly matches user screenshot) */}
        <div className="flex-1 flex items-center justify-center p-3">
          <div className="grid grid-cols-7 gap-3 items-center justify-center w-full max-w-3xl">
            {/* Column 1: Free Zone (Spans 3 Rows) */}
            <div className="row-span-3 flex items-center justify-center h-full">
              <TallPileZone zone={ZONES.FREE} cards={board.free} label="Free" color="var(--color-text-muted)" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
            </div>

            {/* Column 2: Field / Extra Pile (Spans 3 Rows) */}
            <div className="row-span-3 flex flex-col justify-between h-full min-h-[300px] items-center py-1">
              <BoardZone zone={ZONES.FIELD} card={board.field} label="FIELD" outlineColor="border-yellow-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
              <BoardZone zone={ZONES.EXTRA_PILE} card={board.extra_pile} label="EXTRA" outlineColor="border-slate-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
            </div>

            {/* Column 3, 4, 5: EMZ / Monsters / Spells & Traps */}
            {/* Row 1: Extra Monster Zones */}
            <div className="col-span-3 flex justify-center gap-12 py-1">
              <BoardZone zone={ZONES.EMZ1} card={board.emz1} label="EMZ" outlineColor="border-purple-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
              <BoardZone zone={ZONES.EMZ2} card={board.emz2} label="EMZ" outlineColor="border-purple-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
            </div>

            {/* Row 2: Monster Zones */}
            <div className="col-span-3 grid grid-cols-3 gap-2 justify-items-center">
              <BoardZone zone={ZONES.M1} card={board.m1} label="M" outlineColor="border-blue-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
              <BoardZone zone={ZONES.M2} card={board.m2} label="M" outlineColor="border-blue-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
              <BoardZone zone={ZONES.M3} card={board.m3} label="M" outlineColor="border-blue-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
            </div>

            {/* Row 3: Spell/Trap Zones */}
            <div className="col-span-3 grid grid-cols-3 gap-2 justify-items-center">
              <BoardZone zone={ZONES.ST1} card={board.st1} label="S/T" outlineColor="border-emerald-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
              <BoardZone zone={ZONES.ST2} card={board.st2} label="S/T" outlineColor="border-emerald-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
              <BoardZone zone={ZONES.ST3} card={board.st3} label="S/T" outlineColor="border-emerald-600/50" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
            </div>

            {/* Column 6: Grave Zone (Spans 3 Rows) */}
            <div className="row-span-3 flex items-center justify-center h-full">
              <TallPileZone zone={ZONES.GY} cards={board.gy} label="Grave" color="var(--color-accent-rose)" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
            </div>

            {/* Column 7: Banish Zone (Spans 3 Rows) */}
            <div className="row-span-3 flex items-center justify-center h-full">
              <TallPileZone zone={ZONES.BANISH} cards={board.banish} label="Banish" color="var(--color-accent-blue)" onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
            </div>
          </div>
        </div>

        {/* Hand & Extra Deck Pools side-by-side */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          <div className="col-span-1 border border-dashed border-[var(--color-accent-blue)]/30 rounded-xl bg-[var(--color-bg-primary)]/40 p-2">
            <div className="text-[10px] font-bold text-[var(--color-accent-blue)] mb-1 uppercase tracking-wider">Hand ({board.hand.length})</div>
            <HandZone cards={board.hand} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
          </div>

          <div className="col-span-2 border border-dashed border-[var(--color-accent-purple)]/30 rounded-xl bg-[var(--color-bg-primary)]/40 p-2">
            <div className="text-[10px] font-bold text-[var(--color-accent-purple)] mb-1 uppercase tracking-wider">Extra Deck ({board.extra.length})</div>
            <ExtraDeckZone cards={board.extra} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
          </div>
        </div>

        {/* Main Deck visible at bottom */}
        <div className="px-4 py-2 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)]/50">
          <div className="border border-dashed border-[var(--color-text-muted)]/30 rounded-xl bg-[var(--color-bg-primary)]/40 p-2">
            <div className="text-[10px] font-bold text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wider flex items-center justify-between">
              <span>Deck ({board.deck.length})</span>
              <button onClick={game.shuffleDeck} className="px-2 py-0.5 rounded bg-[var(--color-bg-tertiary)] text-[9px] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-colors">
                🔀 Shuffle Deck
              </button>
            </div>
            <DeckZone cards={board.deck} onContextMenu={handleContextMenu} onSelectCard={onSelectCard} />
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeCard?.data ? (
          <img src={getCardImageUrl(activeCard.data.id || activeCard.cardId, 'small')} alt="" className="card-thumbnail opacity-85 rotate-2 shadow-2xl" />
        ) : null}
      </DragOverlay>

      {/* Context menu */}
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

// ==================== Sub-components ====================

function BoardZone({ zone, card, label, outlineColor, onContextMenu, onSelectCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })
  const isFaceDown = card?.position === POSITION.FACE_DOWN_DEF || card?.position === POSITION.FACE_DOWN
  const isDefense = card?.position === POSITION.FACE_UP_DEF || card?.position === POSITION.FACE_DOWN_DEF

  return (
    <div
      ref={setNodeRef}
      className={`relative w-[68px] h-[92px] rounded-lg border-2 border-dashed flex items-center justify-center transition-all duration-200
        ${isOver ? 'border-[var(--color-gold-400)] bg-[var(--color-gold-500)]/10 scale-105' : `${outlineColor || 'border-[var(--color-border)]'} bg-[var(--color-bg-tertiary)]/50`}
        ${card ? 'border-solid' : ''}`}
    >
      {card ? (
        <DraggableCard card={card} zone={zone} isFaceDown={isFaceDown} isDefense={isDefense} onContextMenu={onContextMenu} onClick={() => onSelectCard?.(card.data)} />
      ) : (
        <span className="text-[9px] text-[var(--color-text-muted)] font-bold font-sans uppercase tracking-wider">{label}</span>
      )}
    </div>
  )
}

function TallPileZone({ zone, cards, label, color, onContextMenu, onSelectCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: zone })

  return (
    <div
      ref={setNodeRef}
      className={`relative w-[76px] h-[216px] rounded-lg border-2 border-dashed flex flex-col items-center justify-between p-1.5 transition-all duration-200
        ${isOver ? 'border-[var(--color-gold-400)] bg-[var(--color-gold-500)]/10 scale-105' : `border-[var(--color-border)] bg-[var(--color-bg-tertiary)]/30`}`}
      style={{ borderColor: isOver ? undefined : color }}
    >
      <div className="flex-1 w-full overflow-y-auto flex flex-col gap-1 items-center justify-start py-0.5 scrollbar-thin">
        {cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            zone={zone}
            onContextMenu={onContextMenu}
            onClick={() => onSelectCard?.(card.data)}
          />
        ))}
      </div>
      <span className="text-[9px] font-bold uppercase tracking-wider text-center mt-1" style={{ color }}>
        {label} ({cards.length})
      </span>
    </div>
  )
}

function HandZone({ cards, onContextMenu, onSelectCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONES.HAND })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap gap-1.5 p-1 min-h-[96px] max-h-[110px] overflow-y-auto transition-colors duration-200
        ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''}`}
    >
      {cards.length === 0 ? (
        <span className="text-xs text-[var(--color-text-muted)] m-auto font-mono">Empty Hand</span>
      ) : (
        cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            zone={ZONES.HAND}
            onContextMenu={onContextMenu}
            onClick={() => onSelectCard?.(card.data)}
          />
        ))
      )}
    </div>
  )
}

function ExtraDeckZone({ cards, onContextMenu, onSelectCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONES.EXTRA })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap gap-1.5 p-1 min-h-[96px] max-h-[110px] overflow-y-auto transition-colors duration-200
        ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''}`}
    >
      {cards.length === 0 ? (
        <span className="text-xs text-[var(--color-text-muted)] m-auto font-mono">Empty Extra Deck</span>
      ) : (
        cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            zone={ZONES.EXTRA}
            onContextMenu={onContextMenu}
            onClick={() => onSelectCard?.(card.data)}
          />
        ))
      )}
    </div>
  )
}

function DeckZone({ cards, onContextMenu, onSelectCard }) {
  const { setNodeRef, isOver } = useDroppable({ id: ZONES.DECK })

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-wrap gap-1.5 p-1 min-h-[96px] max-h-[140px] overflow-y-auto transition-colors duration-200
        ${isOver ? 'bg-[var(--color-gold-500)]/5' : ''}`}
    >
      {cards.length === 0 ? (
        <span className="text-xs text-[var(--color-text-muted)] m-auto font-mono">Empty Deck</span>
      ) : (
        cards.map((card) => (
          <DraggableCard
            key={card.id}
            card={card}
            zone={ZONES.DECK}
            onContextMenu={onContextMenu}
            onClick={() => onSelectCard?.(card.data)}
          />
        ))
      )}
    </div>
  )
}

function DraggableCard({ card, zone, isFaceDown, isDefense, onContextMenu, onClick }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${zone}-${card.id}`,
    data: { instanceId: card.id, cardId: card.cardId, fromZone: zone, data: card.data },
  })

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={`relative cursor-grab active:cursor-grabbing transition-all duration-150 flex-shrink-0
        ${isDragging ? 'opacity-30 scale-90' : 'hover:scale-105 hover:z-10'}
        ${isDefense ? 'rotate-90' : ''}`}
      onContextMenu={(e) => onContextMenu(e, card, zone)}
      onClick={onClick}
    >
      {isFaceDown ? (
        <div className="card-thumbnail bg-gradient-to-br from-[#1a1a5e] to-[#0d0d3d] border border-[var(--color-border)] flex items-center justify-center">
          <div className="w-6 h-8 border border-[var(--color-gold-600)]/40 rounded-sm bg-[var(--color-gold-700)]/10" />
        </div>
      ) : (
        <img src={getCardImageUrl(card.cardId, 'small')} alt={card.data?.name || ''} className="card-thumbnail" />
      )}
    </div>
  )
}

function LPCounter({ lp, onChange }) {
  const [editing, setEditing] = useState(false)
  const [tempLp, setTempLp] = useState(String(lp))

  const handleSubmit = () => {
    const val = parseInt(tempLp) || 0
    onChange(Math.max(0, val))
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        value={tempLp}
        onChange={(e) => setTempLp(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        className="w-20 text-center text-sm font-bold bg-[var(--color-bg-tertiary)] border border-[var(--color-gold-500)] rounded px-1 py-0.5 text-[var(--color-gold-400)] focus:outline-none"
        autoFocus
      />
    )
  }

  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(lp - 100)} className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-accent-rose)] text-xs hover:bg-[var(--color-bg-hover)] transition-colors">−</button>
      <button onClick={() => setEditing(true)} className="px-3 py-0.5 rounded bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] hover:border-[var(--color-gold-500)] transition-colors">
        <span className="text-[10px] text-[var(--color-text-muted)]">LP</span>
        <span className="ml-1 text-sm font-bold text-[var(--color-gold-400)]">{lp}</span>
      </button>
      <button onClick={() => onChange(lp + 100)} className="w-6 h-6 rounded bg-[var(--color-bg-tertiary)] text-[var(--color-accent-teal)] text-xs hover:bg-[var(--color-bg-hover)] transition-colors">+</button>
    </div>
  )
}
