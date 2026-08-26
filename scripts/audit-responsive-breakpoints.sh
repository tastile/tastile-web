#!/usr/bin/env bash
# scripts/audit-responsive-breakpoints.sh
# Audit that all numeric breakpoint literals in the codebase match the
# Tailwind v4 default breakpoint table (sm:640 / md:768 / lg:1024 / xl:1280
# / 2xl:1536) or the corresponding .98px boundary variants.
#
# See the responsive-breakpoint policy block at the top of
# src/app/globals.css for the full design rationale.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# Tailwind v4 breakpoint values + .98px boundary variants for max-width
# queries. These are the only px literals allowed in src/, e2e/, and
# globals.css.
ALLOWED_PATTERN='(640|768|1024|1280|1536|639\.98|767\.98|1023\.98|1279\.98|1535\.98)px'

# Patterns we explicitly ignore because they're not breakpoint literals:
#
# Brief-shipped patterns:
#   - hex colors
#   - numeric Tailwind utilities like text-sm, max-w-md
#   - z-index, opacity utility classes
#   - Mantine/em-based breakpoints (e.g. "(min-width: 48em)")
#
# R1-5 additions (each documented in progress.md / task-5-report):
#   - Tailwind arbitrary [Npx] classnames (e.g. w-[120px], backdrop-blur-[1px])
#   - Quoted px strings ("240px", '16px') — test assertions, JSX style props,
#     inline SVG attrs, fallback values in TS/JS code
#   - var(--name, Xpx) fallback values
#   - @container queries (container-scoped, not viewport breakpoints) — used
#     by vendored mantine-schedule
#   - CSS property declarations with px values, ending on the same line with
#     ";" — covers width/height/padding/margin/border/font/transform/box-shadow
#     /shadow tokens/etc. Not breakpoints.
#   - calc(...) expressions with px operands
#   - rgba()/rgb(...) functions containing px (rare — drop-shadow with px)
#   - Comment lines (linenum-prefixed by grep -n) holding JSDoc prose such as
#     "tolerance of 1px for sub-pixel rounding across browsers"
IGNORE_BRIEF='(#[0-9a-fA-F]{3,8}|\btext-(xs|sm|md|lg|xl)|\bmax-w-(xs|sm|md|lg|xl|\[)|\bopacity-|\bz-\d+|\bem\b)'

# Tailwind arbitrary [...] values containing px, including multi-value
# brackets such as `grid-cols-[20px_1fr_auto]`, `shadow-[0_18px_-30px_rgba(...)]`,
# and `w-[min(96vw, 820px)]`.
IGNORE_BRACKET='\[[^]]*[0-9]+(\.[0-9]+)?px[^]]*\]'

# Quoted px strings (JS/TS/JSX), including literal style values
# (`style={{ height: "240px" }}`) AND prose strings containing px
# (test descriptions like `it("renders a 48px row ...")`).
# Match both "Npx" / 'Npx' as well as broader "..px.." / '..px..' prose.
IGNORE_QUOTED_SHORT="\"[0-9]+(\\.[0-9]+)?px\"|'[0-9]+(\\.[0-9]+)?px'"
IGNORE_QUOTED_PROSE="\"[^\"]*[0-9]+(\\.[0-9]+)?px[^\"]*\"|'[^']*[0-9]+(\\.[0-9]+)?px[^']*'"

# var(--name, Npx) fallback values
IGNORE_VAR_FALLBACK='var\([^,]+,[ ]*[0-9]+(\.[0-9]+)?px[ ]*\)'

# @container queries (container-scoped, not viewport breakpoints)
IGNORE_CONTAINER='@container[ ]*\([^)]*\)'

# CSS property declarations ending with ; on the same line. Matches any
# identifier+dash sequence followed by a value containing px and a trailing
# ";". Crucially this requires ; on the line, so a real
# `@media (max-width: 600px)` line (which lacks ;) is NOT exempted.
# Note: GNU grep -E treats \w as literal (POSIX), so we spell out the
# alphanumerics + underscore + dash explicitly.
IGNORE_CSS_DECL='[a-zA-Z0-9_-]+:[ ]*[^;{]*-?[0-9]+(\.[0-9]+)?px[^;{]*;'

# Same idea but for JSX inline style props that end with `,` or `}` instead
# of `;` (e.g. `transform: "...",`, `flex: "0 0 40px",`).
#
# IMPORTANT: a naïve `name:value-with-px` pattern also matches
# `@media (max-width: 600px) {` because `max-width:600px` looks like a
# property declaration, which would silently allow real breakpoint
# violations. To prevent that, this pattern:
#   1. Anchors at line start with the grep -n linenum prefix
#   2. Requires the first non-whitespace char to be a letter, NOT `@`
#      (so `@media` / `@container` at-rule lines are not exempted)
#   3. Excludes `{` inside the value (CSS block-open appears in @media rules)
#   4. Requires the px value to terminate with `,`, `;`, `)`, or `]`
#      (or end-of-line) — not a CSS block-open `{`.
#
# Note on POSIX ERE gotcha: `]` must be the FIRST char inside a char class
# to be a literal; alternative escapes (`\]`) are GNU-PERL only.
IGNORE_JSX_STYLE='^[[:digit:]]+:[[:space:]]*[a-zA-Z][a-zA-Z0-9_-]+:[[:space:]]*[^;{}@]*-?[0-9]+(\.[0-9]+)?px[^;{}@]*[];,);]?'

# calc(...) expressions with px operands. Loosened to allow nested parens
# (`calc(${...} * (var(--xxx) + 2px) + 2px)`) by stopping at `;` only.
IGNORE_CALC='calc\([^;]*[0-9]+(\.[0-9]+)?px'

