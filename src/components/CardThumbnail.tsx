import { useState } from 'react'
import type { CardData } from '../types'
import { getCardImageUrl } from '../services/ygoproApi'

export interface CardThumbnailProps {
  card: CardData
  onClick?: (card: CardData) => void
  onContextMenu?: (card: CardData, event: React.MouseEvent) => void
  selected?: boolean
  count?: number
  size?: 'sm' | 'lg'
}

/**
 * Card thumbnail with hover preview and click selection.
 */
export default function CardThumbnail({
  card,
  onClick,
  onContextMenu,
  selected = false,
  count = 0,
  size = 'sm',
}: CardThumbnailProps) {
  const [loaded, setLoaded] = useState(false)
  const imgSize = size === 'lg' ? 'card-thumbnail card-thumbnail-lg' : 'card-thumbnail'

  return (
    <div
      className={`relative group cursor-pointer ${selected ? 'ring-2 ring-[var(--color-gold-400)] rounded-[var(--radius-sm)]' : ''}`}
      onClick={() => onClick?.(card)}
      onContextMenu={(e) => {
        e.preventDefault()
        onContextMenu?.(card, e)
      }}
      title={card.name}
    >
      {!loaded && <div className={`${imgSize} loading-shimmer`} />}
      <img
        src={getCardImageUrl(card.id, 'small')}
        alt={card.name}
        className={`${imgSize} ${loaded ? 'opacity-100' : 'opacity-0 absolute top-0 left-0'}`}
        onLoad={() => setLoaded(true)}
        loading="lazy"
        draggable={false}
      />
      {/* Copy count badge */}
      {count > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[var(--color-gold-500)] text-[var(--color-bg-primary)] text-xs font-bold flex items-center justify-center shadow">
          {count}
        </span>
      )}
    </div>
  )
}
