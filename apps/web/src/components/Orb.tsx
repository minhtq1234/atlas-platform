import { orbGradient } from '../brand/tokens';

export function Orb({ size = 42, spin = 14 }: { size?: number; spin?: number }) {
  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: orbGradient,
        animation: `orb ${spin}s linear infinite`,
        flex: 'none',
      }}
    />
  );
}

/** The stacked-bars Atlas logo mark. */
export function LogoMark({ scale = 1 }: { scale?: number }) {
  const u = (n: number) => n * scale;
  return (
    <div
      aria-hidden
      style={{ display: 'flex', flexDirection: 'column', gap: u(2) }}
    >
      <span style={{ width: u(10), height: u(4), borderRadius: 2, background: '#F0997B', marginLeft: u(6) }} />
      <span style={{ width: u(16), height: u(4), borderRadius: 2, background: '#2D3A8C', marginLeft: u(3) }} />
      <span style={{ width: u(22), height: u(4), borderRadius: 2, background: '#1A1A2E' }} />
    </div>
  );
}

/** Small light-on-dark variant of the mark, for use inside dark buttons. */
export function LogoMarkLight() {
  return (
    <span aria-hidden style={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <span style={{ width: 6, height: 2, borderRadius: 1, background: '#F0997B', marginLeft: 4 }} />
      <span style={{ width: 9, height: 2, borderRadius: 1, background: '#7D86D4', marginLeft: 2 }} />
      <span style={{ width: 12, height: 2, borderRadius: 1, background: '#fff' }} />
    </span>
  );
}
