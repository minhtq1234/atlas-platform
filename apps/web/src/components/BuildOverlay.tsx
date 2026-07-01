import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { color } from '../brand/tokens';
import { Orb } from './Orb';
import { useAppStore } from '../store/useAppStore';
import { generateArtifactStream } from '../generation/engine';
import type { BuildRequest } from '../types';

export function BuildOverlay() {
  const build = useAppStore((s) => s.build);
  const navigate = useNavigate();
  // Latch on the BuildRequest object identity (fresh per beginBuild). This
  // survives StrictMode's mount→unmount→remount, so the build runs exactly once.
  const startedFor = useRef<BuildRequest | null>(null);

  useEffect(() => {
    if (!build?.active) return;
    const store = useAppStore.getState();
    const req = store.pendingReq;
    if (!req || startedFor.current === req) return; // already handling this build
    startedFor.current = req;
    const name = store.build?.name ?? 'Artifact';

    // Ease the bar toward 90% while we await real stage events from the BFF.
    const timer = setInterval(() => {
      const s = useAppStore.getState();
      if (s.build) s.setBuildPct(Math.min(s.build.pct + 3, 90));
    }, 130);

    const run = async () => {
      let artifact = null;
      try {
        artifact = await generateArtifactStream(req, name, (label) =>
          useAppStore.getState().setBuildStage(label),
        );
      } catch (e) {
        console.error('[atlas] build failed:', e);
      } finally {
        clearInterval(timer);
      }
      const s = useAppStore.getState();
      if (!artifact) {
        s.endBuild();
        s.showToast("That build didn't complete — try again.");
        return;
      }
      s.setBuildPct(100);
      s.addArtifact(artifact);
      s.endBuild();
      if (artifact.degraded) {
        s.showToast('Model was unavailable — Atlas used a template for this build.');
      }
      navigate(`/studio/${artifact.id}`);
    };
    run();

    return () => clearInterval(timer); // do NOT reset startedFor (keeps the latch)
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
          <div style={{ height: '100%', borderRadius: 5, background: color.indigo, transition: 'width .18s linear', width: `${build.pct}%` }} />
        </div>
      </div>
    </div>
  );
}
