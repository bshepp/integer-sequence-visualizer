export interface CtxCall { name: string; args: unknown[]; }

export function fakeCtx(): { ctx: CanvasRenderingContext2D; calls: string[]; callLog: CtxCall[] } {
  const calls: string[] = [];
  const callLog: CtxCall[] = [];
  const ctx = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, prop) {
      if (typeof prop === 'symbol') return undefined;
      return (...args: unknown[]) => {
        calls.push(String(prop));
        callLog.push({ name: String(prop), args });
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
          return { addColorStop: () => {} };
        }
        if (prop === 'measureText') return { width: 10 };
        return undefined;
      };
    },
    set() { return true; },
  });
  return { ctx, calls, callLog };
}
