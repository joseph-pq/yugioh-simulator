import LZString from 'lz-string'
import type { ComboStep } from '../types'

export interface ShareableState {
  main: number[]
  extra: number[]
  combo?: ComboStep[]
  name?: string
}

interface CompactState {
  m: number[]
  e: number[]
  cb?: ComboStep[]
  n?: string
}

export function encodeState(state: ShareableState): string {
  const compact: CompactState = {
    m: state.main,
    e: state.extra || [],
  }

  if (state.combo && state.combo.length > 0) {
    compact.cb = state.combo
  }

  if (state.name) {
    compact.n = state.name
  }

  const json = JSON.stringify(compact)
  return LZString.compressToEncodedURIComponent(json)
}

export function decodeState(compressed: string): ShareableState | null {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed)
    if (!json) return null

    const compact = JSON.parse(json) as CompactState
    return {
      main: compact.m || [],
      extra: compact.e || [],
      combo: compact.cb || [],
      name: compact.n || '',
    }
  } catch {
    return null
  }
}

export function pushStateToUrl(state: ShareableState): void {
  const compressed = encodeState(state)
  const newUrl = `${window.location.pathname}#d=${compressed}`
  window.history.replaceState(null, '', newUrl)
}

export function readStateFromUrl(): ShareableState | null {
  const hash = window.location.hash.startsWith('#/sim') ? window.location.hash.slice(5) : window.location.hash
  if (!hash || !hash.startsWith('#d=')) return null
  const compressed = hash.slice(3)
  return decodeState(compressed)
}

export function generateShareUrl(state: ShareableState): string {
  const compressed = encodeState(state)
  const origin = window.location.origin
  let pathname = window.location.pathname
  if (!pathname.endsWith('/sim') && !pathname.endsWith('/sim/')) {
    pathname = pathname.replace(/\/$/, '') + '/sim'
  }
  if (origin.includes('localhost')) {
    pathname = '/#' + pathname
  }
  return `${origin}${pathname}#d=${compressed}`
}

export function getStateSizeInfo(state: ShareableState): { jsonBytes: number; compressedChars: number; urlLength: number } {
  const json = JSON.stringify({
    m: state.main,
    e: state.extra || [],
    cb: state.combo || [],
    n: state.name || '',
  })
  const compressed = encodeState(state)
  const url = generateShareUrl(state)

  return {
    jsonBytes: new TextEncoder().encode(json).length,
    compressedChars: compressed.length,
    urlLength: url.length,
  }
}
