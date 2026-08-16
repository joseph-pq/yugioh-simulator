import { useState } from 'react'
import type { CardData } from '../types'
import { getCardImageUrl } from '../services/ygoproApi'

export interface CardDetailPanelProps {
  card?: CardData | null
  onClose?: () => void
}

/**
 * Side panel focused on card text content first.
 * Displays card details, stats, formatted description text with sentence line breaks and paragraph spacing,
 * and a thumbnail in the corner. Clicking the thumbnail opens a high-res image preview modal.
 */
export default function CardDetailPanel({ card }: CardDetailPanelProps) {
  const [isMaximized, setIsMaximized] = useState(false)

  if (!card) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-center p-6">
        <p className="text-xs text-[var(--color-text-muted)]">Hover or click a card to view details</p>
      </div>
    )
  }

  const frameColor = getFrameColor(card.frameType)

  return (
    <div className="h-full flex flex-col animate-fade-in p-4 overflow-y-auto relative">
      {/* Top Header: Card Content FIRST, Card Image in top-right corner */}
      <div className="flex items-start justify-between gap-3 mb-3 border-b border-[var(--color-border)] pb-3">
        {/* Left: Card Metadata & Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h2 className="text-base font-bold text-[var(--color-text-primary)] leading-snug break-words" title={card.name}>
            {card.name}
          </h2>

          {/* Type Badges */}
          <div className="flex flex-wrap gap-1">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: frameColor + '25', color: frameColor }}
            >
              {card.humanType || card.type}
            </span>
            {card.attribute && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                {card.attribute}
              </span>
            )}
            {card.race && (
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]">
                {card.race}
              </span>
            )}
          </div>

          {/* Stats row */}
          {(card.atk !== undefined && card.atk !== null || card.def !== undefined && card.def !== null || card.level !== undefined && card.level !== null) && (
            <div className="flex items-center gap-2.5 text-xs font-mono font-bold mt-0.5">
              {card.level !== undefined && card.level !== null && (
                <span className="text-yellow-400 flex items-center gap-0.5">
                  <span>★</span>{card.level}
                </span>
              )}
              {card.atk !== undefined && card.atk !== null && (
                <span className="text-rose-400">ATK/{card.atk}</span>
              )}
              {card.def !== undefined && card.def !== null && (
                <span className="text-sky-400">DEF/{card.def}</span>
              )}
            </div>
          )}

          {card.archetype && (
            <div className="text-[10px] text-[var(--color-text-muted)] truncate">
              Archetype: <span className="text-purple-400 font-semibold">{card.archetype}</span>
            </div>
          )}
        </div>

        {/* Right Corner: Card Thumbnail (Click to Maximize) */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <button
            onClick={() => setIsMaximized(true)}
            className="group relative rounded border border-[var(--color-border)] overflow-hidden shadow hover:border-[var(--color-gold-400)] transition-all"
            title="Click to view full image"
          >
            <img
              src={getCardImageUrl(card.id, 'small')}
              alt={card.name}
              className="w-14 h-20 object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold">
              🔍
            </div>
          </button>
          <span className="text-[9px] text-[var(--color-text-muted)] mt-0.5">Enlarge</span>
        </div>
      </div>

      {/* Main Body: Plain text card description with line breaks and paragraph spacing */}
      <div className="flex-1 flex flex-col min-h-0">
        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
          Card Description
        </h3>
        <div className="flex-1 p-3 rounded-lg bg-[var(--color-bg-primary)] border border-[var(--color-border)] overflow-y-auto">
          {renderFormattedDescription(card.desc)}
        </div>
      </div>

      {/* Image Modal (Maximized view) */}
      {isMaximized && (
        <div
          className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsMaximized(false)}
        >
          <div className="relative max-w-sm w-full flex flex-col items-center bg-[var(--color-bg-secondary)] border border-[var(--color-border)] p-4 rounded-2xl shadow-2xl">
            <button
              onClick={() => setIsMaximized(false)}
              className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center text-sm hover:bg-black transition-colors"
            >
              ✕
            </button>
            <img
              src={getCardImageUrl(card.id, 'full')}
              alt={card.name}
              className="max-h-[70vh] rounded-lg shadow-2xl mb-3 object-contain"
            />
            <p className="text-sm font-bold text-[var(--color-text-primary)] text-center">{card.name}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Split Yu-Gi-Oh card text into plain text paragraphs and sentences with line breaks.
 */
function renderFormattedDescription(desc?: string) {
  if (!desc) return <p className="text-xs text-[var(--color-text-muted)]">No description available.</p>

  // Split raw text into major blocks (by newline, numbered effects like (1) (2), or bullet points)
  const rawBlocks = desc
    .split(/\r?\n+/)
    .flatMap(block => block.split(/(?=\([0-9]+\)|[①-⑩]|●)/g))
    .map(b => b.trim())
    .filter(Boolean)

  return (
    <div className="space-y-5 text-xs text-[var(--color-text-secondary)] leading-relaxed font-sans">
      {rawBlocks.map((block, pIdx) => {
        const sentences = block
          .split(/\.\s+(?=[A-Z0-9①-⑩\(\(])/g)
          .map(s => s.trim())
          .filter(Boolean)

        return (
          <div key={pIdx} className="space-y-1.5 pb-3 border-b border-[var(--color-border)]/40 last:border-b-0 last:pb-0">
            {sentences.map((sentence, sIdx) => {
              const formattedText = sentence.endsWith('.') || sentence.endsWith(':') || sentence.endsWith(';') ? sentence : sentence + '.'
              return (
                <div key={sIdx} className="leading-relaxed">
                  {formattedText}
                </div>
              )
            })}
          </div>
        )
      })}
    </div>
  )
}

function getFrameColor(frameType?: string) {
  if (!frameType) return '#64748b'
  const map: Record<string, string> = {
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
