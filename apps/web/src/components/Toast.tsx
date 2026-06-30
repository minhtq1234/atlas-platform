import { color, shadow } from '../brand/tokens';
import { useAppStore } from '../store/useAppStore';

export function Toast() {
  const toast = useAppStore((s) => s.toast);
  if (!toast) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: 26,
        left: '50%',
        transform: 'translateX(-50%)',
        background: color.ink,
        color: '#fff',
        padding: '12px 20px',
        borderRadius: 11,
        fontSize: 13,
        fontWeight: 500,
        zIndex: 60,
        boxShadow: shadow.modal,
        animation: 'risein .2s ease',
        maxWidth: 460,
        textAlign: 'center',
      }}
    >
      {toast}
    </div>
  );
}
