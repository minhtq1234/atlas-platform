import { Component, type ReactNode } from 'react';
import { color } from '../brand/tokens';

interface State { error: Error | null; }

/** Catches render errors (e.g. a malformed model artifact) so the app shows a
 *  message instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('[atlas] render error:', error);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Something went wrong rendering this view.</div>
          <div style={{ fontSize: 13, color: color.textMuted, maxWidth: 420 }}>
            The artifact may be malformed. Try rebuilding it, or head back to Atlas.
          </div>
          <a href="/" style={{ cursor: 'pointer', border: 'none', background: color.ink, color: '#fff', padding: '11px 22px', borderRadius: 10, fontSize: 13.5, fontWeight: 600, textDecoration: 'none' }}>
            Back to Atlas
          </a>
        </div>
      );
    }
    return this.props.children;
  }
}
