export function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[] } {
  const calls: string[] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return { addColorStop: () => {} };
        }
        if (prop === 'measureText') return { width: 10 };
        return undefined;
      };
    },
    set() { return true; },
  });
  return { ctx, calls };
}
