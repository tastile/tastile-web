---
name: architecture
description: Reference for tastile-web architecture: event sourcing pattern, Feature-Sliced Design layout, domain model, state management, sync model, and backend contract. Use when creating new modules, domain models, or working with the event sourcing / command layer.
---

# Architecture

## Event Sourcing Pattern (MANDATORY)

Web follows the same Command/Event/Reducer pattern as Rust Core:

```text
Command (intent)
  ↓
Validation (can we accept this?)
  ↓
Event(s) generated (what actually happened)
  ↓
Event Store append (persistence)
  ↓
Reducer (derive new AppState from events)
  ↓
React re-render
  ↓
Realtime subscription → sync to other devices
```

### Absolute rules

- NEVER mutate AppState directly.
- NEVER store `status`, `running`, `active` as fields — these are **derived**.
- Events are **facts** (TileStarted, TileCompleted), not UI actions (ButtonClicked).
- Each Command has an `actor` (human/agent/cron/loop/system).
- Events are immutable and append-only.

### Lifecycle derivation

`if completedAt != null => done; else if startedAt != null => started; else => ready`

## Backend contract

- **Auth**: AWS Cognito Hosted UI (Google OAuth) + Bearer token
- **API**: tastile-core (Rust/axum) is the sole backend
- **Database**: PostgreSQL (via tastile-core, never direct from web)
- **Billing**: Stripe (post-notification)

### Key endpoints

- Tile data: `/read/tiles`
- Commands: `/commands/*`
- Execution state: derived from snapshot

## Feature-Sliced Design (FSD)

Directory layout (as migrated per `docs/fsd-phase1-plan.md`):

```text
src/
├── app/          # Next.js App Router routes + API handlers
├── shared/       # Cross-cutting: ui/, api/, lib/, i18n/, model/, auth/, stores/, query/, hooks/, analytics/, context/
├── features/     # User-facing: create-tile, execute-tile, manage-tasks, manage-projects, manage-schedule, manage-settings, marketing, view-notifications
├── widgets/      # Composite: app-shell, activity-bar, floating-header, side-tool-panel
├── views/        # Page-level compositions (dashboard/)
├── {tile,execution,calendar}/  # Domain slices with model/ and ui/
└── lib/          # Legacy/non-FSD infrastructure (account, api, billing, notifications, projection, scheduler, security, styles, theme, upstream, vendored)
```

The historical `src/lib/{domain,core,storage,hooks}` layout has been superseded by FSD. Do not add new code to that legacy shape unless an existing module requires it.

## State management

- **Local component state**: React `useState`
- **Global UI state** (modals, theme): Zustand stores in `src/shared/stores/`
- **Server state**: TanStack React Query
- **Execution engine**: delegates to tastile-core API

## Sync model

- **Tiles**: Cloud-authoritative, local cache
- **Events**: Append-only, ordered by `occurred_at`
- **Settings**: Last-write-wins
- **Execution state** (active_tile, phase): browser-local only, not stored in cloud

## UI library

**Mantine v9** with Tailwind CSS v4. Mantine is the preferred primitive for equivalent UI state and lifecycle behavior. React Compiler is enabled — avoid manual memoization (`useMemo`, `useCallback`) unless required by an external library.

## Naming conventions

- Filenames, identifiers, comments: English only
- Internal docs (ADRs, design, specs): Japanese
- Git/GitHub messages: English
- No `utils` / `helpers` / `common` / `misc` / `manager` dumping-ground names
- Directory width: ~10 parallel entries max per level

## Design-first

When design/spec files exist in `docs/`, read them before implementing. Design documents represent the intended final state — not chronological memos or implementation diaries.
