import { describe, it, expect, beforeEach } from 'vitest';
import { registerVisualizer, getVisualizer, allVisualizers, clearRegistry } from '../../src/viz/registry';
import { defaultParams, type Visualizer } from '../../src/viz/types';
import { fakeCtx } from '../helpers/fakeCtx';

const mkViz = (id: string): Visualizer => ({
  id, name: id, family: 'basic', params: [], minTerms: 1,
  explain: { short: `${id} test stub`, long: `${id} test stub` },
  render: (_seq, _params, ctx) => { ctx.beginPath(); },
});

describe('registry', () => {
  beforeEach(clearRegistry);

  it('registers and retrieves in order', () => {
    registerVisualizer(mkViz('a'));
    registerVisualizer(mkViz('b'));
    expect(allVisualizers().map((v) => v.id)).toEqual(['a', 'b']);
    expect(getVisualizer('b').name).toBe('b');
  });

  it('throws on duplicates and unknowns', () => {
    registerVisualizer(mkViz('a'));
    expect(() => registerVisualizer(mkViz('a'))).toThrow(/duplicate/i);
    expect(() => getVisualizer('nope')).toThrow(/nope/);
  });
});

describe('defaultParams', () => {
  it('collects defaults by id', () => {
    expect(defaultParams([
      { kind: 'number', id: 'k', label: 'K', default: 4, min: 2, max: 12, step: 1 },
      { kind: 'select', id: 'mode', label: 'Mode', default: 'terms', options: ['terms', 'gaps'] },
      { kind: 'boolean', id: 'log', label: 'Log', default: false },
    ])).toEqual({ k: 4, mode: 'terms', log: false });
  });
});

describe('fakeCtx', () => {
  it('no-ops methods and records calls', () => {
    const { ctx, calls } = fakeCtx();
    ctx.beginPath();
    ctx.lineTo(1, 2);
    ctx.fillStyle = 'red'; // property set must not throw
    expect(calls).toEqual(['beginPath', 'lineTo']);
  });
});
