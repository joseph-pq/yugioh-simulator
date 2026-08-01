/**
 * YDK File Parser
 * 
 * Parses YDK format files (standard Yu-Gi-Oh! deck export format).
 * Format:
 *   #created by ...     ← optional comment
 *   #main               ← main deck section
 *   89631139             ← card passcode (one per line)
 *   #extra              ← extra deck section
 *   !side               ← side deck section (ignored for Duel Links)
 */

/**
 * Parse a YDK format string into a deck structure.
 * @param {string} content - Raw YDK file content
 * @returns {{ main: number[], extra: number[], side: number[] }}
 */
export function parseYDK(content) {
  const lines = content.split(/\r?\n/);
  const deck = { main: [], extra: [], side: [] };
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) continue;

    // Section headers
    if (trimmed === '#main') {
      currentSection = 'main';
      continue;
    }
    if (trimmed === '#extra') {
      currentSection = 'extra';
      continue;
    }
    if (trimmed === '!side') {
      currentSection = 'side';
      continue;
    }

    // Skip comments (lines starting with # that aren't section headers)
    if (trimmed.startsWith('#') || trimmed.startsWith('!')) continue;

    // Parse card ID
    const id = parseInt(trimmed, 10);
    if (!isNaN(id) && id > 0 && currentSection) {
      deck[currentSection].push(id);
    }
  }

  return deck;
}

/**
 * Export a deck structure to YDK format string.
 * @param {{ main: number[], extra: number[] }} deck
 * @param {string} [creator='DL Combo Simulator']
 * @returns {string}
 */
export function exportYDK(deck, creator = 'DL Combo Simulator') {
  const lines = [`#created by ${creator}`];

  lines.push('#main');
  for (const id of deck.main) {
    lines.push(String(id));
  }

  lines.push('#extra');
  for (const id of (deck.extra || [])) {
    lines.push(String(id));
  }

  lines.push('!side');
  // Duel Links has no side deck, but include the section for compatibility

  return lines.join('\n');
}

/**
 * Validate a parsed deck against Duel Links rules.
 * @param {{ main: number[], extra: number[] }} deck
 * @returns {{ valid: boolean, errors: string[], warnings: string[] }}
 */
export function validateDuelLinksDeck(deck) {
  const errors = [];
  const warnings = [];

  // Main deck: 20-30 cards
  if (deck.main.length < 20) {
    errors.push(`Main deck has ${deck.main.length} cards (minimum 20)`);
  }
  if (deck.main.length > 30) {
    errors.push(`Main deck has ${deck.main.length} cards (maximum 30)`);
  }

  // Extra deck: 0-9 cards
  if ((deck.extra?.length || 0) > 9) {
    errors.push(`Extra deck has ${deck.extra.length} cards (maximum 9)`);
  }

  // Max 3 copies of any card
  const counts = {};
  for (const id of [...deck.main, ...(deck.extra || [])]) {
    counts[id] = (counts[id] || 0) + 1;
    if (counts[id] > 3) {
      errors.push(`Card ${id} appears ${counts[id]} times (maximum 3)`);
    }
  }

  // Warnings for unusual but valid decks
  if (deck.main.length < 20) {
    // Already an error
  } else if (deck.main.length > 20) {
    warnings.push(`Running ${deck.main.length} cards (20 is optimal for consistency)`);
  }

  if ((deck.extra?.length || 0) === 0) {
    warnings.push('No extra deck cards');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Read a YDK file from a File object (from file input or drag-and-drop).
 * @param {File} file 
 * @returns {Promise<{ main: number[], extra: number[], side: number[] }>}
 */
export function readYDKFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const deck = parseYDK(e.target.result);
        resolve(deck);
      } catch (err) {
        reject(new Error(`Failed to parse YDK file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}
