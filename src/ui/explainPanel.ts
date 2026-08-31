export interface ExplainPanel {
  el: HTMLElement;
  /** Opens the panel and takes focus. For a deliberate press of an (i). */
  show(title: string, body: string): void;
  /**
   * Replaces the text of an already-open panel without touching focus.
   *
   * Separate from show() precisely because of the focus. This is called when
   * the state the panel describes changes underneath it, which happens while
   * the reader is operating some other control - a dropdown, the picker - and
   * yanking focus onto a close button mid-interaction would be worse than the
   * stale text it is fixing.
   */
  update(title: string, body: string): void;
  hide(): void;
  isOpen(): boolean;
}

/**
 * @param onHide Called whenever the panel closes by any route, including its
 *   own close button and Escape. The buttons that open it track their own
 *   aria-expanded, and without this they would keep claiming "expanded" after
 *   a close they did not initiate.
 */
export function buildExplainPanel(onHide?: () => void): ExplainPanel {
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

  function hide(): void {
    const wasOpen = !el.hidden;
    el.hidden = true;
    if (wasOpen) onHide?.();
  }

  return {
    el,
    show(title, text) {
      heading.textContent = title;
      body.textContent = text;
      el.hidden = false;
      close.focus();
    },
    update(title, text) {
      if (el.hidden) return;
      heading.textContent = title;
      body.textContent = text;
    },
    hide,
    isOpen: () => !el.hidden,
  };
}
