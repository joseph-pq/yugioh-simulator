import { openDB } from 'idb'
import { fetchCardsByIds, normalizeCard } from './ygoproApi'
import type { CardData, CardFilter } from '../types'

const DB_NAME = 'dl-combo-sim'
const DB_VERSION = 1
const CARDS_STORE = 'cards'
const META_STORE = 'meta'

let dbPromise: ReturnType<typeof openDB> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(CARDS_STORE)) {
          const store = db.createObjectStore(CARDS_STORE, { keyPath: 'id' })
          store.createIndex('name', 'name')
          store.createIndex('type', 'type')
          store.createIndex('archetype', 'archetype')
          store.createIndex('frameType', 'frameType')
        }
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE)
        }
      },
    })
  }
  return dbPromise
}

export async function getCachedCardCount(): Promise<number> {
  const db = await getDB()
  return db.count(CARDS_STORE)
}

export async function getCard(id: number): Promise<CardData | undefined> {
  const db = await getDB()
  return db.get(CARDS_STORE, id)
}

export async function getCards(ids: number[]): Promise<CardData[]> {
  const db = await getDB()
  const results = await Promise.all(ids.map(id => db.get(CARDS_STORE, id)))
  return results.filter(Boolean) as CardData[]
}

export async function fetchAndCacheCards(ids: number[]): Promise<CardData[]> {
  const uniqueIds = [...new Set(ids)]
  const db = await getDB()

  const cached = await Promise.all(uniqueIds.map(id => db.get(CARDS_STORE, id)))
  const cachedMap: Record<number, CardData> = {}
  const missingIds: number[] = []

  for (let i = 0; i < uniqueIds.length; i += 1) {
    const id = uniqueIds[i]
    if (cached[i]) {
      cachedMap[id] = cached[i] as CardData
    } else {
      missingIds.push(id)
    }
  }

  if (missingIds.length > 0) {
    const fetched = await fetchCardsByIds(missingIds)
    const normalized = fetched.map(card => normalizeCard(card as never)).filter(Boolean) as CardData[]

    const tx = db.transaction(CARDS_STORE, 'readwrite')
    for (const card of normalized) {
      tx.store.put(card)
      cachedMap[card.id] = card
    }
    await tx.done
  }

  return ids.map(id => cachedMap[id]).filter(Boolean) as CardData[]
}

export async function searchLocalCards(query: string, filters: CardFilter = {}, limit = 30): Promise<CardData[]> {
  const db = await getDB()
  const allCards = await db.getAll(CARDS_STORE)

  const lowerQuery = query.toLowerCase()
  let results = allCards.filter((card: CardData) => {
    if (!card.name.toLowerCase().includes(lowerQuery)) return false
    if (filters.type && card.type !== filters.type) return false
    if (filters.frameType && card.frameType !== filters.frameType) return false
    if (filters.attribute && card.attribute !== filters.attribute) return false
    if (filters.race && card.race !== filters.race) return false
    if (filters.archetype && card.archetype !== filters.archetype) return false
    if (filters.level !== undefined && card.level !== filters.level) return false
    return true
  })

  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(lowerQuery)
    const bStarts = b.name.toLowerCase().startsWith(lowerQuery)
    if (aStarts && !bStarts) return -1
    if (!aStarts && bStarts) return 1
    return a.name.localeCompare(b.name)
  })

  return results.slice(0, limit)
}

export async function getArchetypes(): Promise<string[]> {
  const db = await getDB()
  const allCards = await db.getAll(CARDS_STORE)
  const archetypes = new Set<string>()
  for (const card of allCards as CardData[]) {
    if (card.archetype) archetypes.add(card.archetype)
  }
  return [...archetypes].sort()
}
