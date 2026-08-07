export interface ExplainPanel {
  el: HTMLElement;
  show(title: string, body: string): void;
  hide(): void;
  isOpen(): boolean;
}

export function buildExplainPanel(): ExplainPanel {
  const el = document.createElement('div');
  el.className = 'explain-panel';
  el.hidden = true;
  // Announced when it opens, and reachable by keyboard. Not modal: it sits
  // beside the canvas and the user may well want to keep interacting with the
  // view while reading it.
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');

  const heading = document.createElement('h2');
  heading.className = 'explain-title';
  const body = document.createElement('p');
  body.className = 'explain-body';

  const close = document.createElement('button');
  close.className = 'explain-close';
  close.type = 'button';
  close.setAttribute('aria-label', 'Close explanation');
  close.textContent = '×';
  close.addEventListener('click', () => hide());

  el.append(close, heading, body);
  el.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });

  function hide(): void { el.hidden = true; }

  return {
    el,
    show(title, text) {
      heading.textContent = title;
      body.textContent = text;
      el.hidden = false;
      close.focus();
    },
    hide,
    isOpen: () => !el.hidden,
  };
}
