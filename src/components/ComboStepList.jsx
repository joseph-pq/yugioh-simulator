import { useState, useEffect, useRef } from 'react'

/**
 * Combo Step List & Playback Visualization Controller.
 * Enables step-by-step navigation, auto-playback, and step highlighting.
 */
export default function ComboStepList({ combo, currentIndex, onJumpTo }) {
  const [isPlaying, setIsPlaying] = useState(false)
  const timerRef = useRef(null)

  useEffect(() => {
    if (isPlaying) {
      timerRef.current = setInterval(() => {
        if (currentIndex < combo.length - 1) {
          onJumpTo?.(currentIndex + 1)
        } else {
          setIsPlaying(false)
        }
      }, 1000)
    } else {
      clearInterval(timerRef.current)
    }
    return () => clearInterval(timerRef.current)
  }, [isPlaying, currentIndex, combo.length, onJumpTo])

  if (combo.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--color-text-muted)] p-4 text-center">
        <span className="text-2xl mb-2">🎬</span>
        <span>Start recording to create and visualize your combo records</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step Playback Controls */}
      <div className="p-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Record Visualization
          </span>
          <span className="text-[11px] font-mono font-bold text-[var(--color-gold-400)]">
            Step {currentIndex + 1} / {combo.length}
          </span>
        </div>

        {/* Playback Buttons */}
        <div className="flex items-center gap-1 justify-center">
          <button
            onClick={() => { setIsPlaying(false); onJumpTo?.(-1) }}
            className="px-2 py-1 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
            title="Start"
          >
            ⏮
          </button>
          <button
            onClick={() => { setIsPlaying(false); onJumpTo?.(Math.max(-1, currentIndex - 1)) }}
            className="px-2 py-1 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
            title="Previous Step"
          >
            ◀
          </button>

          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`flex-1 py-1 rounded text-xs font-bold transition-colors ${
              isPlaying
                ? 'bg-amber-600 text-white'
                : 'bg-[var(--color-gold-500)] text-black hover:bg-[var(--color-gold-400)]'
            }`}
          >
            {isPlaying ? '⏸ Pause' : '▶ Play Combo'}
          </button>

          <button
            onClick={() => { setIsPlaying(false); onJumpTo?.(Math.min(combo.length - 1, currentIndex + 1)) }}
            className="px-2 py-1 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
            title="Next Step"
          >
            ▶
          </button>
          <button
            onClick={() => { setIsPlaying(false); onJumpTo?.(combo.length - 1) }}
            className="px-2 py-1 rounded bg-[var(--color-bg-primary)] border border-[var(--color-border)] text-xs hover:bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]"
            title="End"
          >
            ⏭
          </button>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto">
        {combo.map((step, i) => (
          <button
            key={i}
            onClick={() => { setIsPlaying(false); onJumpTo?.(i) }}
            className={`w-full px-3 py-2 text-left flex items-center gap-2.5 text-xs border-b border-[var(--color-border)]/50 transition-all ${
              i === currentIndex
                ? 'bg-[var(--color-gold-500)]/15 border-l-4 border-l-[var(--color-gold-400)] text-[var(--color-gold-400)] font-bold'
                : i < currentIndex
                ? 'text-[var(--color-text-muted)] bg-[var(--color-bg-primary)]/40'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
            }`}
          >
            <span className="w-5 text-right font-mono text-[10px] opacity-75 flex-shrink-0">
              {i + 1}.
            </span>
            <span className="flex-shrink-0 text-sm">{getActionIcon(step.a)}</span>
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
    lp: '❤️', mill: '💀', todeck: '🔝', token: '✨', removetoken: '🗑️', effect: '⚡'
  }
  return map[action] || '▶️'
}

function formatStep(step) {
  switch (step.a) {
    case 'draw': return `Draw ${step.n || 1} card${(step.n || 1) > 1 ? 's' : ''}`
    case 'shuffle': return 'Shuffle deck'
    case 'move': return `Move card → ${step.to?.toUpperCase()}`
    case 'pos': return `Change position (${step.z?.toUpperCase()})`
    case 'lp': return `LP set to ${step.v}`
    case 'mill': return `Mill ${step.n || 1} card${(step.n || 1) > 1 ? 's' : ''}`
    case 'todeck': return `Return to deck (${step.top ? 'top' : 'bottom'})`
    case 'token': return `Spawn Token → ${step.to?.toUpperCase()}`
    case 'removetoken': return `Remove Token (${step.z?.toUpperCase()})`
    case 'effect': return `Activate Effect (${step.z?.toUpperCase()})`
    default: return step.a
  }
}
