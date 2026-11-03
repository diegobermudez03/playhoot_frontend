// The field vectors the SDK's validateValues runs (packages/game-core) are a copy of the backend's
// (../playhoot/play/internal/business/inputs/testdata/vectors.json); both must stay identical so
// a payload the client accepts is one the backend accepts. Checked when both checkouts sit side by
// side; the backend checks the same from its side.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { expect, it } from 'vitest';

const frontendCopy = fileURLToPath(
  new URL('../../game-core/src/testdata/field-vectors.json', import.meta.url),
);
const backendCopy = fileURLToPath(
  new URL(
    '../../../../playhoot/play/internal/business/inputs/testdata/vectors.json',
    import.meta.url,
  ),
);

it.skipIf(!existsSync(backendCopy))('keeps the field vectors identical to the backend copy', () => {
  const normalize = (file: string) => readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  expect(normalize(frontendCopy)).toBe(normalize(backendCopy));
});
