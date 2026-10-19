# Scripts — Issue Creation

## Files

| File | Purpose |
|---|---|
| `create-issue.sh` | Posts one GitHub Issue from a sub-project markdown file (title + body + 5 follow-up comments). |
| `TARGETS.md` | Sub-project → target repo + labels mapping. |
| `../ISSUE-TEMPLATE.md` | Canonical 6-slot structure (title + body + 5 comments). |

## How `create-issue.sh` works

1. Reads a sub-project markdown file (e.g. `04-sub-projects/G-stack-up.md`).
2. Extracts sections by H2 header: `## 目的`, `## 対象フィールド`, `## 変更手順`, `## e2e 検証`, `## リスク`, `## オープン質問`, `## スコープ外`.
3. Builds:
   - **Title** from the file's H1 (e.g. `# G — Stack Up` → `[G] Bring up core v1 daemon via wslc`).
   - **Body** (Comment 1) from `## 目的` + a synthesized `## 受入条件` + the source spec / phase / depends-on metadata.
   - **Comment 2** from `## 変更手順`.
   - **Comment 3** from `## e2e 検証`.
   - **Comment 4** from `## リスク`.
   - **Comment 5** from `## オープン質問` + a `## 関連` block.
4. Posts via `gh issue create` then `gh issue comment <num>` per follow-up comment.

## Usage

```bash
# Dry-run (no posting, prints what would be sent)
./scripts/create-issue.sh 04-sub-projects/G-stack-up.md \
  --repo tastile-web \
  --labels web,infra,e2e \
  --dry-run

# Real post
./scripts/create-issue.sh 04-sub-projects/G-stack-up.md \
  --repo tastile-web \
  --labels web,infra,e2e
```

## CLI surface

```
./scripts/create-issue.sh <sub-project-file> \
  --repo <owner/name>           # required: GitHub repo to post to
  --labels label1,label2        # optional: comma-separated labels
  --title-override "<title>"    # optional: replace derived title
  --dry-run                     # optional: print, do not post
  -h | --help                   # show help
```

## Why bash + gh CLI (not a JS script)

- `gh` CLI is already authenticated on this machine.
- Bash with `awk` + `sed` is enough to slice markdown by H2 headers.
- No build step, no dependency surface, no package.json required.
- The script runs from WSL/Git Bash on this Windows host via the standard `gh` install path.

If you later need richer parsing (e.g. nested H3 sections, table extraction), promote this to TypeScript + a markdown parser. Not yet needed.

## Failure modes

| Symptom | Cause | Fix |
|---|---|---|
| `gh: command not found` | gh CLI not installed | Install via `winget install GitHub.cli` then `gh auth login` |
| `GraphQL: Could not resolve to a Repository` | Repo name typo or no access | Verify with `gh repo view <owner/name>` |
| `403 Forbidden` on `gh issue create` | No write access to target repo | Confirm collaborator status on the repo |
| Label not found (warning, not error) | Label doesn't exist on repo | `gh label create <name> --color <hex>` per repo |
| Section extraction is empty | Sub-project file uses different H2 names | Edit the section map in `create-issue.sh` `SECTION_NAMES` |

## Section name map

The script extracts sections by exact H2 match. If a sub-project file uses a synonym, edit the `SECTION_NAMES` array in the script:

```bash
# In create-issue.sh
SECTION_NAMES=(
  "目的"
  "対象フィールド"
  "変更手順"
  "e2e 検証"
  "リスク"
  "オープン質問"
  "スコープ外"
)
```

For sections that don't exist in a given sub-project file (e.g. `## 対象フィールド` is missing), the corresponding comment is omitted (no empty comments posted).

## Verifying the script without posting

Always run with `--dry-run` first. The output shows each comment block exactly as it would be posted, prefixed with `=== COMMENT N ===`. If the section extraction looks wrong, fix the script before posting for real.

## Post-creation

After the issue is live, the body contains the link back to the source spec. If you make changes to the sub-project file later, edit the issue's comments (or post a new "update" comment) — don't leave the spec and the issue drifting.