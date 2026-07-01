import { mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { Sandbox, SandboxHandle, SeedFile } from './types';

/** Filename → safe basename (no path traversal, no separators). */
function safeName(name: string): string {
  return name.replace(/[\\/]+/g, '-').replace(/\.\./g, '').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').replace(/-+/g, '-').slice(0, 120) || 'file';
}

async function seed(workdir: string, files: SeedFile[]): Promise<void> {
  const inputs = join(workdir, 'inputs');
  await mkdir(inputs, { recursive: true });
  for (const f of files) await writeFile(join(inputs, safeName(f.name)), f.bytes);
}

/** In-memory sandbox for tests: no filesystem, records destroys. */
export class FakeSandbox implements Sandbox {
  destroyed: string[] = [];
  async provision(sessionId: string): Promise<SandboxHandle> {
    return {
      opencodeUrl: 'http://127.0.0.1:4096',
      workdir: `/fake/${sessionId}`,
      destroy: async () => { this.destroyed.push(sessionId); },
    };
  }
}

/**
 * Dev/CI sandbox: a per-session workdir on the host, pointed at an already-running
 * local `opencode serve`. NO isolation — for building/testing the loop only.
 */
export class LocalSandbox implements Sandbox {
  constructor(private opencodeUrl: string, private root: string) {}
  async provision(sessionId: string, files: SeedFile[]): Promise<SandboxHandle> {
    const workdir = join(this.root, safeName(sessionId));
    await mkdir(workdir, { recursive: true });
    await seed(workdir, files);
    return {
      opencodeUrl: this.opencodeUrl,
      workdir,
      destroy: async () => { await rm(workdir, { recursive: true, force: true }); },
    };
  }
}
