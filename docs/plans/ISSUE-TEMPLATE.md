# Issue Template — Tile Creation E2E Wiring

Each issue is **one sub-project** from `04-sub-projects/`. It is posted as a **title + 1 body + 5 follow-up comments** so each section stays scannable in the GitHub UI without scrolling through a wall of text.

## Structure

| # | Slot | Heading | Purpose |
|---|---|---|---|
| 0 | Title | `[<ID>] <sub-project subject>` | One glance: which sub-project, what |
| 1 | Body | `## 目的` + `## 受入条件` | TL;DR — what + how we know it's done |
| 2 | Comment 2 | `## 変更手順` | How to do it (numbered file:line refs) |
| 3 | Comment 3 | `## e2e 検証` | How to prove it (Playwright spec, DB queries) |
| 4 | Comment 4 | `## リスク` | What could go wrong |
| 5 | Comment 5 | `## オープン質問` + `## 関連` | What's unresolved + cross-refs |

## Why multiple comments (not one long body)

- **Scannability**: GitHub's web UI lets readers jump to any comment by anchor. One wall-of-text issue forces scroll.
- **Threading**: follow-ups to specific sections (e.g. "is step 3 actually needed?") attach to that comment, not the whole issue.
- **Diffable**: each comment is a separate unit. If a step changes, that comment updates — the body stays the TL;DR.
- **Referenceable**: you can deep-link to a specific comment by `#issuecomment-XXXXXXX`.

## Title pattern

```
[<SUBPROJECT_ID>] <subject>
```

Examples (real titles from `04-sub-projects/`):

- `[G] Bring up core v1 daemon via wslc + fix e2e docker→wslc swap`
- `[H] Align bridge secret between web and core`
- `[A] Wire §1 Identity + §2 Plan + §7 Meta (minimum) for tile persistence`
- `[D] Resolve §5/§6 throw sites in quick-create-schedule-wire.ts`
- `[E] Fix recurring.condition silent drop + add Condition AST editor`

## Body (Comment 1)

```markdown
## 目的

<one paragraph from sub-project file `## 目的`>

## 受入条件

<bullet list from sub-project file `## 受入条件` or synthesized from `## 変更手順` verification>

---

**Sub-project ID**: <A–H>
**Target repo**: <tastile-core | tastile-web>
**Source spec**: `tile-create-e2e-wiring/04-sub-projects/<file>.md`
**Phase**: <0 | 1 | 2 | 3 from `05-impl-order.md`>
**Depends on**: <list of sub-project IDs>
```

## Comment 2 — 変更手順

Numbered, with file:line refs. Verbatim copy from the sub-project file's `## 変更手順` section.

## Comment 3 — e2e 検証

Verbatim copy from `## e2e 検証`. Include the Playwright spec name, the DB row assertions, and any curl verification steps.

## Comment 4 — リスク

Verbatim copy from `## リスク`. If the sub-project file uses different section names, normalize to `## リスク`.

## Comment 5 — オープン質問 + 関連

```markdown
## オープン質問

<verbatim from `## オープン質問`>

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/<file>.md`
- Master overview: `tile-create-e2e-wiring/00-overview.md`
- Gap matrix row(s): <cite `03-gap-matrix.md` line numbers>
- Blocked by: <sub-project IDs from `05-impl-order.md`>
- Blocks: <sub-project IDs>
```

## Labels to apply

```
bug, enhancement, docs, infra, auth, e2e, web, core
```

Per-issue label set is configured in `scripts/TARGETS.md` — the script applies them automatically.

## What this template does NOT include

- **Implementation code**: the issue is the plan, not the patch. The PR is a separate artifact.
- **Screenshots**: skip unless the sub-project is purely visual (none of A–H are).
- **Free-form discussion**: questions go in `## オープン質問`, not the body.

## Anti-patterns to avoid when authoring

- ❌ One giant body comment covering everything — use the 6-slot structure
- ❌ Vague acceptance criteria ("make it work") — use observable DB rows + spec names
- ❌ References to local file paths without line numbers — every `file:line` or it's not verifiable
- ❌ Sub-project body copied verbatim from `04-sub-projects/*.md` without normalizing section names
- ❌ Cross-repo issues (one issue that touches both core and web) — split per repo