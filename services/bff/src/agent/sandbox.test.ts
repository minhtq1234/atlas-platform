import { describe, it, expect } from 'vitest';
import { readFile, rm, access } from 'node:fs/promises';
import { join } from 'node:path';
import { FakeSandbox, LocalSandbox } from './sandbox';

describe('FakeSandbox', () => {
  it('returns a handle and records destroy', async () => {
    const fake = new FakeSandbox();
    const h = await fake.provision('s1', [{ name: 'a.txt', bytes: Buffer.from('hi') }]);
    expect(h.opencodeUrl).toContain('http');
    await h.destroy();
    expect(fake.destroyed).toContain('s1');
  });
});

describe('LocalSandbox', () => {
  it('seeds files into a per-session workdir and cleans up on destroy', async () => {
    const root = join('/tmp', `atlas-agent-test-${process.pid}`);
    const box = new LocalSandbox('http://127.0.0.1:4096', root);
    const h = await box.provision('sess', [{ name: 'zephyr.md', bytes: Buffer.from('Project Zephyr') }]);
    const seeded = await readFile(join(h.workdir, 'inputs', 'zephyr.md'), 'utf8');
    expect(seeded).toBe('Project Zephyr');
    await h.destroy();
    await expect(access(h.workdir)).rejects.toThrow();
    await rm(root, { recursive: true, force: true });
  });

  it('sanitizes filenames to prevent path escape', async () => {
    const root = join('/tmp', `atlas-agent-test2-${process.pid}`);
    const box = new LocalSandbox('http://127.0.0.1:4096', root);
    const h = await box.provision('sess', [{ name: '../../etc/passwd', bytes: Buffer.from('x') }]);
    const files = await readFile(join(h.workdir, 'inputs', 'etc-passwd'), 'utf8');
    expect(files).toBe('x');
    await h.destroy();
    await rm(root, { recursive: true, force: true });
  });
});
