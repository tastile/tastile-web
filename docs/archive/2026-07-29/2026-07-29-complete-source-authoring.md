# Complete Source Authoring Plan

## Goal

Make QuickTileCreate capable of authoring the generic SourceTile graph required
by `tastile-core-handoff-kimi-k3.md` without use-case flags or JSON input.

## Scope and order

1. Replace hidden/default-only SourceSchedule fields with typed store state:
   local offset, excluded dates, required/preferred duration, split policy,
   priority, and availability window.
2. Add typed relation draft state and a Relation editor using existing/local
   SourceTile references. Publish relations atomically with the SourceTile.
3. Add typed placement/nesting rule editors and preserve them in the atomic
   publish payload.
4. Add generic Flow signal/candidate/sequence authoring and publish it without
   title-specific behavior.
5. Add Completion, Metric, Decision, hierarchy, and delivery policy editors.
6. Exercise the study-life fixture through the real Core WSLC stack and browser.

## Contracts

- SourceTile is the generation source; no new Recurring write path.
- Relations are peer edges. UI wording may explain containment, but persisted
  data does not introduce parent/child entity types.
- No title, icon, color, project path, or special-use-case scheduler branch.
- All authored values must survive store → wire → atomic publish → normalized
  Core rows.
- Existing uncommitted Web work is preserved and integrated, never reset.

## Verification

- Focused store/wire/component tests for every added editor.
- `bun run check:release` inside WSLC.
- Real Core + Web WSLC E2E for labels, references, nesting, split workflow,
  execution, and decision feedback.
- Browser console and API errors must be zero.

