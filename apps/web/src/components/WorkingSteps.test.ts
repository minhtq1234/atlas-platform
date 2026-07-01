import { describe, it, expect } from 'vitest';
import { partitionSteps } from './WorkingSteps';
import type { AgentStep } from '../types';

describe('partitionSteps', () => {
  it('keeps the latest task list and collects chips in order', () => {
    const steps: AgentStep[] = [
      { kind: 'task', tasks: [{ id: '1', title: 'a', status: 'active' }] },
      { kind: 'tool', name: 'Running Python', status: 'ok' },
      { kind: 'task', tasks: [{ id: '1', title: 'a', status: 'done' }] },
      { kind: 'text', name: 'Thinking', status: 'start' },
    ];
    const { tasks, chips } = partitionSteps(steps);
    expect(tasks[0].status).toBe('done');
    expect(chips.map((c) => c.name)).toEqual(['Running Python', 'Thinking']);
  });
});
