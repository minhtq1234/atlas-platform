import { spawn } from 'node:child_process';
import { mkdtemp, writeFile, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { config } from '../config';
import type { Sandbox, SandboxHandle, SeedFile } from './types';
import { safeName } from './sandbox';

/** Build the `docker run` argv for a firewalled, ephemeral agent sandbox. Pure → testable. */
export function containerArgs(name: string, hostWorkdir: string, port: number): string[] {
  return [
    'run', '--rm', '--name', name,
    '--network', 'atlas-egress',           // a pre-created network restricted to the model host
    '-v', `${hostWorkdir}:/workspace`,
    '-w', '/workspace',
    '-p', `127.0.0.1:${port}:4096`,
    config.agent.image,
    'opencode', 'serve', '--hostname', '0.0.0.0', '--port', '4096',
  ];
}

/**
 * Prod sandbox: one ephemeral container per session running `opencode serve`,
 * workspace-mounted, network restricted to the model host by the docker network.
 * LIVE-GATED: requires the `atlas-egress` network + built image (see docs).
 */
export class ContainerSandbox implements Sandbox {
  async provision(sessionId: string, files: SeedFile[]): Promise<SandboxHandle> {
    const workdir = await mkdtemp(join(tmpdir(), 'atlas-box-'));
    const name = `atlas-${sessionId.slice(0, 12)}`;
    const port = 42000 + (Math.abs(hash(sessionId)) % 2000);
    const dockerRm = () => new Promise<void>((r) => {
      const k = spawn('docker', ['rm', '-f', name], { stdio: 'ignore' });
      k.on('exit', () => r()); k.on('error', () => r());
    });
    let proc: ReturnType<typeof spawn> | undefined;
    try {
      const inputs = join(workdir, 'inputs');
      await mkdir(inputs, { recursive: true });
      for (const f of files) await writeFile(join(inputs, safeName(f.name)), f.bytes);
      proc = spawn('docker', containerArgs(name, workdir, port), { stdio: 'ignore' });
      await waitForPort(port, config.agent.timeoutMs);
      const p = proc;
      return {
        opencodeUrl: `http://127.0.0.1:${port}`,
        workdir,                 // host mount (BFF seeds/reads here)
        agentDir: '/workspace',  // path the agent sees inside the container
        projectDir: '/workspace',
        destroy: async () => { await dockerRm(); p.kill('SIGKILL'); await rm(workdir, { recursive: true, force: true }); },
      };
    } catch (err) {
      if (proc) proc.kill('SIGKILL');
      await dockerRm();
      await rm(workdir, { recursive: true, force: true });
      throw err;
    }
  }
}

function hash(s: string): number {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h;
}

async function waitForPort(port: number, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/health`);
      if (r.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() > deadline) throw new Error('sandbox did not become ready');
    await new Promise((r) => setTimeout(r, 400));
  }
}
