# Yu-Gi-Oh! Duel Links Combo Simulator — Architecture & Codebase Overview

## Overview

The **Yu-Gi-Oh! Duel Links Combo Simulator** is a 100% client-side React + TypeScript web application built with Vite and TailwindCSS v4. It allows Yu-Gi-Oh! Duel Links players to build decks (via YDK file import/export), test opening hands, simulate duels, record step-by-step solo combos, and share full interactive combos via compressed URL hashes without requiring any backend server or user account.

---

## Technical Stack & Libraries

- **Frontend Framework**: React 19 + TypeScript + Vite
- **Styling**: TailwindCSS v4 (`@tailwindcss/vite`) + Custom Glassmorphism CSS design system (`index.css`)
- **State & Storage**: React Context API (`CacheContext`, `DeckContext`, `GameContext`) + IndexedDB (`idb` v8) for offline card caching
- **Drag and Drop**: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- **Data Compression & Sharing**: `lz-string` (Compresses deck & step history into URL hash params `#d=...`)
- **Card Data Source**: [YGOPRODeck API v7](https://db.ygoprodeck.com/api/v7/cardinfo.php) (Filtered for *Duel Links* format)

---

## File & Directory Structure

```
yugioh-simulator/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.js
├── src/
│   ├── main.tsx                # Entry point mounting App & BrowserRouter
│   ├── App.tsx                 # Core App wrapper with Context Providers & Routes
│   ├── types.ts                # TypeScript interfaces for cards, boards, combos & contexts
│   ├── index.css               # Global CSS design tokens, custom scrollbars & glass styling
│   ├── assets/                 # Static visual assets (skill.png)
│   ├── context/
│   │   ├── CacheContext.tsx    # Card search & IndexedDB lookup provider
│   │   ├── DeckContext.tsx     # Main/Extra deck state & Duel Links validation
│   │   └── GameContext.tsx     # Duel board state machine, history stack & recording engine
│   ├── services/
│   │   ├── ygoproApi.ts        # YGOPRODeck API client & token fallback SVG
│   │   ├── cardCache.ts        # IndexedDB storage layer for card info & local search
│   │   └── urlState.ts         # LZ-String state encoding/decoding for shareable URLs
│   ├── utils/
│   │   └── ydkParser.ts        # .ydk file parsing, export, & Duel Links deck validation rules
│   ├── components/
│   │   ├── Layout.tsx          # Top navigation bar with status indicator
│   │   ├── CardThumbnail.tsx   # Card image thumbnail with hover previews & badges
│   │   ├── CardDetailPanel.tsx # Description of current hovererd card view & full-res image modal
│   │   ├── CardContextMenu.tsx # Right-click contextual actions (activate, set, flip, move)
│   │   ├── ComboStepList.tsx   # Combo recorder timeline, speed controls (0.25x-3x) & step playback
│   │   └── DuelBoard.tsx       # Interactive Duel Links field (dnd-kit, flying animations, vertical cascades)
│   └── pages/
│       ├── HomePage.jsx        # Landing page with hero banner & feature cards
│       ├── DeckBuilderPage.jsx # YDK import/export, deck builder & card preview
│       └── SimulatorPage.tsx   # Main interactive simulator workspace
```

---

## Core Architecture & Key Modules

### 1. Data Models (`src/types.ts`)
- `CardData`: Represents card metadata (id, name, type, humanType, frameType, desc, race, atk, def, level, attribute, archetype).
- `CardInstance`: Represents an individual physical instance on the board with a unique `id`, `cardId`, position state (`position`), and associated `data`.
- `BoardState`: Snapshot of all zones:
  - **Single-card zones**: `m1`, `m2`, `m3`, `st1`, `st2`, `st3`, `emz1`, `emz2`, `field`, `efield`, `extra_pile`, `eextra_pile`, `est1`-`est3`, `em1`-`em3`.
  - **Array zones**: `hand`, `deck`, `extra`, `gy`, `egy`, `banish`, `ebanish`, `free`, `efree`.
  - **Game state**: Life points (`lp`).
- `ComboStep`: Log entry capturing action type `a` (`move`, `pos`, `draw`, `shuffle`, `lp`, `mill`, `todeck`, `token`, `removetoken`, `effect`, `skill`), source/target zones, instance IDs, card IDs, and timestamps.

### 2. State Management & Contexts
- **`CacheContext.tsx`**: Interface to `cardCache.ts`. Queries IndexedDB for cached card details or triggers bulk fetches from YGOPRODeck API when new card IDs are encountered.
- **`DeckContext.tsx`**: Holds `mainDeck` (20-30 cards) and `extraDeck` (0-9 cards), enforces 3-copy limits per card passcode, validates against Duel Links format constraints, and manages import/export state.
- **`GameContext.tsx`**: State engine driving the simulator.
  - Maintains `history` (array of `BoardState` snapshots) for step jump, undo, and redo.
  - Exposes actions: `draw()`, `shuffleDeck()`, `sortDeck()`, `moveCard()`, `changePosition()`, `setLP()`, `sendToGY()`, `sendToBanish()`, `addToHand()`, `returnToDeck()`, `millCards()`, `generateToken()`, `removeToken()`, `activateEffect()`, `activateSkill()`, `returnAllToDecks()`.
  - Manages `recording` mode to automatically append `ComboStep` records onto the step stack.

### 3. File Import & Export (`src/utils/ydkParser.ts`)
- **YDK Parsing**: Reads `.ydk` files line by line under `#main`, `#extra`, and `!side` headers. Converts passcodes to numeric card IDs.
- **YDK Export**: Generates valid `.ydk` text file format for export into Duel Links Meta or YGOPro/EdoPro simulators.
- **Validation**:
  - Main Deck: 20 to 30 cards.
  - Extra Deck: 0 to 9 cards.
  - Maximum 3 copies of any card passcode across Main + Extra.

### 4. Offline Storage & Caching (`src/services/cardCache.ts`)
- Built using `idb` with two object stores: `cards` (key: `id`, indexed by `name`, `type`, `archetype`, `frameType`) and `meta`.
- `fetchAndCacheCards(ids)` checks local IndexedDB first and fetches missing IDs from YGOPRODeck API in batches of 50.

### 5. URL Share Engine (`src/services/urlState.ts`)
- Compacts deck lists and recorded combo steps into lightweight JSON structures.
- Uses `lz-string` to encode compressed state into base64 URI strings embedded in the URL hash (`#d=...`).
- When a shared URL is opened, `SimulatorPage.tsx` automatically decodes the hash, fetches any uncached card IDs, reconstructs the initial deck board state, and replays all history steps to recreate the recorded combo.

### 6. UI & Interactive Field (`src/components/`)
- **`DuelBoard.tsx`**:
  - Implements the official 3-Monster / 3-Spell & Trap / 2-EMZ / 1-Field Duel Links layout using `@dnd-kit`.
  - Supports smooth drag-and-drop card movement across zones.
  - **Dynamic Cascade**: `VerticalStackPileZone` dynamically calculates negative overlapping margins for GY, Banish, and Free zones so card stacks remain visible without overflowing container bounds.
  - **Playback Animation**: When visualizing step history playback, `flyingCard` animates smooth position transitions from source zone coordinates to target zone coordinates.
  - **Effect Glow**: Triggering card effect activations highlights the specific card with a golden pulsating ring (`animate-pulse`).
- **`ComboStepList.tsx`**:
  - Displays recorded steps with corresponding action icons.
  - Provides playback controls: Play/Pause, step backward/forward, jump to start/end, speed multiplier slider (0.25x to 3.0x), and record reset button.
- **`CardDetailPanel.tsx`**:
  - Displays card details with text content prioritized over images.
  - Formats card effect descriptions into structured paragraphs and broken-down sentences for enhanced readability.
  - Clicking the top-right card thumbnail opens a full-screen image modal.
- **`CardContextMenu.tsx`**:
  - Provides right-click contextual actions depending on card zone and position (e.g., Flip ATK/DEF, Set Face-Down, Activate Effect, Remove Token).

---

## Workflow & User Journey

1. **Home (`/`)**: Users view app capabilities and launch either the Deck Builder or Simulator.
2. **Deck Builder (`/build`)**: Users import a `.ydk` file (or drag & drop), view deck contents, check validation warnings (e.g., <20 cards), inspect card details, and export updated `.ydk` files.
3. **Simulator (`/sim`)**:
   - Decks loaded in the Deck Builder or imported via `.ydk` load onto the interactive board.
   - Users can draw opening hands, shuffle, sort, spawn Monster Tokens, adjust Life Points, and drag cards onto Monster/Spell zones.
   - Clicking "Record" logs every action into a `ComboStep` timeline.
   - Clicking "Share" generates a compressed URL hash (`#d=...`) copied directly to the clipboard.
   - Opening a shared URL recreates the exact deck configuration and enables step-by-step animated playback.
