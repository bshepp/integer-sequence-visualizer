import { registerVisualizer } from './registry';
import { scatterViz } from './scatter';
import { differencesViz } from './differences';
import { histogramViz } from './histogram';
import { autocorrViz } from './autocorrelation';
import { ulamViz } from './ulamSpiral';
import { modGridViz } from './modGrid';
import { turtleViz } from './turtle';
import { digitWalkViz } from './digitWalk';
import { polyarcViz } from './polyarc';

let registered = false;

export function registerAll(): void {
  if (registered) return;
  registered = true;
  for (const v of [
    scatterViz, differencesViz,
    histogramViz, autocorrViz,
    ulamViz, modGridViz,
    turtleViz, digitWalkViz, polyarcViz,
  ]) registerVisualizer(v);
}
