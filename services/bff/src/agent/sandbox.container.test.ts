import { describe, it, expect } from 'vitest';
import { containerArgs } from './sandbox.container';

describe('containerArgs', () => {
  it('binds loopback-only, mounts the workdir, and restricts the network', () => {
    const a = containerArgs('atlas-abc', '/tmp/box', 42123);
    expect(a).toContain('--rm');
    expect(a.join(' ')).toContain('127.0.0.1:42123:4096');
    expect(a.join(' ')).toContain('/tmp/box:/workspace');
    expect(a).toContain('atlas-egress');
  });
});
