import type { DeckState, DeckValidationResult } from '../types'

export function parseYDK(content: string): DeckState & { side: number[] } {
  const lines = content.split(/\r?\n/)
  const deck: DeckState & { side: number[] } = { main: [], extra: [], side: [] }
  let currentSection: keyof DeckState | 'side' | null = null

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue

    if (trimmed === '#main') {
      currentSection = 'main'
      continue
    }
    if (trimmed === '#extra') {
      currentSection = 'extra'
      continue
    }
    if (trimmed === '!side') {
      currentSection = 'side'
      continue
    }

    if (trimmed.startsWith('#') || trimmed.startsWith('!')) continue

    const id = Number.parseInt(trimmed, 10)
    if (!Number.isNaN(id) && id > 0 && currentSection) {
      deck[currentSection].push(id)
    }
  }

  return deck
}

export function exportYDK(deck: DeckState, creator = 'DL Combo Simulator'): string {
  const lines = [`#created by ${creator}`]

  lines.push('#main')
  for (const id of deck.main) {
    lines.push(String(id))
  }

  lines.push('#extra')
  for (const id of deck.extra || []) {
    lines.push(String(id))
  }

  lines.push('!side')
  return lines.join('\n')
}

export function validateDuelLinksDeck(deck: DeckState): DeckValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  if (deck.main.length < 20) {
    errors.push(`Main deck has ${deck.main.length} cards (minimum 20)`)
  }
  if (deck.main.length > 30) {
    errors.push(`Main deck has ${deck.main.length} cards (maximum 30)`)
  }

  if ((deck.extra?.length || 0) > 9) {
    errors.push(`Extra deck has ${deck.extra.length} cards (maximum 9)`)
  }

  const counts: Record<number, number> = {}
  for (const id of [...deck.main, ...(deck.extra || [])]) {
    counts[id] = (counts[id] || 0) + 1
    if (counts[id] > 3) {
      errors.push(`Card ${id} appears ${counts[id]} times (maximum 3)`)
    }
  }

  if (deck.main.length > 20) {
    warnings.push(`Running ${deck.main.length} cards (20 is optimal for consistency)`)
  }

  if ((deck.extra?.length || 0) === 0) {
    warnings.push('No extra deck cards')
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

export function readYDKFile(file: File): Promise<DeckState & { side: number[] }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const deck = parseYDK((event.target?.result as string) || '')
        resolve(deck)
      } catch (error) {
        reject(new Error(`Failed to parse YDK file: ${(error as Error).message}`))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsText(file)
  })
}
