# Implementation Plan: Multi-Simulator Support with Dynamic Slugs

## Overview

Transform the single-simulator app into a multi-simulator platform where:
- Each simulator has a unique **slug** (e.g., `/drk`, `/training-1`, `/demo`)
- Each simulator has its own **title**, **subtitle**, **accent color**, and **configuration**
- The config page has **tabs** for managing multiple simulators
- The root `/` redirects to a default simulator

---

## User Decisions

- **Default redirect**: `/` redirects to the default simulator (no list view)
- **Authentication**: Keep global authentication
- **Slug editing**: Existing slugs ARE editable (with redirect handling)
- **Accent color**: Each simulator has a customizable hex color for hero, buttons, and UI elements

---

## Current State → Target State

| Aspect | Current | Target |
|--------|---------|--------|
| URL Structure | `/` (single simulator) | `/:slug` (per-simulator), `/` redirects to default |
| Config Page | Single form | Tabbed interface, one tab per simulator |
| KV Storage | `red-cross-caller:prompt-config` | `simulators:[slug]:config` per simulator |
| Title/Subtitle | Hardcoded in component | Stored per-simulator in config |
| Accent Color | Hardcoded red (#C41E3A) | Per-simulator hex color |
| Simulator Identity | None | slug, title, subtitle, accentColor, createdAt |

---

## Data Model

### New Types (`src/types/index.ts`)

```typescript
// Simulator metadata (displayed on home screen)
interface SimulatorMetadata {
  slug: string;              // URL path: "drk", "training-1", etc.
  title: string;             // "DRK Anrufsimulator"
  subtitle: string;          // "Trainingsumgebung für Spenderhöhungsanrufe"
  accentColor: string;       // Hex color code: "#C41E3A" (DRK red default)
  createdAt: string;         // ISO timestamp
  updatedAt: string;         // ISO timestamp
}

// Full simulator config (extends existing PromptConfig)
interface SimulatorConfig extends PromptConfig {
  metadata: SimulatorMetadata;
}

// Index of all simulators (stored in KV)
interface SimulatorIndex {
  simulators: SimulatorMetadata[];
  defaultSlug: string;       // Required - which simulator "/" redirects to
}
```

### KV Storage Keys

```
red-cross-caller:simulators:index           → SimulatorIndex
red-cross-caller:simulators:[slug]:config   → SimulatorConfig
```

---

## Implementation Steps

### Step 1: Update Types and Defaults
**Files**: `src/types/index.ts`

1. Add `SimulatorMetadata` interface (with `accentColor` field)
2. Add `SimulatorConfig` interface (PromptConfig + metadata)
3. Add `SimulatorIndex` interface
4. Create `DEFAULT_SIMULATOR_METADATA` with DRK defaults (accentColor: "#C41E3A")
5. Create `DEFAULT_SIMULATOR_CONFIG` combining existing defaults with metadata
6. Add hex color validation utility function

### Step 2: Create Simulator API Endpoints
**Files**: New files in `api/simulators/`

1. **`api/simulators/list.ts`** - `GET /api/simulators/list`
   - Returns `SimulatorIndex` with all simulator metadata
   - Used by config page tabs and root page

2. **`api/simulators/[slug]/get.ts`** - `GET /api/simulators/[slug]/get`
   - Returns full `SimulatorConfig` for a specific slug
   - Used by simulator home page and call interface

3. **`api/simulators/[slug]/update.ts`** - `POST /api/simulators/[slug]/update`
   - Updates `SimulatorConfig` for a specific slug
   - Creates new simulator if slug doesn't exist
   - Updates the index automatically

4. **`api/simulators/[slug]/delete.ts`** - `DELETE /api/simulators/[slug]/delete`
   - Removes simulator from index and deletes its config
   - Prevents deleting the last simulator

### Step 3: Update Development Server Plugin
**Files**: `vite-plugin-api.ts`

1. Add in-memory storage for multiple simulators: `Map<string, SimulatorConfig>`
2. Add index storage: `SimulatorIndex`
3. Implement mock handlers for all new endpoints
4. Seed with default DRK simulator on init

### Step 4: Update Routing
**Files**: `src/App.tsx`

1. Add route `/:slug` → `SimulatorPage` (new component)
2. Add route `/:slug/config` → Redirect to `/config?simulator=:slug`
3. Keep `/config` for main config page (with tabs)
4. Update `/` to either:
   - Show simulator list, OR
   - Redirect to default simulator (if configured)

### Step 5: Create Simulator Page Component
**Files**: New `src/pages/SimulatorPage.tsx`

1. Extract slug from URL params
2. Fetch `SimulatorConfig` via `/api/simulators/[slug]/get`
3. Pass metadata (title, subtitle) to `CallInterface`
4. Handle 404 if slug not found

### Step 6: Update CallInterface Component
**Files**: `src/components/CallInterface.tsx`

1. Add props for `title`, `subtitle`, and `accentColor` (with fallback defaults)
2. Replace hardcoded strings with props
3. Apply `accentColor` to:
   - Hero background gradient
   - "Anruf starten" button background
   - "Annehmen" button background
   - Phone visualization accent elements
   - Any other red-colored UI elements
4. Use CSS custom properties or inline styles for dynamic color application
5. Keep existing call state logic unchanged

### Step 7: Redesign Config Page with Tabs
**Files**: `src/pages/Config.tsx`

1. Fetch simulator list on mount
2. Render tabs (one per simulator) + "Add New" tab
3. Each tab shows:
   - **Simulator Settings section** (NEW):
     - Slug (editable - warn if changing existing slug)
     - Title
     - Subtitle
     - Accent Color (hex input with color preview swatch)
   - **Agent Settings section** (existing)
   - **Donor Information section** (existing)
   - **System Prompt section** (existing)
4. Add "Delete Simulator" button (disabled if last one)
5. Save updates to respective simulator's config
6. Support `?simulator=:slug` query param to auto-select tab
7. Handle slug changes: update index, redirect if needed

### Step 8: Update Home Page
**Files**: `src/pages/Home.tsx`

1. Fetch default simulator slug from index
2. Redirect to `/:defaultSlug` immediately
3. Show loading state while fetching

### Step 9: Migration Strategy

1. On first load of new API endpoints:
   - Check if old `red-cross-caller:prompt-config` key exists
   - If yes, migrate to `red-cross-caller:simulators:drk:config`
   - Create index with DRK as default
   - Delete old key after successful migration
2. This ensures existing deployments don't lose config

---

## File Changes Summary

### New Files
- `src/types/simulator.ts` (or extend `index.ts`)
- `api/simulators/list.ts`
- `api/simulators/[slug]/get.ts`
- `api/simulators/[slug]/update.ts`
- `api/simulators/[slug]/delete.ts`
- `src/pages/SimulatorPage.tsx`

### Modified Files
- `src/types/index.ts` - Add new interfaces
- `src/App.tsx` - Add routes for `/:slug`
- `src/components/CallInterface.tsx` - Accept title/subtitle props
- `src/pages/Config.tsx` - Complete redesign with tabs
- `src/pages/Home.tsx` - Simulator list or redirect
- `vite-plugin-api.ts` - Add mock endpoints

### Deprecated (after migration)
- `api/config/get.ts` - Replaced by simulator-specific endpoint
- `api/config/update.ts` - Replaced by simulator-specific endpoint

---

## UI/UX Details

### Config Page Tab Design

```
┌─────────────────────────────────────────────────────────────────┐
│  [DRK] [Training-1] [Demo] [+ Neu]                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Simulator-Einstellungen                                        │
│  ├─ Slug: [drk____________]                                     │
│  ├─ Titel: [DRK Anrufsimulator_______________]                  │
│  ├─ Untertitel: [Trainingsumgebung für Spenderhöhungsanrufe]    │
│  └─ Akzentfarbe: [#C41E3A] [■] ← color preview swatch           │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  Agenten-Einstellungen                                          │
│  ├─ Name: Sarah                                                 │
│  ├─ Tonfall: [Freundlich ▼]                                     │
│  └─ Stimme: [marin ⭐ ▼]                                        │
│                                                                 │
│  ... (rest of existing form fields)                             │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│  [Speichern]                        [Simulator löschen]         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Acceptance Criteria

1. **Routing**: `/:slug` loads the correct simulator with its title/subtitle/accentColor
2. **Config Tabs**: Each simulator has its own tab in the config page
3. **Isolated Settings**: Changes to one simulator don't affect others
4. **CRUD Operations**: Can create, read, update, delete simulators
5. **Slug Validation**: Slugs are URL-safe (lowercase, alphanumeric, hyphens)
6. **Slug Editing**: Can change existing slugs (updates index accordingly)
7. **Migration**: Existing DRK config migrated automatically
8. **Default Behavior**: `/` redirects to default simulator
9. **Accent Color**: Hex input with validation, applies to hero/buttons/UI
10. **German UI**: All new UI strings in German

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Data loss during migration | Keep old key until confirmed migration |
| Invalid slugs | Validate on input + sanitize |
| Concurrent edits | Last-write-wins (acceptable for POC) |
| Large number of simulators | Paginate list endpoint if needed |

---

## Estimated Scope

- **New files**: 6
- **Modified files**: 6
- **Lines of code**: ~800-1000 (including tests)
- **Complexity**: Medium-High (new data model + UI redesign)

---

## Resolved Questions

1. **Default redirect**: `/` redirects to default simulator ✓
2. **Authentication**: Keep global authentication ✓
3. **Slug editing**: Existing slugs ARE editable ✓
4. **Accent color**: Per-simulator hex color for hero/buttons/UI ✓
