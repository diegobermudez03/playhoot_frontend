// The vectors the SDK runs (packages/game-core) are copies of the backend's: the field vectors of
// validateValues (../playhoot/play/internal/business/inputs/testdata/vectors.json) and the
// declaration vectors of validateManifest
// (../playhoot/play/session/internal/business/manifest/testdata/declaration-vectors.json). Each
// pair must stay identical so what the SDK accepts is what the backend accepts. Checked when both
// checkouts sit side by side; the backend checks the same from its side.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const copies = [
  {
    name: 'field vectors',
    frontend: '../../game-core/src/testdata/field-vectors.json',
    backend: '../../../../playhoot/play/internal/business/inputs/testdata/vectors.json',
  },
  {
    name: 'declaration vectors',
    frontend: '../../game-core/src/testdata/declaration-vectors.json',
    backend:
      '../../../../playhoot/play/session/internal/business/manifest/testdata/declaration-vectors.json',
  },
].map((copy) => ({
  name: copy.name,
  frontend: fileURLToPath(new URL(copy.frontend, import.meta.url)),
  backend: fileURLToPath(new URL(copy.backend, import.meta.url)),
}));

for (const copy of copies) {
  it.skipIf(!existsSync(copy.backend))(
    `keeps the ${copy.name} identical to the backend copy`,
    () => {
      const normalize = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
      expect(normalize(copy.frontend)).toBe(normalize(copy.backend));
    },
  );
}
