import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { color } from '../brand/tokens';
import { Orb } from './Orb';
import { useAppStore } from '../store/useAppStore';
import { generateArtifact } from '../generation/engine';

export function BuildOverlay() {
  const build = useAppStore((s) => s.build);
  const navigate = useNavigate();
  const running = useRef(false);

  useEffect(() => {
    if (!build?.active || running.current) return;
    running.current = true;

    const timer = setInterval(() => {
      const s = useAppStore.getState();
      const cur = s.build?.pct ?? 0;
      const next = Math.min(cur + 4, 100);
      s.setBuildPct(next);
      if (next >= 100) {
        clearInterval(timer);
        const req = s.pendingReq;
        const name = s.build?.name ?? 'Artifact';
        if (req) {
          generateArtifact(req, name).then((art) => {
            s.addArtifact(art);
            s.endBuild();
            running.current = false;
            navigate(`/studio/${art.id}`);
          });
        } else {
          s.endBuild();
          running.current = false;
        }
      }
    }, 90);

    return () => {
      clearInterval(timer);
      running.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [build?.active]);

  if (!build?.active) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(244,242,236,0.92)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, width: 340, maxWidth: '90%', textAlign: 'center' }}>
        <Orb size={52} spin={3} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Building {build.name}</div>
          <div style={{ fontSize: 13, color: color.textMuted }}>{build.stage}</div>
        </div>
        <div style={{ width: '100%', height: 7, borderRadius: 5, background: color.trackBg, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 5, background: color.indigo, transition: 'width .12s linear', width: `${build.pct}%` }} />
        </div>
      </div>
    </div>
  );
}
