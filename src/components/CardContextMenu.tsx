import { useRef, useEffect } from 'react'
import type { CardInstance } from '../types'
import { POSITION, MONSTER_ZONES, SPELL_ZONES } from '../context/GameContext'

export interface CardContextMenuProps {
  x: number
  y: number
  card: CardInstance | null
  zone: string
  onAction: (action: string, card: CardInstance, zone: string) => void
  onClose: () => void
}

interface ActionItem {
  label?: string
  icon?: string
  action?: string
  sep?: boolean
}

/**
 * Context menu for card actions on the duel board.
 * Shows relevant actions based on the card's current zone.
 */
export default function CardContextMenu({ x, y, card, zone, onAction, onClose }: CardContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  if (!card) return null

  const isMonsterZone = (MONSTER_ZONES as readonly string[]).includes(zone)
  const isSpellZone = (SPELL_ZONES as readonly string[]).includes(zone)
  const isFieldZone = zone === 'field' || zone === 'extra_pile'
  const isHand = zone === 'hand'
  const isDeck = zone === 'deck'
  const isFree = zone === 'free'
  const isOnBoard = isMonsterZone || isSpellZone || isFieldZone

  const pos = card.position

  const isToken = card.cardId === 99999999 || card.data?.type === 'Token'

  const actions: ActionItem[] = [
    { label: 'Activate Effect', icon: '⚡', action: 'activate_effect' },
    ...(isToken ? [{ label: 'Remove Token', icon: '🗑️', action: 'remove_token' }] : []),
    { sep: true },
  ]

  if (isHand || isDeck || isFree) {
    actions.push({ label: 'Set (face-down DEF)', icon: '🔽', action: 'set_monster' })
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
  }

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
      <div
        className="bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded-lg shadow-xl overflow-hidden"
        style={{ width: menuWidth }}
      >
        <div className="px-3 py-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)]">
          <p className="text-xs font-semibold text-[var(--color-text-primary)] truncate">
            {card.data?.name || `Card #${card.cardId}`}
          </p>
          <p className="text-[10px] text-[var(--color-text-muted)]">{zone.toUpperCase()}</p>
        </div>
        <div className="py-1 max-h-80 overflow-y-auto">
          {actions.map((item, i) =>
            item.sep ? (
              <div key={i} className="my-1 border-t border-[var(--color-border)]" />
            ) : (
              <button
                key={i}
                onClick={() => {
                  if (item.action) onAction(item.action, card, zone)
                  onClose()
                }}
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
