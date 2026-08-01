/**
 * Card Cache Service
 * 
 * Uses IndexedDB (via `idb` library) to cache card data locally.
 * Cards are fetched on-demand when decks are imported, NOT bulk-downloaded.
 * This avoids the YGOPRO API's incomplete "duel links" format filter.
 */

import { openDB } from 'idb';
import { fetchCardsByIds, normalizeCard } from './ygoproApi';

const DB_NAME = 'dl-combo-sim';
const DB_VERSION = 1;
const CARDS_STORE = 'cards';
const META_STORE = 'meta';

let dbPromise = null;

/**
 * Get or create the IndexedDB database.
 */
function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Cards store: keyed by card ID
        if (!db.objectStoreNames.contains(CARDS_STORE)) {
          const store = db.createObjectStore(CARDS_STORE, { keyPath: 'id' });
          store.createIndex('name', 'name');
          store.createIndex('type', 'type');
          store.createIndex('archetype', 'archetype');
          store.createIndex('frameType', 'frameType');
        }
        // Meta store: for cache timestamps etc.
        if (!db.objectStoreNames.contains(META_STORE)) {
          db.createObjectStore(META_STORE);
        }
      },
    });
  }
  return dbPromise;
}

/**
 * Get the total number of cached cards.
 * @returns {Promise<number>}
 */
export async function getCachedCardCount() {
  const db = await getDB();
  return await db.count(CARDS_STORE);
}

/**
 * Get a single card by ID from the cache.
 * @param {number} id - Card passcode
 * @returns {Promise<Object|undefined>}
 */
export async function getCard(id) {
  const db = await getDB();
  return await db.get(CARDS_STORE, id);
}

/**
 * Get multiple cards by their IDs from the cache.
 * @param {number[]} ids - Card passcodes
 * @returns {Promise<Object[]>}
 */
export async function getCards(ids) {
  const db = await getDB();
  const results = await Promise.all(ids.map(id => db.get(CARDS_STORE, id)));
  return results.filter(Boolean);
}

/**
 * Fetch cards by IDs from the API (without format filter) and cache them.
 * Only fetches cards that are NOT already in the cache.
 * @param {number[]} ids - Card passcodes to fetch
 * @returns {Promise<Object[]>} All resolved cards (from cache + freshly fetched)
 */
export async function fetchAndCacheCards(ids) {
  const uniqueIds = [...new Set(ids)];
  const db = await getDB();

  // Check which cards we already have
  const cached = await Promise.all(uniqueIds.map(id => db.get(CARDS_STORE, id)));
  const cachedMap = {};
  const missingIds = [];

  for (let i = 0; i < uniqueIds.length; i++) {
    if (cached[i]) {
      cachedMap[uniqueIds[i]] = cached[i];
    } else {
      missingIds.push(uniqueIds[i]);
    }
  }

  // Fetch missing cards from API (no format filter!)
  if (missingIds.length > 0) {
    const fetched = await fetchCardsByIds(missingIds);
    const normalized = fetched.map(normalizeCard);

    // Store in IndexedDB
    const tx = db.transaction(CARDS_STORE, 'readwrite');
    for (const card of normalized) {
      tx.store.put(card);
      cachedMap[card.id] = card;
    }
    await tx.done;
  }

  // Return cards in the same order as the input ids
  return ids.map(id => cachedMap[id]).filter(Boolean);
}

/**
 * Search cards in the local cache by name (fuzzy match).
 * Only searches cards that have been previously cached (imported).
 * @param {string} query - Search text
 * @param {Object} [filters] - Optional filters
 * @param {number} [limit=30] - Max results
 * @returns {Promise<Object[]>}
 */
export async function searchLocalCards(query, filters = {}, limit = 30) {
  const db = await getDB();
  const allCards = await db.getAll(CARDS_STORE);

  const lowerQuery = query.toLowerCase();
  let results = allCards.filter(card => {
    // Name match
    if (!card.name.toLowerCase().includes(lowerQuery)) return false;

    // Apply filters
    if (filters.type && card.type !== filters.type) return false;
    if (filters.frameType && card.frameType !== filters.frameType) return false;
    if (filters.attribute && card.attribute !== filters.attribute) return false;
    if (filters.race && card.race !== filters.race) return false;
    if (filters.archetype && card.archetype !== filters.archetype) return false;
    if (filters.level !== undefined && card.level !== filters.level) return false;

    return true;
  });

  // Sort: exact prefix matches first, then alphabetical
  results.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(lowerQuery);
    const bStarts = b.name.toLowerCase().startsWith(lowerQuery);
    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.name.localeCompare(b.name);
  });

  return results.slice(0, limit);
}

/**
 * Get all unique archetypes from the cache.
 * @returns {Promise<string[]>}
 */
export async function getArchetypes() {
  const db = await getDB();
  const allCards = await db.getAll(CARDS_STORE);
  const archetypes = new Set();
  for (const card of allCards) {
    if (card.archetype) archetypes.add(card.archetype);
  }
  return [...archetypes].sort();
}

// ============================================================
// Bulk loading (disabled — kept for future deck builder feature)
// ============================================================

// import { fetchAllDuelLinksCards } from './ygoproApi';
// const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
//
// export async function isCacheStale() { ... }
// export async function initCache(onProgress) { ... }
