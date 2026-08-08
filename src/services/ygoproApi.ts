import type { CardData } from '../types'

const API_BASE = 'https://db.ygoprodeck.com/api/v7/cardinfo.php'
const IMAGE_BASE = 'https://images.ygoprodeck.com/images'

export interface YgoCard {
  id: number
  name: string
  type?: string
  humanReadableCardType?: string
  frameType?: string
  desc?: string
  race?: string | null
  atk?: number | null
  def?: number | null
  level?: number | null
  linkval?: number | null
  attribute?: string | null
  archetype?: string | null
}

export interface SearchResult {
  data: YgoCard[]
  meta?: { total_rows?: number }
}

export interface SearchParams {
  fname?: string
  type?: string
  race?: string
  attribute?: string
  level?: number
  archetype?: string
  format?: string
  num?: number
  offset?: number
}

export const TOKEN_IMAGE_SVG = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="200" height="290" viewBox="0 0 200 290">
  <rect width="200" height="290" rx="10" fill="#78716c" stroke="#44403c" stroke-width="4"/>
  <rect x="15" y="15" width="170" height="25" rx="4" fill="#a8a29e"/>
  <text x="100" y="32" font-family="sans-serif" font-size="13" font-weight="bold" fill="#1c1917" text-anchor="middle">MONSTER TOKEN</text>
  <rect x="20" y="48" width="160" height="150" rx="6" fill="#57534e" stroke="#292524" stroke-width="2"/>
  <circle cx="100" cy="123" r="42" fill="#a8a29e" opacity="0.8"/>
  <polygon points="100,90 125,145 75,145" fill="#e7e5e4"/>
  <rect x="15" y="206" width="170" height="70" rx="4" fill="#d6d3d1"/>
  <text x="22" y="224" font-family="sans-serif" font-size="10" font-weight="bold" fill="#292524">[Token / Monster]</text>
  <text x="22" y="240" font-family="sans-serif" font-size="9" fill="#57534e">This card can be used as any Token.</text>
  <text x="175" y="266" font-family="sans-serif" font-size="10" font-weight="bold" fill="#1c1917" text-anchor="end">ATK/ 0  DEF/ 0</text>
</svg>
`)}`

export function getCardImageUrl(cardId: number | string | null | undefined, size = 'small'): string {
  if (!cardId || cardId === 99999999 || String(cardId).toLowerCase().includes('token')) {
    return TOKEN_IMAGE_SVG
  }
  const folder = size === 'small' ? 'cards_small' : size === 'cropped' ? 'cards_cropped' : 'cards'
  return `${IMAGE_BASE}/${folder}/${cardId}.jpg`
}

export async function fetchCardById(id: number): Promise<CardData> {
  if (id === 99999999) {
    return {
      id: 99999999,
      name: 'Monster Token',
      type: 'Token',
      humanType: 'Token Monster',
      frameType: 'token',
      desc: 'Monster Token',
    }
  }

  const res = await fetch(`${API_BASE}?id=${id}`)
  if (!res.ok) throw new Error(`Failed to fetch card ${id}: ${res.status}`)
  const data = (await res.json()) as { data?: YgoCard[] }
  return normalizeCard(data.data?.[0]) as CardData
}

export async function fetchCardsByIds(ids: Array<number | string>): Promise<CardData[]> {
  if (!ids || ids.length === 0) return []

  const validIds = [...new Set(ids)].filter(
    (id): id is number => typeof id === 'number' && Boolean(id) && id !== 99999999,
  )
  if (validIds.length === 0) return []

  const batchSize = 50
  const results: CardData[] = []

  for (let i = 0; i < validIds.length; i += batchSize) {
    const batch = validIds.slice(i, i + batchSize)
    try {
      const res = await fetch(`${API_BASE}?id=${batch.join(',')}`)
      if (res.ok) {
        const data = (await res.json()) as { data?: YgoCard[] }
        if (data?.data) {
          results.push(...data.data.map(card => normalizeCard(card) as CardData).filter(Boolean))
        }
      }
    } catch {
      // Ignore network errors for single batch; continue with valid results
    }
  }

  return results
}

export async function searchCards(params: SearchParams = {}): Promise<SearchResult> {
  const {
    fname,
    type,
    race,
    attribute,
    level,
    archetype,
    format,
    num = 30,
    offset = 0,
  } = params

  const query = new URLSearchParams()
  if (fname) query.set('fname', fname)
  if (type) query.set('type', type)
  if (race) query.set('race', race)
  if (attribute) query.set('attribute', attribute)
  if (level) query.set('level', String(level))
  if (archetype) query.set('archetype', archetype)
  if (format) query.set('format', format)
  query.set('num', String(num))
  query.set('offset', String(offset))

  const res = await fetch(`${API_BASE}?${query.toString()}`)
  if (!res.ok) {
    if (res.status === 400) return { data: [] }
    throw new Error(`Search failed: ${res.status}`)
  }

  return (await res.json()) as SearchResult
}

export async function fetchAllDuelLinksCards(
  onProgress?: (loaded: number, total: number) => void,
): Promise<CardData[]> {
  const pageSize = 500
  let offset = 0
  const allCards: CardData[] = []
  let total: number | null = null

  while (true) {
    const res = await fetch(`${API_BASE}?format=duel%20links&num=${pageSize}&offset=${offset}`)
    if (!res.ok) throw new Error(`Bulk fetch failed at offset ${offset}: ${res.status}`)

    const data = (await res.json()) as { data?: YgoCard[]; meta?: { total_rows?: number } }
    if (total === null) total = data.meta?.total_rows ?? 0

    allCards.push(...(data.data ?? []).map(card => normalizeCard(card) as CardData).filter(Boolean))
    offset += pageSize

    if (onProgress) onProgress(allCards.length, total)
    if (allCards.length >= (total ?? 0)) break

    await new Promise(resolve => setTimeout(resolve, 100))
  }

  return allCards
}

export function normalizeCard(raw: YgoCard | null | undefined): CardData | null {
  if (!raw) return null
  return {
    id: raw.id,
    name: raw.name,
    type: raw.type,
    humanType: raw.humanReadableCardType,
    frameType: raw.frameType,
    desc: raw.desc,
    race: raw.race,
    atk: raw.atk ?? null,
    def: raw.def ?? null,
    level: raw.level ?? raw.linkval ?? null,
    attribute: raw.attribute ?? null,
    archetype: raw.archetype ?? null,
  }
}
