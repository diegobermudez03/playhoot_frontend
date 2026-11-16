#!/usr/bin/env node
// Checks the design-system rule that no component or screen writes a raw colour,
// duration or shadow: those values live in the token files and nowhere else
// (AGENTS.md "Styles", D-021, docs/design/DESIGN_SYSTEM.md).
//
// ESLint does not read CSS, so this is the only thing enforcing it. It runs as
// part of `npm run check`.
//
//   node scripts/check-styles.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const searched = ['apps/web/src', 'packages'];

// The token files are where the raw values are allowed to be written.
const tokenFiles = [
  'apps/web/src/ui/tokens.css',
  'apps/web/src/ui/tokens/primitives.css',
  'apps/web/src/ui/tokens/semantic.css',
];

// Exceptions, each with the reason it is one.
const allowed = new Map([
  [
    'apps/web/src/features/sign-in/GoogleButton.module.css',
    "Google's sign-in branding guidelines fix the button's colours; they are not ours to tokenise.",
  ],
]);

const rules = [
  { name: 'raw colour', pattern: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(/g },
  // `0s` is the absence of a duration, not a chosen one (an animation-delay fallback).
  { name: 'raw duration', pattern: /(?<![\w-])(?!0m?s)\d+(\.\d+)?m?s(?![\w-])/g },
];

// A blur-radius shadow: this identity only has hard offsets, which come from tokens.
const shadowPattern = /box-shadow\s*:\s*[^;]*;/g;

function cssFiles(directory) {
  const out = [];
  for (const entry of readdirSync(directory)) {
    if (entry === 'node_modules' || entry === 'dist' || entry === 'build') continue;
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) out.push(...cssFiles(full));
    else if (entry.endsWith('.css')) out.push(full);
  }
  return out;
}

const problems = [];
for (const directory of searched) {
  for (const file of cssFiles(join(root, directory))) {
    const rel = relative(root, file).split(sep).join('/');
    if (tokenFiles.includes(rel) || allowed.has(rel)) continue;
    const source = readFileSync(file, 'utf8');
    source.split('\n').forEach((line, index) => {
      // A comment is prose, not a declaration.
      const code = line.replace(/\/\*.*?\*\//g, '');
      if (code.trimStart().startsWith('*')) return;
      for (const rule of rules) {
        rule.pattern.lastIndex = 0;
        const found = code.match(rule.pattern);
        if (found) problems.push(`${rel}:${index + 1}: ${rule.name} ${found.join(', ')}`);
      }
    });
    shadowPattern.lastIndex = 0;
    for (const shadow of source.match(shadowPattern) ?? []) {
      // Hard offsets are written as lengths; a third length is a blur radius.
      const lengths = shadow.match(/(?<![\w-])-?\d+(\.\d+)?px/g) ?? [];
      if (lengths.length > 2) {
        problems.push(`${rel}: shadow with a blur radius: ${shadow.replace(/\s+/g, ' ')}`);
      }
    }
  }
}

for (const problem of problems) console.error(problem);
if (problems.length > 0) {
  console.error(
    `\n${problems.length} style rule violation(s). Colours, durations and shadows come from the ` +
      `tokens (src/ui/tokens/); see docs/design/DESIGN_SYSTEM.md. A genuine exception goes in ` +
      `the allow list at the top of this script, with its reason.`,
  );
  process.exit(1);
}
console.log('Styles: no raw colours, durations or blurred shadows outside the token files.');
