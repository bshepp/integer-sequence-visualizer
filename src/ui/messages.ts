let container: HTMLElement | null = null;

export function initMessages(el: HTMLElement): void {
  container = el;
}

function banner(msg: string, cls: string, ms: number): void {
  if (!container) return;
  const div = document.createElement('div');
  div.className = `banner ${cls}`;
  div.textContent = msg;
  container.appendChild(div);
  setTimeout(() => div.remove(), ms);
}

export function showError(msg: string): void { banner(msg, 'banner-error', 6000); }
export function showNotice(msg: string): void { banner(msg, 'banner-notice', 4000); }
