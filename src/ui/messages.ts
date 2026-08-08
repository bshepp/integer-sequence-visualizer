let assertive: HTMLElement | null = null;
let polite: HTMLElement | null = null;

function makeRegion(container: HTMLElement, assertiveRegion: boolean): HTMLElement {
  const el = document.createElement('div');
  el.className = 'message-region';
  if (assertiveRegion) {
    // role="alert" implies aria-live="assertive" + aria-atomic="true".
    // Errors interrupt deliberately: the user's action just failed.
    el.setAttribute('role', 'alert');
  } else {
    el.setAttribute('aria-live', 'polite');
  }
  container.appendChild(el);
  return el;
}

/**
 * Both regions are created here, empty, rather than when the first message
 * arrives. A live region has to exist in the DOM *before* its contents change
 * - assistive technology subscribes to the node, so one inserted already
 * populated is frequently not announced at all. Previously every banner was
 * a plain div appended on demand, which meant the entire error-reporting
 * system was invisible to assistive technology.
 */
export function initMessages(el: HTMLElement): void {
  el.replaceChildren();
  assertive = makeRegion(el, true);
  polite = makeRegion(el, false);
}

function banner(region: HTMLElement | null, msg: string, cls: string, ms: number): void {
  if (!region) return;
  const div = document.createElement('div');
  div.className = `banner ${cls}`;
  div.textContent = msg;
  region.appendChild(div);
  setTimeout(() => div.remove(), ms);
}

export function showError(msg: string): void { banner(assertive, msg, 'banner-error', 6000); }
export function showNotice(msg: string): void { banner(polite, msg, 'banner-notice', 4000); }
