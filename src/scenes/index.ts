import type { SceneDef } from '../gfx/Renderer';
import fractal from './fractal.frag?raw';
import kaleido from './kaleido.frag?raw';
import monolith from './monolith.frag?raw';

/** Order = keys 1, 2, 3. Add a scene by dropping a .frag next to these and listing it here. */
export const SCENES: SceneDef[] = [
  { name: 'MONOLITH', fragment: monolith, feedback: 0.55, resolution: 1 },
  { name: 'KALEIDO', fragment: kaleido, feedback: 0.35, resolution: 1 },
  // The fractal is by far the most expensive; grain and trails hide the lower resolution.
  { name: 'FRACTAL', fragment: fractal, feedback: 0.25, resolution: 0.75 },
];
