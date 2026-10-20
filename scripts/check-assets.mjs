#!/usr/bin/env node
// Lists every registered asset (apps/web/src/assets/assets.json) and whether its file exists,
// and checks each one is documented in docs/design/ASSETS.md.
//
//   npm run assets            report
//   npm run assets -- --strict   exit 1 if any asset is missing (for release checks)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const registry = JSON.parse(readFileSync(join(root, 'apps/web/src/assets/assets.json'), 'utf8'));
const doc = readFileSync(join(root, 'docs/design/ASSETS.md'), 'utf8');
const strict = process.argv.includes('--strict');

let missing = 0;
let undocumented = 0;
for (const asset of registry.assets) {
  const present = existsSync(join(root, 'apps/web/public', asset.path));
  const documented = doc.includes(`\`${asset.id}\``);
  if (!present) missing += 1;
  if (!documented) undocumented += 1;
  const status = present ? 'ok     ' : 'MISSING';
  console.log(
    `${status}  ${asset.id.padEnd(24)} ${asset.path}${documented ? '' : '   (not in ASSETS.md!)'}`,
  );
}

console.log(
  `\n${registry.assets.length} assets, ${missing} missing, ${undocumented} undocumented.`,
);
if (undocumented > 0) process.exit(1);
if (strict && missing > 0) process.exit(1);
