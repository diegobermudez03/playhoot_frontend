import type { DeviceCapabilities } from '@playhoot/device';
import { viewportOrientation, type GameViewport } from '@playhoot/game-host';

// Whether to suggest turning the device (plan §8): only on a touch device that is not a wide
// screen, held the other way from the game. The game is shown whole either way; turning only
// makes it bigger. A square game fits both ways.
export function suggestsRotation(
  device: Pick<DeviceCapabilities, 'touch' | 'displayClass' | 'orientation'>,
  viewport: GameViewport,
): boolean {
  if (!device.touch || device.displayClass === 'wide') return false;
  const game = viewportOrientation(viewport);
  return game !== 'square' && game !== device.orientation;
}
