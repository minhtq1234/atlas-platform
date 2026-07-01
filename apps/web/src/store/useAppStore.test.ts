import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from './useAppStore';

const reset = () =>
  useAppStore.setState({
    draft: '',
    output: 'Doc',
    sourceKey: 'HRCore',
    menu: null,
    tab: 'all',
    connectOpen: false,
    chips: [],
    configDraft: '',
    configure: null,
    uploads: [],
  });

describe('useAppStore', () => {
  beforeEach(reset);

  it('toggleMenu opens then closes the same menu', () => {
    const { toggleMenu } = useAppStore.getState();
    toggleMenu('model');
    expect(useAppStore.getState().menu).toBe('model');
    toggleMenu('model');
    expect(useAppStore.getState().menu).toBeNull();
  });

  it('toggleMenu switches between menus', () => {
    const { toggleMenu } = useAppStore.getState();
    toggleMenu('output');
    toggleMenu('source');
    expect(useAppStore.getState().menu).toBe('source');
  });

  it('selectSource sets a connected+accessible source', () => {
    useAppStore.getState().selectSource('ATS');
    expect(useAppStore.getState().sourceKey).toBe('ATS');
    expect(useAppStore.getState().connectOpen).toBe(false);
  });

  it('selectSource on a non-provisioned source opens the connect panel, does not select', () => {
    useAppStore.getState().selectSource('Finance');
    expect(useAppStore.getState().sourceKey).toBe('HRCore'); // unchanged
    expect(useAppStore.getState().connectOpen).toBe(true);
  });

  it('addChip dedupes and clears the draft', () => {
    const s = useAppStore.getState();
    s.setConfigDraft('Q2 2026');
    s.addChip('Q2 2026');
    s.addChip('Q2 2026');
    expect(useAppStore.getState().chips).toEqual(['Q2 2026']);
    expect(useAppStore.getState().configDraft).toBe('');
  });

  it('removeChip removes by index', () => {
    const s = useAppStore.getState();
    s.addChip('A');
    s.addChip('B');
    s.removeChip(0);
    expect(useAppStore.getState().chips).toEqual(['B']);
  });

  it('updateUpload patches only the matching upload', () => {
    const s = useAppStore.getState();
    s.addUpload({ id: 'a', name: 'a.md', sizeBytes: 10, mime: 'text/markdown' });
    s.addUpload({ id: 'b', name: 'b.md', sizeBytes: 20, mime: 'text/markdown' });
    s.updateUpload('a', { docId: 'doc-1', chars: 1234, preview: 'hi' });
    const ups = useAppStore.getState().uploads;
    expect(ups.find((u) => u.id === 'a')).toMatchObject({
      id: 'a',
      name: 'a.md',
      docId: 'doc-1',
      chars: 1234,
      preview: 'hi',
    });
    expect(ups.find((u) => u.id === 'b')?.docId).toBeUndefined();
  });

  it('updateUpload is a no-op for an unknown id', () => {
    const s = useAppStore.getState();
    s.addUpload({ id: 'a', name: 'a.md', sizeBytes: 10, mime: 'text/markdown' });
    s.updateUpload('missing', { docId: 'doc-x' });
    expect(useAppStore.getState().uploads.find((u) => u.id === 'a')?.docId).toBeUndefined();
  });

  it('openConfigureFromTemplate seeds the configure target', () => {
    useAppStore.getState().openConfigureFromTemplate({
      id: 'x',
      name: 'People Review',
      type: 'Deck',
      sourceKey: 'HRCore',
      sourceLabel: 'HRCore · headcount view',
    });
    const c = useAppStore.getState().configure;
    expect(c?.type).toBe('Deck');
    expect(c?.name).toBe('People Review');
  });

  it('toggleSourceConnected flips only accessible sources', () => {
    const s = useAppStore.getState();
    s.toggleSourceConnected('Finance'); // not accessible — no-op
    expect(
      useAppStore.getState().sources.find((x) => x.key === 'Finance')?.connected,
    ).toBe(false);
    s.toggleSourceConnected('ATS');
    expect(
      useAppStore.getState().sources.find((x) => x.key === 'ATS')?.connected,
    ).toBe(false);
  });

  it('toggles agent mode', () => {
    useAppStore.getState().setAgentMode(true);
    expect(useAppStore.getState().agentMode).toBe(true);
    useAppStore.getState().setAgentMode(false);
    expect(useAppStore.getState().agentMode).toBe(false);
  });
});
