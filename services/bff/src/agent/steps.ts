import type { Step } from './types';

/** Raw event shape we accept from the OpenCode session translator. Loose on purpose. */
export interface RawToolEvent {
  type: string;
  name?: string;
  state?: 'start' | 'completed' | 'error' | string;
  args?: Record<string, unknown>;
  output?: string;
  text?: string;
}

const base = (p?: string) => (p ? p.split('/').pop() || p : '');

/**
 * Map a recognized tool (+ args) to a business-friendly label for the chip feed.
 * Returns null for internal/unknown tools (task, invalid, glob, grep, …) so they
 * are dropped from the working-steps UI instead of leaking raw names.
 */
export function friendlyToolName(name: string, args: Record<string, unknown> = {}): string | null {
  const cmd = String(args.command ?? '');
  const path = String(args.path ?? args.file ?? '');
  if (name === 'update_task_list') return 'Updating task list';
  if (name === 'emit_artifact') return 'Finalizing artifact';
  if (name === 'bash' && (/\bpython3?\b/.test(cmd) || /\.py\b/.test(cmd) || /\.py$/.test(path))) return 'Running Python';
  if (name === 'bash') return 'Running terminal command';
  if (name === 'read') return `Reading ${base(path)}`.trim();
  if (name === 'edit' || name === 'write') return `Editing ${base(path)}`.trim();
  return null;
}

/** Translate a raw session event into a display Step, or null to ignore it. */
export function toStep(ev: RawToolEvent): Step | null {
  if (ev.type !== 'tool' || !ev.name) return null;
  const name = friendlyToolName(ev.name, ev.args ?? {});
  if (!name) return null; // internal/unknown tools produce no chip
  const status = ev.state === 'error' ? 'err' : ev.state === 'completed' ? 'ok' : 'start';
  const step: Step = { kind: 'tool', name, status };
  if (status !== 'start' && ev.output) step.detail = ev.output.slice(0, 2000);
  return step;
}
