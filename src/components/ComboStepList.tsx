import { useState, useEffect, useRef } from 'react'
import type { ComboStep } from '../types'
import { useGame } from '../context/GameContext'

export interface ComboStepListProps {
  combo: ComboStep[]
  currentIndex: number
  onJumpTo?: (index: number) => void
  onResetRecord?: () => void
}

/**
 * Combo Step List & Playback Visualization Controller.
 * Enables step-by-step navigation, auto-playback with dynamic velocity control,
 * step highlighting, and record reset option.
 */
export default function ComboStepList({ combo, currentIndex, onJumpTo, onResetRecord }: ComboStepListProps) {
  const { playbackSpeed, setPlaybackSpeed } = useGame()
  const [isPlaying, setIsPlaying] = useState(false)
  const [showResetConfirm, setShowResetConfirm] = useState(false)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    if (isPlaying) {
      // Dynamic velocity calculation: base interval is 1000ms / playbackSpeed
      const intervalMs = Math.max(150, Math.round(1000 / playbackSpeed))
      timer = setInterval(() => {
        if (currentIndex < combo.length - 1) {
          onJumpTo?.(currentIndex + 1)
        } else {
          setIsPlaying(false)
        }
      }, intervalMs)
      timerRef.current = timer
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isPlaying, currentIndex, combo.length, onJumpTo, playbackSpeed])

  if (combo.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-xs text-[var(--color-text-muted)] p-4 text-center">
        <span className="text-2xl mb-2">🎬</span>
        <span>Start performing actions on the duel board to record your combo steps</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Step Playback Controls Header */}
      <div className="p-2 border-b border-[var(--color-border)] bg-[var(--color-bg-tertiary)] flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider">
            Record Visualization
          </span>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono font-bold text-[var(--color-gold-400)]">
              {currentIndex + 1} / {combo.length}
            </span>
            {/* Reset Record Option */}
            <button
              onClick={() => setShowResetConfirm(true)}
              className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 hover:bg-rose-500/30 text-[10px] font-semibold border border-rose-500/30 transition-colors"
              title="Reset Record"
            >
              🗑️ Reset
            </button>
          </div>
        </div>

        {/* Velocity / Speed Slider */}
        <div className="flex items-center justify-between gap-2 px-1 py-1 rounded bg-[var(--color-bg-primary)]/50 border border-[var(--color-border)]/50 text-[10px]">
          <span className="text-[var(--color-text-muted)] font-mono font-semibold">⚡ Speed: {playbackSpeed}x</span>
          <div className="flex items-center gap-1.5 flex-1 max-w-[150px]">
            <input
              type="range"
              min="0.25"
              max="3"
              step="0.25"
              value={playbackSpeed}
              onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
              className="w-full h-1.5 bg-[var(--color-bg-tertiary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-gold-400)]"
            />
          </div>
          <div className="flex gap-1">
            {[0.5, 1, 2].map((s) => (
              <button
                key={s}
                onClick={() => setPlaybackSpeed(s)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                  playbackSpeed === s
                    ? 'bg-[var(--color-gold-500)] text-black font-bold'
                    : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)]'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
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

      {/* Custom Reset Confirmation Modal */}
      {showResetConfirm && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200 select-none"
          onClick={() => setShowResetConfirm(false)}
        >
          <div
            className="bg-[var(--color-bg-secondary)] border border-rose-500/40 rounded-xl p-5 shadow-[0_0_35px_rgba(244,63,94,0.3)] max-w-sm w-full font-sans flex flex-col gap-4 animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-xl text-rose-400 shrink-0">
                ⚠️
              </div>
              <div>
                <h3 className="text-sm font-bold text-[var(--color-text-primary)]">Clear Recorded Combo?</h3>
                <p className="text-[11px] text-[var(--color-text-muted)] mt-0.5">
                  This action cannot be undone.
                </p>
              </div>
            </div>

            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-bg-primary)]/60 p-3 rounded-lg border border-[var(--color-border)]">
              Are you sure you want to clear all <span className="font-bold text-rose-400 font-mono">{combo.length}</span> recorded combo steps? The board history will be reset to step 0.
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-xs font-semibold text-[var(--color-text-secondary)] border border-[var(--color-border)] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false)
                  setIsPlaying(false)
                  onResetRecord?.()
                }}
                className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-xs font-bold text-white shadow-[0_0_15px_rgba(244,63,94,0.4)] transition-all active:scale-95 flex items-center gap-1.5"
              >
                🗑️ Clear Combo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function getActionIcon(action?: string) {
  if (!action) return '▶️'
  const map: Record<string, string> = {
    draw: '🃏', shuffle: '🔀', move: '↗️', pos: '🔄',
    lp: '❤️', mill: '💀', todeck: '🔝', token: '✨', removetoken: '🗑️', effect: '⚡', skill: '🎲'
  }
  return map[action] || '▶️'
}

function formatStep(step: ComboStep) {
  switch (step.a) {
    case 'draw': return `Draw ${step.n || 1} card${(step.n || 1) > 1 ? 's' : ''}`
    case 'shuffle': return 'Shuffle deck'
    case 'move': return `Move card → ${String(step.to || step.t || '').toUpperCase()}`
    case 'pos': return `Change position (${String(step.z || step.to || '').toUpperCase()})`
    case 'lp': return `LP set to ${step.v}`
    case 'mill': return `Mill ${step.n || 1} card${(step.n || 1) > 1 ? 's' : ''}`
    case 'todeck': return `Return to deck (${step.top ? 'top' : 'bottom'})`
    case 'token': return `Spawn Token → ${String(step.to || step.t || '').toUpperCase()}`
    case 'removetoken': return `Remove Token (${String(step.z || step.to || '').toUpperCase()})`
    case 'effect': return `Activate Effect (${String(step.z || step.to || '').toUpperCase()})`
    case 'skill': return 'Activate Skill'
    default: return step.a || 'Action'
  }
}
