import { describe, it, expect } from 'vitest';
import { isValidElement } from 'react';
import { renderInline, plainLength } from './inline';

describe('renderInline', () => {
  it('renders **bold** as a <strong> and leaves surrounding text plain', () => {
    const nodes = renderInline('Total is **1,247** today') as unknown[];
    const strong = nodes.find((n) => isValidElement(n) && n.type === 'strong') as
      | { props: { children: string } }
      | undefined;
    expect(strong).toBeTruthy();
    expect(strong!.props.children).toBe('1,247');
  });

  it('never leaks literal ** into the rendered text', () => {
    const nodes = renderInline('a **b** c **d**') as { props: { children: string } }[];
    const text = nodes.map((n) => (isValidElement(n) ? n.props.children : String(n))).join('');
    expect(text).not.toMatch(/\*\*/);
    expect(text).toBe('a b c d');
  });

  it('leaves plain text untouched (single node, no emphasis)', () => {
    const nodes = renderInline('no emphasis here') as { props: { children: string } }[];
    expect(nodes.map((n) => n.props.children).join('')).toBe('no emphasis here');
  });

  it('plainLength ignores the ** markers', () => {
    expect(plainLength('**+7.7%**')).toBe(5); // "+7.7%"
    expect(plainLength('plain')).toBe(5);
  });
});
