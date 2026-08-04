#!/usr/bin/env node
// Line-by-line rewire of remaining sub-panels in QuickTileCreate.tsx.
// Strategy:
//   1. Find each <section ... data-subpanel="X" ...> opening tag (multi-line).
//   2. Walk forward to the matching </section> by tracking <section/</section> depth.
//   3. Strip the <SubPanelHeader .../> block and any leading inner wrapper div.
//   4. Wrap the body in <SubPanelShell panelKey="X" title=... description=...>.
//
// Line-by-line parsing avoids regex matching too greedily across boundaries.

import fs from "node:fs";

const FILE = "src/components/tiles/QuickTileCreate.tsx";
const lines = fs.readFileSync(FILE, "utf8").split("\n");

// Title/description for each remaining panel.
const PANELS = {
  time: {
    title: "t(\"quickCreate.timeNavTitle\")",
    description: "t(\"quickCreate.timeNavSub\")",
  },
  duration: {
    title: "t(\"quickCreate.durationTitle\")",
    description: "t(\"quickCreate.durationSub\")",
  },
  recurring: {
    title: "t(\"quickCreate.repeatChip\")",
    description: null,
  },
  "source-rules": {
    title: "\"配置・分割・ローカル日付\"",
    description: null,
  },
  relations: {
    title: "\"Source参照関係\"",
    description: null,
  },
  flows: {
    title: "\"条件駆動Flow\"",
    description: null,
  },
  "placement-rules": {
    title: "\"配置ルール\"",
    description: null,
  },
  references: {
    title: "t(\"quickCreate.referencesNavTitle\")",
    description: null,
  },
  completion: {
    title: "t(\"quickCreate.completionNavTitle\")",
    description: null,
  },
  meta: {
    title: "t(\"quickCreate.metaNavTitle\")",
    description: null,
  },
  task: {
    title: "t(\"quickCreate.taskDetailTitle\")",
    description: "t(\"quickCreate.taskDetailSub\")",
  },
};

// Locate each <section ... data-subpanel="X" ...> opening. The opening tag
// spans multiple lines until the `>` closing brace. Returns the index of the
// line with `<section` start.
function findOpeningIndex(lines, panelKey) {
  for (let i = 0; i < lines.length; i++) {
    if (!/^\s*<section\b/.test(lines[i])) continue;
    // Walk forward until we find `data-subpanel="X"` or hit a non-attribute line
    for (let j = i + 1; j < i + 12 && j < lines.length; j++) {
      if (lines[j].includes(`data-subpanel="${panelKey}"`)) return i;
      // Stop if we hit a `>` (closing of opening tag) without finding the attr
      if (/^\s*>/.test(lines[j])) break;
      // Stop if we hit a body line (a line that doesn't start with whitespace + attr)
      if (!/^\s+[a-zA-Z]/.test(lines[j])) break;
    }
  }
  return -1;
}

// Track <section>/</section> depth from startIdx to find closing </section>.
function findClosingIndex(lines, startIdx) {
  let depth = 1;
  for (let i = startIdx + 1; i < lines.length; i++) {
    const l = lines[i];
    const opens = (l.match(/<section[\s>]/g) || []).length;
    const closes = (l.match(/<\/section>/g) || []).length;
    depth += opens - closes;
    if (depth === 0) return i;
  }
  return -1;
}

// Process each panel and rebuild the lines.
const output = [];
let skipUntilIdx = -1;

