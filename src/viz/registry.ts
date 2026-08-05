import type { Visualizer } from './types';

const registry = new Map<string, Visualizer>();

export function registerVisualizer(v: Visualizer): void {
  if (registry.has(v.id)) throw new Error(`Duplicate visualizer id: ${v.id}`);
  registry.set(v.id, v);
}

export function getVisualizer(id: string): Visualizer {
  const v = registry.get(id);
  if (!v) throw new Error(`Unknown visualizer: ${id}`);
  return v;
}

export function allVisualizers(): Visualizer[] {
  return [...registry.values()];
}

export function clearRegistry(): void {
  registry.clear();
}
