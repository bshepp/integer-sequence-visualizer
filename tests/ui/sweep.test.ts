// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { sweepValues, buildSweepView } from '../../src/ui/sweep';
import { turtleViz } from '../../src/viz/turtle';
import { defaultParams } from '../../src/viz/types';

describe('sweepValues', () => {
  it('spans min..max snapped to step, deduped', () => {
    expect(sweepValues({ min: 2, max: 12, step: 1 }, 6)).toEqual([2, 4, 6, 8, 10, 12]);
    expect(sweepValues({ min: 1, max: 3, step: 1 }, 12)).toEqual([1, 2, 3]);
  });
});

describe('buildSweepView', () => {
  const seq = { terms: [1n, 2n, 3n, 4n, 5n, 6n], name: 't', offset: 0, source: 'paste' as const };

  it('renders a cell per value and picks on click', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const el = buildSweepView({
      seq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
      paramId: 'angle', count: 6, onPick, onClose,
    });
    const cells = el.querySelectorAll('.sweep-cell');
    expect(cells.length).toBeGreaterThanOrEqual(2);
    (cells[0] as HTMLElement).click();
    expect(onPick).toHaveBeenCalledWith(1); // angle spec min is 1
    expect(onClose).toHaveBeenCalled();
  });

  it('close button closes without picking', () => {
    const onPick = vi.fn();
    const onClose = vi.fn();
    const el = buildSweepView({
      seq, viz: turtleViz, baseParams: defaultParams(turtleViz.params),
      paramId: 'angle', count: 4, onPick, onClose,
    });
    el.querySelector<HTMLButtonElement>('.sweep-close')!.click();
    expect(onClose).toHaveBeenCalled();
    expect(onPick).not.toHaveBeenCalled();
  });
});
