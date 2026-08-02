# Feature-Sliced Architecture Migration Plan

Based on https://feature-sliced.design/docs/guides/migration/from-custom

## Current Architecture Analysis

### Layer 1: Dumb Shell (Current)
- `src/app/` - Next.js application layer
- UI components, hooks, pages

### Layer 2: Boring Domain (Current)
- `src/lib/domain/` - Tile, Plan, Execution models
- `src/lib/core/` - Command, Event, State, Handler

### Layer 3: Feature Slices (Current)
- `src/lib/mock-data.ts` - Mock data for testing
- Dashboard components with inline logic

## Proposed Feature-Sliced Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Layer 0: Dumb Shell                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Pages     │  │   Components │  │     Hooks    │      │
│  │  (Next.js)   │  │  (React)     │  │  (React)     │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│                Layer 1: API Layer                           │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  tastileCore (Singleton)                             │   │
│  │  - API Client abstraction                            │   │
│  │  - tastile-core API wrapper                         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│               Layer 2: Domain Layer                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Domain     │  │  Core       │  │  Validation         │  │
│  │  Entities   │  │  Command    │  │  Rules              │  │
│  │             │  │  & Event    │  │                      │  │
│  │  Tile       │  │  Handler    │  │                      │  │
│  │  Plan       │  │  Reducer    │  │                      │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│              Layer 3: Feature Slices                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Dashboard (Tiles, Execution, Events)                │   │
│  │  - Inline state management                           │   │
│  │  - Local component state                             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          ▼                 ▼                 ▼
┌─────────────────────────────────────────────────────────────┐
│            Layer 4: Infrastructure Layer                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  tastile-core (Rust)                                 │   │
│  │  - PostgreSQL storage                                │   │
│  │  - HTTP API                                          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Migration Phases

### Phase 1: API Layer (Completed)
- `src/lib/api/` - tastile-core API abstraction
- `src/lib/core/api-client.ts` - Singleton API client
- `src/lib/api/tiles.ts` - Tile operations

### Phase 2: Domain Layer (Completed)
- `src/lib/domain/tile.ts` - Tile entity
- `src/lib/domain/ids.ts` - ID types
- `src/lib/domain/reducer.ts` - Event → AppState
- `src/lib/core/command.ts` - Command types
- `src/lib/core/event.ts` - Event types
- `src/lib/core/state.ts` - AppState interface
- `src/lib/core/validate.ts` - Validation rules
- `src/lib/core/reducer.ts` - Command → AppState

### Phase 3: Feature Slices (Next)
- Dashboard components using Domain + API
- Inline state management (no external stores)
- Realtime subscriptions for execution state

## Key Principles

1. **Dependency Inversion**
   - UI → API Layer → Domain Layer → Infrastructure
   - Domain layer has no knowledge of UI or Infrastructure

2. **Event Sourcing**
   - All state changes are events
   - AppState is derived from events, not stored directly
   - Lifecycle: `if completedAt != null => done; else if startedAt != null => started; else => ready`

3. **Facts, Not States**
   - Core stores what happened (events, timestamps)
   - Status is derived, NOT stored

## File Structure

```
src/lib/
├── api/
│   ├── index.ts           # Main API exports
│   ├── tiles.ts           # Tile operations
│   └── events.ts          # Event operations
├── domain/
│   ├── actor.ts           # Actor types
│   ├── calendar.ts        # Calendar logic
│   ├── execution.ts       # Execution model
│   ├── ids.ts             # ID types
│   ├── reducer.ts         # Reducer logic
│   └── tile.ts            # Tile entity
├── core/
│   ├── api-client.ts      # API client (singleton)
│   ├── command.ts         # Command types
│   ├── event.ts           # Event types
│   ├── handler.ts         # Command → Events
│   ├── reducer.ts         # Command → AppState
│   ├── state.ts           # AppState interface
│   └── validate.ts        # Validation rules
├── hooks/
│   └── use-execution-engine.ts  # React integration
├── mock-data.ts           # Legacy (to be phased out)
└── stores/
    └── ...                # Zustand stores (if needed)
```

## Testing

```bash
bun test src/lib/core/command.test.ts
bun test src/lib/core/event.test.ts
bun test src/lib/domain/tile.test.ts
```

## Next Steps

1. Phase 1: API Layer - Complete
2. Phase 2: Domain Layer - Complete
3. Phase 3: Feature Slices - Dashboard components using new architecture
4. Phase 4: Realtime - WebSockets for execution state sync
5. Phase 5: Mobile - Android/iOS integration
