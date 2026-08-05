import { registerVisualizer } from './registry';
import { scatterViz } from './scatter';
import { differencesViz } from './differences';
import { histogramViz } from './histogram';
import { autocorrViz } from './autocorrelation';
import { ulamViz } from './ulamSpiral';
import { modGridViz } from './modGrid';
import { turtleViz } from './turtle';
import { digitWalkViz } from './digitWalk';

let registered = false;

export function registerAll(): void {
  if (registered) return;
  registered = true;
  // Later tasks append their visualizers to this list.
  for (const v of [scatterViz, differencesViz, histogramViz, autocorrViz, ulamViz, modGridViz, turtleViz, digitWalkViz]) registerVisualizer(v);
}
