import { useState, useRef, useEffect } from 'react'
import { POSITION, MONSTER_ZONES, SPELL_ZONES } from '../context/GameContext'
import { getCardImageUrl } from '../services/ygoproApi'

/**
 * Context menu for card actions on the duel board.
 * Shows relevant actions based on the card's current zone.
 */
export default function CardContextMenu({ x, y, card, zone, onAction, onClose }) {
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose()
    }
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  if (!card) return null

  const isMonsterZone = MONSTER_ZONES.includes(zone)
  const isSpellZone = SPELL_ZONES.includes(zone)
  const isFieldZone = zone === 'field' || zone === 'extra_pile'
  const isHand = zone === 'hand'
  const isGY = zone === 'gy'
  const isBanish = zone === 'banish'
  const isExtra = zone === 'extra'
  const isDeck = zone === 'deck'
  const isFree = zone === 'free'
  const isOnBoard = isMonsterZone || isSpellZone || isFieldZone

  const pos = card.position

  const isToken = card.cardId === 99999999 || card.data?.type === 'Token'

  const actions = [
    { label: 'Activate Effect', icon: '⚡', action: 'activate_effect' },
    ...(isToken ? [{ label: 'Remove Token', icon: '🗑️', action: 'remove_token' }] : []),
    { sep: true }
  ]

  if (isHand || isDeck || isFree) {
    // actions.push({ label: 'Normal Summon (ATK)', icon: '⚔️', action: 'summon_atk' })
    actions.push({ label: 'Set (face-down DEF)', icon: '🔽', action: 'set_monster' })
    // actions.push({ label: 'Special Summon (ATK)', icon: '✨', action: 'ss_atk' })
    // actions.push({ label: 'Special Summon (DEF)', icon: '🛡️', action: 'ss_def' })
    // actions.push({ label: 'Activate / Set S/T', icon: '🪄', action: 'set_st' })
    // actions.push({ label: 'Set as Field Spell', icon: '🌍', action: 'set_field' })
    // actions.push({ sep: true })
    // actions.push({ label: 'Send to GY', icon: '💀', action: 'to_gy' })
    // actions.push({ label: 'Banish', icon: '🚫', action: 'to_banish' })
    // if (!isDeck) {
    //   actions.push({ label: 'Return to Deck (top)', icon: '🔝', action: 'to_deck_top' })
    //   actions.push({ label: 'Return to Deck (bottom)', icon: '🔚', action: 'to_deck_bottom' })
    // }
    // if (!isHand) {
    //   actions.push({ label: 'Add to Hand', icon: '✋', action: 'to_hand' })
    // }
  }

  if (isOnBoard) {
    if (isMonsterZone) {
      if (pos === POSITION.FACE_DOWN_DEF) {
        actions.push({ label: 'Flip face-up (ATK)', icon: '🔄', action: 'flip_atk' })
        actions.push({ label: 'Flip face-up (DEF)', icon: '🔃', action: 'flip_def' })
      } else if (pos === POSITION.FACE_UP_ATK) {
        actions.push({ label: 'Change to DEF', icon: '🛡️', action: 'to_def' })
        actions.push({ label: 'Set face-down', icon: '🔽', action: 'to_facedown' })
      } else {
        actions.push({ label: 'Change to ATK', icon: '⚔️', action: 'to_atk' })
        actions.push({ label: 'Set face-down', icon: '🔽', action: 'to_facedown' })
      }
    }
    if (isSpellZone || isFieldZone) {
      if (pos === POSITION.FACE_DOWN) {
        actions.push({ label: 'Flip face-up', icon: '🔄', action: 'flip_up' })
      } else {
        actions.push({ label: 'Set face-down', icon: '🔽', action: 'to_facedown_st' })
      }
    }
    // actions.push({ sep: true })
    // actions.push({ label: 'Send to GY', icon: '💀', action: 'to_gy' })
    // actions.push({ label: 'Banish', icon: '🚫', action: 'to_banish' })
    // actions.push({ label: 'Add to Hand', icon: '✋', action: 'to_hand' })
    // actions.push({ label: 'Return to Deck (top)', icon: '🔝', action: 'to_deck_top' })
  }

  // if (isGY || isBanish) {
    // actions.push({ label: 'Special Summon (ATK)', icon: '✨', action: 'ss_atk' })
    // actions.push({ label: 'Special Summon (DEF)', icon: '🛡️', action: 'ss_def' })
    // actions.push({ label: 'Add to Hand', icon: '✋', action: 'to_hand' })
    // actions.push({ label: 'Return to Deck (top)', icon: '🔝', action: 'to_deck_top' })
    // if (isGY) actions.push({ label: 'Banish', icon: '🚫', action: 'to_banish' })
    // if (isBanish) actions.push({ label: 'Send to GY', icon: '💀', action: 'to_gy' })
  // }

//   if (isExtra) {
//     actions.push({ label: 'Special Summon (ATK)', icon: '✨', action: 'ss_atk' })
//     actions.push({ label: 'Special Summon (DEF)', icon: '🛡️', action: 'ss_def' })
//     actions.push({ label: 'Add to Hand', icon: '✋', action: 'to_hand' })
//   }

  // Clamp position to viewport
  const menuWidth = 220
  const menuHeight = actions.length * 34
  const clampedX = Math.min(x, window.innerWidth - menuWidth - 8)
  const clampedY = Math.min(y, window.innerHeight - menuHeight - 8)

  return (
    <div
      ref={menuRef}
      className="fixed z-[100] animate-fade-in"
      style={{ left: clampedX, top: clampedY }}
    >
      {/* Card name header */}
      <div className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden" style={{ width: menuWidth }}>
        <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
          <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{card.data?.name || `Card #${card.cardId}`}</p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{zone.toUpperCase()}</p>
        </div>
        <div className="py-1 max-h-80 overflow-y-auto">
          {actions.map((item, i) =>
            item.sep ? (
              <div key={i} className="my-1 border-t border-[var(--color-border)]" />
            ) : (
              <button
                key={i}
                onClick={() => { onAction(item.action, card, zone); onClose() }}
                className="w-full px-3 py-1.5 text-left text-xs flex items-center gap-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors"
              >
                <span className="w-5 text-center">{item.icon}</span>
                {item.label}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
