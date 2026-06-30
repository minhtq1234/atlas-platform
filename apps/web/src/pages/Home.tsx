// M0 placeholder — replaced in M1.
import { color } from '../brand/tokens';

export function Home() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color.ink,
      }}
    >
      <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
        Atlas
      </span>
    </div>
  );
}
