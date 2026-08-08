export const VISUALLY_HIDDEN = 'visually-hidden';

let seq = 0;

/**
 * Wraps a control in a real <label>, associated by id.
 *
 * The sidebar's inputs previously carried only a `placeholder`, which is not
 * an accessible name: it vanishes as soon as the user types, and several
 * screen readers ignore it for naming entirely. The label text is visually
 * hidden by default so the compact sidebar layout is unchanged.
 */
export function labelledControl(
  labelText: string,
  control: HTMLElement,
  opts: { visible?: boolean } = {},
): HTMLLabelElement {
  const label = document.createElement('label');
  label.className = 'a11y-field';
  if (!control.id) control.id = `f${++seq}`;
  label.htmlFor = control.id;

  const text = document.createElement('span');
  text.textContent = labelText;
  if (!opts.visible) text.className = VISUALLY_HIDDEN;

  label.append(text, control);
  return label;
}
