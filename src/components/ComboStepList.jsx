import { useMemo } from 'react'

/**
 * Combo step list — shows all recorded actions with step numbers.
 */
export default function ComboStepList({ combo, currentIndex, onJumpTo }) {
  if (combo.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-[var(--color-text-muted)] p-4 text-center">
        Start recording to see combo steps here
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-[var(--color-border)] flex items-center justify-between">
        <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
          Combo Steps
        </span>
        <span className="text-[10px] text-[var(--color-text-muted)]">
          {combo.length} steps
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {combo.map((step, i) => (
          <button
            key={i}
            onClick={() => onJumpTo?.(i)}
            className={`w-full px-3 py-1.5 text-left flex items-center gap-2 text-xs border-b border-[var(--color-border)]/50 transition-colors ${
              i === currentIndex
                ? 'bg-[var(--color-gold-500)]/10 text-[var(--color-gold-400)]'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            <span className="w-6 text-right font-mono text-[10px] text-[var(--color-text-muted)] flex-shrink-0">
              {i + 1}
            </span>
            <span className="flex-shrink-0">{getActionIcon(step.a)}</span>
            <span className="truncate">{formatStep(step)}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function getActionIcon(action) {
  const map = {
    draw: '🃏', shuffle: '🔀', move: '↗️', pos: '🔄',
    lp: '❤️', mill: '💀', todeck: '🔝',
  }
  return map[action] || '▶️'
}

function formatStep(step) {
  switch (step.a) {
    case 'draw': return `Draw ${step.n || 1} card${(step.n || 1) > 1 ? 's' : ''}`
    case 'shuffle': return 'Shuffle deck'
    case 'move': return `Move → ${step.to?.toUpperCase()}`
    case 'pos': return `Change position (${step.z?.toUpperCase()})`
    case 'lp': return `LP → ${step.v}`
    case 'mill': return `Mill ${step.n || 1} card${(step.n || 1) > 1 ? 's' : ''}`
    case 'todeck': return `Return to deck (${step.top ? 'top' : 'bottom'})`
    default: return step.a
  }
}