for (let i = 0; i < lines.length; i++) {
  if (i < skipUntilIdx) continue;

  // Is this line the start of a <section ...> we care about?
  let matched = null;
  for (const key of Object.keys(PANELS)) {
    if (/^\s*<section\b/.test(lines[i])) {
      // Look ahead in the opening tag (max 12 lines)
      for (let j = i + 1; j < i + 12 && j < lines.length; j++) {
        if (lines[j].includes(`data-subpanel="${key}"`)) {
          matched = key;
          break;
        }
        if (/^\s*>/.test(lines[j])) break;
        if (!/^\s+[a-zA-Z]/.test(lines[j])) break;
      }
      if (matched) break;
    }
  }

  if (!matched) {
    output.push(lines[i]);
    continue;
  }

  // Confirm by looking ahead
  const panelStart = i;
  const closing = findClosingIndex(lines, panelStart);
  if (closing === -1) {
    output.push(lines[i]);
    continue;
  }

  const block = lines.slice(panelStart, closing + 1);

  // Strip the <SubPanelHeader ... /> block (multi-line self-closing)
  let body = [];
  let inHeader = false;
  let headerEnd = -1;
  for (let k = 0; k < block.length; k++) {
    const l = block[k];
    if (inHeader) {
      // The header is multi-line, ending with `/>` possibly on its own line
      if (/\/>\s*$/.test(l)) {
        inHeader = false;
        headerEnd = k;
        // skip this line too
        continue;
      }
      continue;
    }
    if (/^\s*<SubPanelHeader\b/.test(l)) {
      inHeader = true;
      // Check if it's all on one line ending in />
      if (/\/>\s*$/.test(l)) {
        inHeader = false;
        headerEnd = k;
        continue;
      }
      continue;
    }
    body.push(l);
  }

  // The body now starts with the original <section ...> opening (multi-line).
  // Strip that opening tag (everything up to and including the first `>` line).
  const bodyNoHeader = body;
  const openingLines = [];
  let bodyStartIdx = -1;
  for (let k = 0; k < bodyNoHeader.length; k++) {
    openingLines.push(bodyNoHeader[k]);
    if (/^\s*>/.test(bodyNoHeader[k])) {
      bodyStartIdx = k + 1;
      break;
    }
  }
  if (bodyStartIdx === -1) {
    output.push(lines[i]);
    continue;
  }
  let innerBody = bodyNoHeader.slice(bodyStartIdx);

  // Strip the trailing `</section>` from innerBody
  if (innerBody.length > 0 && /^\s*<\/section>\s*$/.test(innerBody[innerBody.length - 1])) {
    innerBody = innerBody.slice(0, -1);
  }

  // Strip leading <div className="flex-1 overflow-auto[ p-4]"> wrapper
  const innerDivPadded = /^\s*<div className="flex-1 overflow-auto p-4">\s*$/;
  const innerDiv = /^\s*<div className="flex-1 overflow-auto">\s*$/;
  let leadingStripped = false;
  if (innerBody.length > 0 && innerDivPadded.test(innerBody[0])) {
    innerBody = innerBody.slice(1);
    // Strip the matching trailing </div>
    if (innerBody.length > 0 && /^\s*<\/div>\s*$/.test(innerBody[innerBody.length - 1])) {
      innerBody = innerBody.slice(0, -1);
    }
    leadingStripped = true;
  } else if (innerBody.length > 0 && innerDiv.test(innerBody[0])) {
    innerBody = innerBody.slice(1);
    if (innerBody.length > 0 && /^\s*<\/div>\s*$/.test(innerBody[innerBody.length - 1])) {
      innerBody = innerBody.slice(0, -1);
    }
    leadingStripped = true;
  }

  // Build the SubPanelShell wrapper
  const mapping = PANELS[matched];
  const descriptionAttr = mapping.description
    ? `\n        description={${mapping.description}}`
    : "";
  const wrapper = [
    `<SubPanelShell`,
    `        panelKey="${matched}"`,
    `        activeKey={activePanel}`,
    `        onClose={() => setActivePanel("base")}`,
    `        headingId="${matched}-heading"`,
    `        title={${mapping.title}}${descriptionAttr}`,
    `        layout={isDesktop ? "drawer" : "sheet"}`,
    `      >`,
  ];
  // Determine indentation: the body needs to be indented +2 more spaces
  const bodyText = innerBody.join("\n");
  // Re-indent body lines by 2 spaces
  const reindented = bodyText
    .split("\n")
    .map((l) => (l.length === 0 ? "" : "  " + l))
    .join("\n");

  output.push(...wrapper);
  output.push(reindented);
  output.push(`      </SubPanelShell>`);

  skipUntilIdx = closing + 1;
  console.log(`OK   ${matched} (lines ${panelStart + 1}-${closing + 1})`);
}

fs.writeFileSync(FILE, output.join("\n"));
console.log("\nDONE");