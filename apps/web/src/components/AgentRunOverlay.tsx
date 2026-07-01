import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { color, radius } from '../brand/tokens';
import { Orb } from './Orb';
import { WorkingSteps } from './WorkingSteps';
import { agentPlan, agentRun } from '../generation/engine';
import { useAppStore } from '../store/useAppStore';
import type { AgentStep, BuildRequest } from '../types';

type Phase = 'planning' | 'confirm' | 'running' | 'error';

export function AgentRunOverlay({ req, name, onClose }: { req: BuildRequest; name: string; onClose: () => void }) {
  const navigate = useNavigate();
  const addArtifact = useAppStore((s) => s.addArtifact);
  const [phase, setPhase] = useState<Phase>('planning');
  const [plan, setPlan] = useState<{ steps: string[] }>({ steps: [] });
  const [steps, setSteps] = useState<AgentStep[]>([]);

  useEffect(() => {
    agentPlan(req).then((p) => { setPlan(p); setPhase('confirm'); }).catch(() => setPhase('error'));
  }, [req]);

  const run = async () => {
    setPhase('running');
    try {
      const artifact = await agentRun(req, name, plan, (s) => setSteps((prev) => [...prev, s]));
      addArtifact(artifact);
      navigate(`/studio/${artifact.id}`);
    } catch {
      setPhase('error');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,26,46,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 520, maxHeight: '80vh', overflow: 'auto', background: '#fff', borderRadius: radius.menu, padding: 24, boxShadow: '0 24px 64px rgba(26,26,46,0.24)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Orb size={26} spin={phase === 'running' ? 2 : 0} />
          <div style={{ fontSize: 15, fontWeight: 700 }}>{name}</div>
          <button type="button" onClick={onClose} style={{ marginLeft: 'auto', border: 'none', background: 'none', cursor: 'pointer', color: color.textMuted, fontSize: 18 }}>×</button>
        </div>

        {phase === 'planning' && <div style={{ fontSize: 13, color: color.textMuted }}>Planning the work…</div>}

        {phase === 'confirm' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {plan.steps.map((s, i) => <li key={i} style={{ fontSize: 13, color: color.textSlate }}>{s}</li>)}
            </ol>
            <button type="button" onClick={run} style={{ alignSelf: 'flex-start', cursor: 'pointer', border: 'none', background: color.indigo, color: '#fff', borderRadius: radius.buttonSm, padding: '9px 18px', fontSize: 13, fontWeight: 600 }}>Confirm &amp; run</button>
          </div>
        )}

        {phase === 'running' && <WorkingSteps steps={steps} />}

        {phase === 'error' && (
          <div style={{ fontSize: 13, color: '#d64545' }}>Something went wrong. <button type="button" onClick={onClose} style={{ border: 'none', background: 'none', color: color.indigo, cursor: 'pointer', fontWeight: 600 }}>Close</button></div>
        )}
      </div>
    </div>
  );
}
