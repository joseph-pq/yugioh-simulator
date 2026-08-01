/**
 * URL State Service
 * 
 * Encodes/decodes deck + combo state into URL hash fragments
 * using lz-string compression for sharing.
 * 
 * URL format: https://host/app/#d=<compressed>
 * 
 * The hash fragment is NOT sent to the server, so it can be
 * arbitrarily long (modern browsers support 32KB+).
 */

import LZString from 'lz-string';

/**
 * Encode a deck (and optionally combo) state into a URL-safe string.
 * @param {Object} state
 * @param {number[]} state.main - Main deck card IDs
 * @param {number[]} state.extra - Extra deck card IDs
 * @param {Object[]} [state.combo] - Combo steps
 * @param {string} [state.name] - Deck name
 * @returns {string} Compressed, URL-safe string
 */
export function encodeState(state) {
  const compact = {
    m: state.main,
    e: state.extra || [],
  };

  if (state.combo && state.combo.length > 0) {
    compact.cb = state.combo;
  }

  if (state.name) {
    compact.n = state.name;
  }

  const json = JSON.stringify(compact);
  return LZString.compressToEncodedURIComponent(json);
}

/**
 * Decode a compressed URL-safe string back into deck/combo state.
 * @param {string} compressed - The compressed string from URL
 * @returns {Object|null} Decoded state or null if invalid
 */
export function decodeState(compressed) {
  try {
    const json = LZString.decompressFromEncodedURIComponent(compressed);
    if (!json) return null;

    const compact = JSON.parse(json);
    return {
      main: compact.m || [],
      extra: compact.e || [],
      combo: compact.cb || [],
      name: compact.n || '',
    };
  } catch {
    return null;
  }
}

/**
 * Update the URL hash with the current state.
 * Does NOT trigger a page reload.
 * @param {Object} state - State to encode
 */
export function pushStateToUrl(state) {
  const compressed = encodeState(state);
  const newUrl = `${window.location.pathname}#d=${compressed}`;
  window.history.replaceState(null, '', newUrl);
}

/**
 * Read state from the current URL hash.
 * @returns {Object|null} Decoded state or null
 */
export function readStateFromUrl() {
  const hash = window.location.hash;
  if (!hash || !hash.startsWith('#d=')) return null;
  const compressed = hash.slice(3); // Remove '#d='
  return decodeState(compressed);
}

/**
 * Generate a shareable URL with the given state.
 * @param {Object} state - State to encode
 * @returns {string} Full shareable URL
 */
export function generateShareUrl(state) {
  const compressed = encodeState(state);
  const origin = window.location.origin;
  let pathname = window.location.pathname;
  if (!pathname.endsWith('/sim') && !pathname.endsWith('/sim/')) {
    pathname = pathname.replace(/\/$/, '') + '/sim';
  }
  return `${origin}${pathname}#d=${compressed}`;
}

/**
 * Get the approximate size of the encoded state.
 * Useful for showing users how large their shared URL is.
 * @param {Object} state 
 * @returns {{ jsonBytes: number, compressedChars: number, urlLength: number }}
 */
export function getStateSizeInfo(state) {
  const json = JSON.stringify({
    m: state.main,
    e: state.extra || [],
    cb: state.combo || [],
    n: state.name || '',
  });
  const compressed = encodeState(state);
  const url = generateShareUrl(state);

  return {
    jsonBytes: new TextEncoder().encode(json).length,
    compressedChars: compressed.length,
    urlLength: url.length,
  };
}
