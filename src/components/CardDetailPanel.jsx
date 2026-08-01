import { useState, useCallback } from 'react'
import { getCardImageUrl } from '../services/ygoproApi'

/**
 * Side panel showing full card art, name, type, stats, and description.
 * Appears on the right side of the screen when a card is selected.
 */
export default function CardDetailPanel({ card, onClose, onAddCard }) {
  const [imgLoaded, setImgLoaded] = useState(false)

  if (!card) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <div className="w-20 h-20 rounded-2xl bg-[var(--color-bg-tertiary)] flex items-center justify-center mb-4">
          <svg className="w-8 h-8 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
        </div>
        <p className="text-sm text-[var(--color-text-muted)]">Select a card to view details</p>
      </div>
    )
  }

  const frameColor = getFrameColor(card.frameType)

  return (
    <div className="h-full flex flex-col animate-fade-in overflow-y-auto">
      {/* Close button */}
      {onClose && (
        <button onClick={onClose} className="absolute top-3 right-3 z-10 w-7 h-7 rounded-full bg-[var(--color-bg-tertiary)] flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)] transition-colors">
          ✕
        </button>
      )}

      {/* Card image */}
      <div className="relative px-6 pt-5 pb-3 flex justify-center">
        {!imgLoaded && (
          <div className="w-[140px] h-[204px] rounded-lg loading-shimmer" />
        )}
        <img
          src={getCardImageUrl(card.id, 'full')}
          alt={card.name}
          className={`w-[140px] rounded-lg shadow-[var(--shadow-card)] transition-opacity duration-300 ${imgLoaded ? 'opacity-100' : 'opacity-0 absolute'}`}
          onLoad={() => setImgLoaded(true)}
          loading="eager"
        />
      </div>

      {/* Card info */}
      <div className="px-5 pb-5 flex-1 flex flex-col gap-3">
        {/* Name */}
        <h2 className="text-lg font-bold text-[var(--color-text-primary)] leading-snug">
          {card.name}
        </h2>

        {/* Type badge */}
        <div className="flex flex-wrap gap-1.5">
          <span
            className="px-2.5 py-0.5 rounded-full text-xs font-semibold"
            style={{ backgroundColor: frameColor + '25', color: frameColor }}
          >
            {card.humanType || card.type}
          </span>
          {card.attribute && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
              {card.attribute}
            </span>
          )}
          {card.race && (
            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
              {card.race}
            </span>
          )}
        </div>

        {/* Stats row */}
        {(card.atk !== null || card.def !== null || card.level !== null) && (
          <div className="flex items-center gap-3 text-sm">
            {card.level !== null && (
              <span className="flex items-center gap-1 text-[var(--color-gold-400)]">
                <span className="text-xs">★</span> {card.level}
              </span>
            )}
            {card.atk !== null && (
              <span className="text-[var(--color-accent-rose)]">
                ATK {card.atk}
              </span>
            )}
            {card.def !== null && (
              <span className="text-[var(--color-accent-blue)]">
                DEF {card.def}
              </span>
            )}
          </div>
        )}

        {/* Archetype */}
        {card.archetype && (
          <p className="text-xs text-[var(--color-text-muted)]">
            Archetype: <span className="text-[var(--color-accent-purple)]">{card.archetype}</span>
          </p>
        )}

        {/* Description */}
        <div className="mt-1 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed whitespace-pre-wrap">
            {card.desc}
          </p>
        </div>

        {/* Add to deck button */}
        {onAddCard && (
          <button
            onClick={() => onAddCard(card)}
            className="mt-auto w-full py-2.5 rounded-lg bg-gradient-to-r from-[var(--color-gold-500)] to-[var(--color-gold-600)] text-[var(--color-bg-primary)] font-semibold text-sm hover:from-[var(--color-gold-400)] hover:to-[var(--color-gold-500)] transition-all duration-200 active:scale-[0.98]"
          >
            Add to Deck
          </button>
        )}
      </div>
    </div>
  )
}

function getFrameColor(frameType) {
  const map = {
    normal: '#c9a739',
    effect: '#b85c2a',
    ritual: '#3b6fb5',
    fusion: '#7b3f9e',
    synchro: '#d4d4d8',
    xyz: '#4a4a5e',
    link: '#1e69bf',
    spell: '#2d8553',
    trap: '#a8326e',
    token: '#888888',
  }
  return map[frameType] || '#64748b'
}
