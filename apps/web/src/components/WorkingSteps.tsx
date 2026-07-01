import { useState } from 'react';
import { color, radius } from '../brand/tokens';
import type { AgentStep, AgentTask } from '../types';

/** Split streamed steps into the latest task list + the chip feed. */
export function partitionSteps(steps: AgentStep[]): { tasks: AgentTask[]; chips: Extract<AgentStep, { kind: 'tool' | 'text' }>[] } {
  let tasks: AgentTask[] = [];
  const chips: Extract<AgentStep, { kind: 'tool' | 'text' }>[] = [];
  for (const s of steps) {
    if (s.kind === 'task') tasks = s.tasks;
    else chips.push(s);
  }
  return { tasks, chips };
}

const dot = (status: string) =>
  status === 'done' || status === 'ok' ? color.positive : status === 'err' ? '#d64545' : color.indigo;

export function WorkingSteps({ steps }: { steps: AgentStep[] }) {
  const { tasks, chips } = partitionSteps(steps);
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {tasks.length > 0 && (
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((t) => (
            <li key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, color: t.status === 'done' ? color.textMuted : color.ink }}>
              <span style={{ width: 8, height: 8, borderRadius: 4, background: dot(t.status), flex: 'none' }} />
              <span style={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</span>
            </li>
          ))}
        </ol>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {chips.map((c, i) => (
          <div key={i}>
            <button
              type="button"
              onClick={() => c.detail && setOpen(open === i ? null : i)}
              style={{ cursor: c.detail ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${color.border}`, background: '#fff', borderRadius: radius.pill, padding: '5px 11px', fontSize: 12, color: color.textSlate, width: 'fit-content' }}
            >
              <span style={{ width: 7, height: 7, borderRadius: 4, background: dot(c.status), flex: 'none' }} />
              {c.name}
            </button>
            {open === i && c.detail && (
              <pre style={{ margin: '4px 0 0', fontSize: 11, background: color.surfaceAlt, borderRadius: 8, padding: 8, maxHeight: 160, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{c.detail}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
