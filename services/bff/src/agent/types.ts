import type { ArtifactContent } from '../types';

/** A checklist item shown in the working-steps panel. */
export interface Task {
  id: string;
  title: string;
  status: 'pending' | 'active' | 'done';
}

/** One streamed unit of agent progress. `task` carries the whole list snapshot. */
export type Step =
  | { kind: 'tool' | 'text'; name: string; status: 'start' | 'ok' | 'err'; detail?: string }
  | { kind: 'task'; tasks: Task[] };

export interface SeedFile { name: string; bytes: Buffer; }

export interface SandboxHandle {
  /** OpenCode server URL for this session's sandbox. */
  opencodeUrl: string;
  /** Absolute workdir seeded with inputs. */
  workdir: string;
  destroy(): Promise<void>;
}

export interface Sandbox {
  provision(sessionId: string, files: SeedFile[]): Promise<SandboxHandle>;
}

/** Tool handlers the session invokes when the model calls our custom tools. */
export interface AgentTools {
  emitArtifact(content: unknown): { ok: true } | { ok: false; errors: string };
  updateTaskList(tasks: Task[]): { ok: true };
}

/** Abstracts the OpenCode run so runAgent is testable with a scripted mock. */
export interface AgentSession {
  run(opts: {
    prompt: string;
    tools: AgentTools;
    onEvent: (s: Step) => void;
    signal: AbortSignal;
  }): Promise<void>;
}

/** runAgent output — same shape as generate.ts `Produced` (minus sessionId). */
export interface AgentProduced {
  content: ArtifactContent;
  viaModel: boolean;
  degradedReason?: string;
}
