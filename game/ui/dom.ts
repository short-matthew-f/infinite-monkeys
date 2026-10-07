// Tiny DOM helpers. Screens build their DOM once in mount() and update text/attributes in render().

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** h('button', { class: 'primary', onclick: fn }, 'Hire') */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: (Node | string)[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  el.append(...children);
  return el;
}

/** Set text only when it changed (avoids layout churn at 10 Hz). */
export function text(el: HTMLElement, value: string): void {
  if (el.textContent !== value) el.textContent = value;
}

/** Toggle a button's disabled state only when it changed. */
export function enable(el: HTMLButtonElement | HTMLInputElement, on: boolean): void {
  if (el.disabled === on) el.disabled = !on;
}

/** Set a 0..1 fill on a bar element via the --fill custom property. */
export function fill(el: HTMLElement, frac: number): void {
  const v = `${Math.max(0, Math.min(1, frac)) * 100}%`;
  if (el.style.getPropertyValue('--fill') !== v) el.style.setProperty('--fill', v);
}