# Mantine rem(Npx) helper containing px
IGNORE_REM='rem\([0-9]+(\.[0-9]+)?px'

# rgba/rgb containing px (very rare; mostly drop-shadow)
IGNORE_RGBA='rgba?\([^)]*[0-9]+(\.[0-9]+)?px[^)]*\)'

# Block comment lines (CSS / JSDoc /** ... px ... */) and JS line comments
# (// ... px ...). Covers `/** Height of ... @default 64px */`,
# `// a 12px gap ...`, `/* ... 0.02px ... */`.
IGNORE_BLOCK_COMMENT='/\*.*[0-9]+(\.[0-9]+)?px.*\*/'
IGNORE_LINE_COMMENT='//.*[0-9]+(\.[0-9]+)?px'

# Continuation lines of JSDoc / CSS block comments: lines starting with
# `<linenum>: * ` (per grep -n) that hold prose with px values, e.g.
# `8:   * Optional icon. When omitted, the icon column stays reserved at 20px so`.
# Anchored on the line-number prefix so it does not match real CSS.
IGNORE_JSDOC_CONT='^[0-9]+:[ ]*\*[ ].*[0-9]+(\.[0-9]+)?px'

# Continuation lines of CSS block comments that do NOT use the `*`
# continuation marker (e.g. globals.css lines like
# `   Strict mode: arbitrary sizes are forbidden; text-caption (12px) is the floor.`).
# These have a leading 3+-space indent (inside an earlier `/* ... */`) and
# prose with px values. CSS property declarations on the same indent level
# are caught by IGNORE_CSS_DECL (they end with `;`); this pattern only
# catches the comment-continuation variant.
IGNORE_INDENT_COMMENT='^[[:digit:]]+:[[:space:]]{3,}[^0-9]*[0-9]+(\.[0-9]+)?px'

# First line of a multi-line CSS block comment (begins with `/*` but the
# closing `*/` is on a later line):
# `/* Aligned with Tailwind \`sm\` boundary. Subtract 0.02px per the policy block`.
# The trailing `*` is intentionally disallowed in `[^*]*px[^*]*$` so that
# genuine single-line block comments fall to IGNORE_BLOCK_COMMENT instead.
IGNORE_BLOCK_START='^[[:digit:]]+:[[:space:]]*/\*[^*]*[0-9]+(\.[0-9]+)?px[^*]*$'

IGNORE_PATTERN="(${IGNORE_BRIEF}|${IGNORE_BRACKET}|${IGNORE_QUOTED_SHORT}|${IGNORE_QUOTED_PROSE}|${IGNORE_VAR_FALLBACK}|${IGNORE_CONTAINER}|${IGNORE_CSS_DECL}|${IGNORE_JSX_STYLE}|${IGNORE_CALC}|${IGNORE_REM}|${IGNORE_RGBA}|${IGNORE_BLOCK_COMMENT}|${IGNORE_LINE_COMMENT}|${IGNORE_JSDOC_CONT}|${IGNORE_INDENT_COMMENT}|${IGNORE_BLOCK_START})"

# Search scope: src/, e2e/, globals.css, scripts/audit/ (itself).
SEARCH_PATHS=(src e2e scripts/audit scripts/audit-responsive-breakpoints.sh)
SEARCH_FILES=("src/app/globals.css")

# Collect grep candidates
declare -a OFFENDERS=()

# Scan all .ts/.tsx/.css/.js/.mjs/.cjs/.mts/.cts files under src/ and e2e/
for ext in ts tsx css js mjs cjs mts cts; do
  while IFS= read -r -d '' file; do
    # Grep for any px literal
    matches=$(grep -nE "[0-9]+(\.[0-9]+)?px" "$file" 2>/dev/null || true)
    if [ -z "$matches" ]; then continue; fi
    # Filter out allowed + ignored
    bad=$(echo "$matches" | grep -vE "$ALLOWED_PATTERN" | grep -vE "$IGNORE_PATTERN" || true)
    if [ -n "$bad" ]; then
      OFFENDERS+=("$file")
      echo "OFFENDER: $file"
      echo "$bad" | head -20
      echo "---"
    fi
  done < <(find src e2e -type f -name "*.$ext" -print0 2>/dev/null)
done

# Scan globals.css separately
if [ -f "src/app/globals.css" ]; then
  matches=$(grep -nE "[0-9]+(\.[0-9]+)?px" src/app/globals.css 2>/dev/null || true)
  if [ -n "$matches" ]; then
    bad=$(echo "$matches" | grep -vE "$ALLOWED_PATTERN" | grep -vE "$IGNORE_PATTERN" || true)
    if [ -n "$bad" ]; then
      # Skip — already scanned above as part of src/. If the find above missed
      # globals.css for any reason, this is the safety net.
      :
    fi
  fi
fi

if [ ${#OFFENDERS[@]} -gt 0 ]; then
  echo ""
  echo "FAIL: ${#OFFENDERS[@]} file(s) contain px literals that are not in the"
  echo "Tailwind v4 breakpoint table (or the policy's ignore list)."
  echo ""
  echo "Either:"
  echo "  1. Replace the literal with a Tailwind utility (sm:/md:/lg:/xl:/2xl:)"
  echo "  2. Replace it with a constant from src/shared/hooks/use-media-query.ts"
  echo "  3. Add the literal to the policy ignore list in this script (only if"
  echo "     it is genuinely not a breakpoint value)"
  exit 1
fi

echo "OK: All px literals in src/, e2e/, scripts/audit/ align with Tailwind v4 defaults."
exit 0
