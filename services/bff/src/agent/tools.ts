import type { ZodError } from 'zod';
import { ArtifactContent, type ArtifactType } from '../types';
import type { AgentTools, Step, Task } from './types';

/** Mutable per-run state the tool handlers write into. */
export interface RunState {
  content?: import('../types').ArtifactContent;
  tasks: Task[];
  emitTries: number;
}

export function formatIssues(err: ZodError): string {
  return err.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
}

/** Build the tool handlers bound to a run's state + step sink. */
export function makeTools(run: RunState, type: ArtifactType, onStep: (s: Step) => void): AgentTools {
  return {
    emitArtifact(content) {
      run.emitTries++;
      const obj = (content && typeof content === 'object' ? { ...(content as object) } : {}) as Record<string, unknown>;
      obj.kind = type; // trust the requested type over the model's self-report
      const parsed = ArtifactContent.safeParse(obj);
      if (!parsed.success) return { ok: false, errors: formatIssues(parsed.error) };
      run.content = parsed.data;
      return { ok: true };
    },
    updateTaskList(tasks) {
      run.tasks = tasks;
      onStep({ kind: 'task', tasks });
      return { ok: true };
    },
  };
}
