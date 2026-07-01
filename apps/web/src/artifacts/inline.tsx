import { Fragment, type ReactNode } from 'react';
import { color } from '../brand/tokens';

/**
 * Render the subset of inline Markdown that models naturally emit for emphasis:
 * `**bold**` becomes a bold, brand-orange span; everything else stays plain text.
 * Keeps artifact text robust when the agent formats numbers with asterisks
 * (otherwise the raw `**` leak into the rendered document).
 */
export function renderInline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    const m = /^\*\*([^*]+)\*\*$/.exec(part);
    return m ? (
      <strong key={i} style={{ fontWeight: 700, color: color.coral }}>{m[1]}</strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    );
  });
}

/** Plain-text length of a string ignoring inline-Markdown markers. */
export function plainLength(text: string): number {
  return text.replace(/\*\*/g, '').length;
}
