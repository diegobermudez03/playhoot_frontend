import registry from './assets.json';

// The asset registry: one place that names every file asset (docs/design/ASSETS.md).
export type AssetId = (typeof registry.assets)[number]['id'];

const paths = new Map(registry.assets.map((asset) => [asset.id, asset.path]));

export function assetPath(id: AssetId): string {
  const path = paths.get(id);
  if (!path) throw new Error(`Unknown asset ${id}`);
  return path;
}
