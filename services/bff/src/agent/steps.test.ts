import { describe, it, expect } from 'vitest';
import { friendlyToolName, toStep } from './steps';

describe('friendlyToolName', () => {
  it('maps native tools to business-friendly labels', () => {
    expect(friendlyToolName('bash')).toBe('Running terminal command');
    expect(friendlyToolName('read', { path: '/workspace/inputs/zephyr.md' })).toBe('Reading zephyr.md');
    expect(friendlyToolName('edit', { path: 'deck.json' })).toBe('Editing deck.json');
    expect(friendlyToolName('write', { path: 'a/b/out.py' })).toBe('Editing out.py');
    expect(friendlyToolName('update_task_list')).toBe('Updating task list');
    expect(friendlyToolName('emit_artifact')).toBe('Finalizing artifact');
  });
  it('detects python by command/file', () => {
    expect(friendlyToolName('bash', { command: 'python3 parse.py' })).toBe('Running Python');
  });
  it('falls back to the raw name', () => {
    expect(friendlyToolName('grep')).toBe('grep');
  });
});

describe('toStep', () => {
  it('maps a tool-start event to a start Step', () => {
    const s = toStep({ type: 'tool', name: 'read', state: 'start', args: { path: 'x/zephyr.md' } });
    expect(s).toEqual({ kind: 'tool', name: 'Reading zephyr.md', status: 'start' });
  });
  it('maps a tool-completed event to an ok Step with detail', () => {
    const s = toStep({ type: 'tool', name: 'bash', state: 'completed', args: { command: 'ls' }, output: 'a\nb' });
    expect(s).toMatchObject({ kind: 'tool', status: 'ok', detail: 'a\nb' });
  });
  it('maps an errored tool event to an err Step', () => {
    const s = toStep({ type: 'tool', name: 'bash', state: 'error', output: 'boom' });
    expect(s).toMatchObject({ kind: 'tool', status: 'err', detail: 'boom' });
  });
  it('ignores events with no tool name', () => {
    expect(toStep({ type: 'message', text: 'hi' })).toBeNull();
  });
});
