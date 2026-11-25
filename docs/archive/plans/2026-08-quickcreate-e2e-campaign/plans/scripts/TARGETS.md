# Sub-project → Target Repo Mapping

Each sub-project gets **one issue per repo** it touches. Run `scripts/create-issue.sh` once per (sub-project, repo) pair.

| Sub-project | Title slug | Target repos | Labels | Phase | Depends on |
|---|---|---|---|---|---|
| **A** — `A-tile-plan.md` | Wire Identity + Plan + Meta-min for tile persistence | `tastile/tastile-web` | `web, enhancement` | 1 | G, H |
| **B** — `B-time-windows.md` | Wire Time + Windows for placement persistence | `tastile/tastile-web` | `web, enhancement` | 1 | G, H |
| **C** — `C-recurring-source.md` | Wire Recurring core + Source for SourceSchedule | `tastile/tastile-web` | `web, enhancement` | 1 | G, H |
| **D** — `D-frame-rules.md` | Resolve §5/§6 throw sites (ChangeSets / frameRules / flows) | `tastile/tastile-web` | `web, enhancement` | 2 | A, G, H |
| **E** — `E-condition-tree.md` | Fix recurring.condition silent drop + add Condition AST editor | `tastile/tastile-web`, `tastile/tastile-core` | `web, core, enhancement` | 3 | A, C, G, H |
| **F** — `F-meta-attrs.md` | Resolve §7 project/tags throw site | `tastile/tastile-web` | `web, enhancement` | 2 | A, G, H |
| **G** — `G-stack-up.md` | Bring up core via wslc + fix e2e docker→wslc | `tastile/tastile-web`, `tastile/tastile-core` | `web, core, infra, e2e` | 0 | — |
| **H** — `H-auth-bridge.md` | Align bridge secret between web and core | `tastile/tastile-web`, `tastile/tastile-core` | `web, core, auth, infra` | 0 | G |

## Reasoning

- **A, B, C, D, F** — wire changes only live in `tastile-web`. Core already supports the wire shapes.
- **E** — wire extension in web, plus possibly core support for new Condition variants. Split per repo.
- **G** — `tastile-core` side: `scripts/wslc/up-v1.sh`, `Containerfile.v1`. `tastile-web` side: `e2e/helpers/v1.ts` + 4 spec files. Split per repo.
- **H** — `tastile-core` side: env var contract + bridge handler already implemented; issue is configuration. `tastile-web` side: `src/app/api/proxy/[...path]/route.ts` bridge header logic. Split per repo.

## Per-repo invocation matrix

To create all 10 issues (some sub-projects have 2 targets), run:

```bash
cd tile-create-e2e-wiring

# tastile-web issues (7)
./scripts/create-issue.sh 04-sub-projects/A-tile-plan.md        --repo tastile/tastile-web --labels web,enhancement
./scripts/create-issue.sh 04-sub-projects/B-time-windows.md     --repo tastile/tastile-web --labels web,enhancement
./scripts/create-issue.sh 04-sub-projects/C-recurring-source.md --repo tastile/tastile-web --labels web,enhancement
./scripts/create-issue.sh 04-sub-projects/D-frame-rules.md      --repo tastile/tastile-web --labels web,enhancement
./scripts/create-issue.sh 04-sub-projects/E-condition-tree.md   --repo tastile/tastile-web --labels web,enhancement
./scripts/create-issue.sh 04-sub-projects/F-meta-attrs.md       --repo tastile/tastile-web --labels web,enhancement
./scripts/create-issue.sh 04-sub-projects/G-stack-up.md         --repo tastile/tastile-web --labels web,infra,e2e
./scripts/create-issue.sh 04-sub-projects/H-auth-bridge.md      --repo tastile/tastile-web --labels web,auth,infra

# tastile-core issues (3 — only the sub-projects that touch core)
./scripts/create-issue.sh 04-sub-projects/E-condition-tree.md   --repo tastile/tastile-core --labels core,enhancement
./scripts/create-issue.sh 04-sub-projects/G-stack-up.md         --repo tastile/tastile-core --labels core,infra,e2e
./scripts/create-issue.sh 04-sub-projects/H-auth-bridge.md      --repo tastile/tastile-core --labels core,auth,infra
```

Total: 11 invocations → 11 issues (E is posted to both repos; G and H too).

## Prerequisites before running

1. `gh auth status` — authenticated
2. `gh repo set-default` or pass `--repo owner/name` (the script accepts both forms)
3. Each target repo has the labels in `Labels` columns created. If not, `gh label create <name> --color <hex>` first.

## Idempotency

The script is **not** idempotent. Running it twice creates duplicate issues. If you need to retry:
- Close the original issue with `gh issue close <num> --reason "duplicate" --comment "..."`
- Re-run the script

Or use `--dry-run` to preview without posting.