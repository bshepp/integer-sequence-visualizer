import { registerVisualizer } from './registry';
import { scatterViz } from './scatter';
import { differencesViz } from './differences';

let registered = false;

export function registerAll(): void {
  if (registered) return;
  registered = true;
  // Later tasks append their visualizers to this list.
  for (const v of [scatterViz, differencesViz]) registerVisualizer(v);
}
