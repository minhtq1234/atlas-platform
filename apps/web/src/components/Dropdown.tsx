import type { CSSProperties, ReactNode } from 'react';
import { color, radius, shadow } from '../brand/tokens';

interface DropdownProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  buttonContent: ReactNode;
  buttonStyle: CSSProperties;
  buttonAriaLabel: string;
  menuWidth?: number;
  align?: 'left' | 'right';
  children: ReactNode;
}

/** A button that opens an anchored menu. A transparent backdrop closes it on outside click. */
export function Dropdown({
  open,
  onToggle,
  onClose,
  buttonContent,
  buttonStyle,
  buttonAriaLabel,
  menuWidth = 200,
  align = 'left',
  children,
}: DropdownProps) {
  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={buttonAriaLabel}
        onClick={onToggle}
        style={{ cursor: 'pointer', ...buttonStyle }}
      >
        {buttonContent}
      </button>
      {open && (
        <>
          <div
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 18 }}
            aria-hidden
          />
          <div
            role="menu"
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              [align]: 0,
              zIndex: 20,
              background: color.white,
              border: `1px solid ${color.border}`,
              borderRadius: radius.menu,
              boxShadow: shadow.menu,
              padding: 6,
              minWidth: menuWidth,
              animation: 'risein .14s ease',
            }}
          >
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export function menuRowStyle(active: boolean): CSSProperties {
  return {
    cursor: 'pointer',
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    textAlign: 'left',
    border: 'none',
    borderRadius: 8,
    padding: '9px 11px',
    fontSize: 13,
    fontWeight: 600,
    background: active ? color.indigo100 : 'none',
    color: active ? color.indigo : color.ink,
  };
}
