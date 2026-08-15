import LZString from 'lz-string'
import type { ComboStep } from '../types'

export interface TokenInitInfo {
  z: string
  i: number
  p?: string
}

export interface ShareableState {
  main: number[]
  extra: number[]
  combo?: ComboStep[]
  name?: string
  init?: Record<string, number[]>
  tokens?: TokenInitInfo[]
}

interface CompactState {
  m: number[]
  e: number[]
  cb?: ComboStep[]
  n?: string
  i?: Record<string, number[]>
  tk?: TokenInitInfo[]
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

  if (state.init && Object.keys(state.init).length > 0) {
    compact.i = state.init
  }

  if (state.tokens && state.tokens.length > 0) {
    compact.tk = state.tokens
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
      init: compact.i,
      tokens: compact.tk,
    }
  } catch {
    return null
  }
}

export function pushStateToUrl(state: ShareableState): void {
  const compressed = encodeState(state)
  const newUrl = `${import.meta.env.BASE_URL}#/sim?d=${compressed}`
  window.history.replaceState(null, '', newUrl)
}

export function readStateFromUrl(): ShareableState | null {
  const hash = window.location.hash
  const query = hash.includes('?') ? hash.slice(hash.indexOf('?') + 1) : ''
  const compressed = new URLSearchParams(query).get('d')

  if (compressed) return decodeState(compressed)

  // Keep links created before hash-based routes usable when they still reach the app.
  const legacyHash = hash.startsWith('#/sim') ? hash.slice(5) : hash
  if (!legacyHash || !legacyHash.startsWith('#d=')) return null
  const legacyCompressed = legacyHash.slice(3)

  return decodeState(legacyCompressed)
}

export function generateShareUrl(state: ShareableState): string {
  const compressed = encodeState(state)
  return `${window.location.origin}${import.meta.env.BASE_URL}#/sim?d=${compressed}`
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
