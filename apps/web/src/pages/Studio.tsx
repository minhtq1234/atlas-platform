import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { color, radius } from '../brand/tokens';
import { Orb, LogoMark } from '../components/Orb';
import { ArtifactCanvas, pageCount, pageLabel } from '../artifacts/ArtifactCanvas';
import { DeckView } from '../artifacts/renderers/DeckView';
import { useAppStore } from '../store/useAppStore';
import { reviseArtifact } from '../generation/engine';
import { exportArtifact } from '../export/exportArtifact';
import { MODELS } from '../data/templates';
import type { AgentAction } from '../types';

interface ChatMsg { role: 'assistant' | 'user'; text: string; action?: AgentAction; }

export function Studio() {
  const { id } = useParams();
  const navigate = useNavigate();
  const library = useAppStore((s) => s.library);
  const addVersion = useAppStore((s) => s.addVersion);
  const setCurrentVersion = useAppStore((s) => s.setCurrentVersion);
  const setAwaiting = useAppStore((s) => s.setAwaiting);
  const showToast = useAppStore((s) => s.showToast);

  const artifact = useMemo(() => library.find((a) => a.id === id), [library, id]);

  const [page, setPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [shared, setShared] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [draft, setDraft] = useState('');
  const [thinking, setThinking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>(() => [
    {
      role: 'assistant',
      text: artifact
        ? `I've loaded ${artifact.name} on the canvas. Tell me what you'd like to change — content, layout, colors, or data sources.`
        : '',
    },
  ]);

  if (!artifact) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 700 }}>This artifact isn't loaded.</div>
        <button type="button" onClick={() => navigate('/')} style={primaryBtn}>Back to Atlas</button>
      </div>
    );
  }

  const version = artifact.versions[artifact.currentVersion];
  const content = version.content;
  const total = pageCount(content);
  const safePage = Math.min(page, total - 1);
  const model = MODELS.find((m) => m.id === artifact.modelId)?.label ?? artifact.modelId;

  const onSend = async (text: string, confirm = false) => {
    const trimmed = text.trim();
    if ((!trimmed && !confirm) || thinking) return;
    // Re-read the latest artifact + plan-confirm state from the store so rapid
    // follow-ups revise the just-added version, not a stale render closure.
    const store = useAppStore.getState();
    const latest = store.artifactById(id!) ?? artifact;
    const aw = store.awaiting[id!] ?? 'none';
    const pending = store.pendingPlan[id!];
    const plan = pending && pending.steps.length ? pending : undefined;
    // A Confirm click has no user-visible text — don't echo an empty bubble.
    if (!confirm) setMessages((m) => [...m, { role: 'user', text: trimmed }]);
    setDraft('');
    setThinking(true);
    try {
      const { action, version, awaiting } = await reviseArtifact(latest, trimmed || 'proceed', { awaiting: aw, plan, confirm });
      if (version) addVersion(latest.id, version); // only when the artifact actually changed
      setAwaiting(latest.id, awaiting, awaiting === 'plan-confirm' ? action.plan : undefined);
      setMessages((m) => [...m, { role: 'assistant', text: action.message, action }]);
    } catch {
      setMessages((m) => [...m, { role: 'assistant', text: "I couldn't do that — please try again." }]);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div style={{ height: '100vh', display: 'flex', background: color.paper }}>
      {/* CHAT (left) */}
      <div style={{ width: 380, flex: 'none', display: 'flex', flexDirection: 'column', background: '#fff', borderRight: `1px solid ${color.borderSoft}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 18px', borderBottom: `1px solid ${color.borderSoft}` }}>
          <button type="button" aria-label="Back to Atlas" onClick={() => navigate('/')} style={{ cursor: 'pointer', border: 'none', background: 'none', display: 'flex', alignItems: 'center', gap: 9 }}>
            <LogoMark scale={0.85} />
          </button>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artifact.name}</div>
            <div style={{ fontSize: 11, color: color.textMuted }}>{model}</div>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {messages.map((m, i) =>
            m.role === 'assistant' ? (
              <div key={i} style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
                <Orb size={22} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13.5, lineHeight: 1.55, color: color.ink }}>{m.text}</div>
                  {/* clarify → quick-reply option chips */}
                  {m.action?.skill === 'clarify' && m.action.options && m.action.options.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 10 }}>
                      {m.action.options.map((o) => (
                        <button key={o} type="button" onClick={() => onSend(o)} disabled={thinking} style={chipStyle}>{o}</button>
                      ))}
                    </div>
                  )}
                  {/* plan → numbered plan card + explicit Confirm */}
                  {m.action?.skill === 'plan' && m.action.plan && m.action.plan.steps.length > 0 && (
                    <div style={planCard}>
                      <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {m.action.plan.steps.map((s, si) => (
                          <li key={si} style={{ fontSize: 12.5, lineHeight: 1.5, color: color.textSlate }}>{s}</li>
                        ))}
                      </ol>
                      <button type="button" onClick={() => onSend('', true)} disabled={thinking} style={confirmBtn}>Confirm</button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div key={i} style={{ alignSelf: 'flex-end', maxWidth: '85%', background: color.indigo100, color: color.indigo, borderRadius: 12, padding: '9px 13px', fontSize: 13.5, lineHeight: 1.5 }}>{m.text}</div>
            ),
          )}
          {thinking && (
            <div style={{ display: 'flex', gap: 9, alignItems: 'center' }}>
              <Orb size={22} spin={2} />
              <div style={{ fontSize: 13, color: color.textMuted }}>Updating…</div>
            </div>
          )}
        </div>

        <div style={{ flex: 'none', padding: '12px 16px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: color.paper, border: `1px solid ${color.border}`, borderRadius: 14, padding: '8px 8px 8px 14px' }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); onSend(draft); } }}
              placeholder="Ask follow-up"
              aria-label="Ask a follow-up"
              style={{ flex: 1, border: 'none', outline: 'none', background: 'none', fontFamily: 'inherit', fontSize: 14, color: color.ink, padding: '6px 0' }}
            />
            <button type="button" aria-label="Send" onClick={() => onSend(draft)} style={{ cursor: 'pointer', border: 'none', background: color.ink, color: '#fff', width: 34, height: 34, borderRadius: 9, fontSize: 15, flex: 'none' }}>↑</button>
          </div>
        </div>
      </div>

      {/* CANVAS (right) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* canvas header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: `1px solid ${color.borderSoft}` }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: color.textSlate }}>{pageLabel(content, safePage)}</span>

          {/* view/edit */}
          <div style={{ display: 'flex', background: '#fff', border: `1px solid ${color.border}`, borderRadius: 9, overflow: 'hidden', marginLeft: 8 }}>
            {(['view', 'edit'] as const).map((m) => (
              <button key={m} type="button" onClick={() => { setMode(m); if (m === 'edit') showToast('Editing happens in chat — tell Atlas what to change.'); }} style={{ cursor: 'pointer', border: 'none', background: mode === m ? color.ink : 'transparent', color: mode === m ? '#fff' : color.textMuted, fontSize: 12.5, fontWeight: 600, padding: '6px 13px', textTransform: 'capitalize' }}>{m}</button>
            ))}
          </div>

          {/* pager */}
          {total > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
              <button type="button" aria-label="Previous" onClick={() => setPage((p) => Math.max(0, p - 1))} style={iconBtn}>‹</button>
              <span style={{ fontSize: 12.5, color: color.textMuted, fontVariantNumeric: 'tabular-nums' }}>{safePage + 1} / {total}</span>
              <button type="button" aria-label="Next" onClick={() => setPage((p) => Math.min(total - 1, p + 1))} style={iconBtn}>›</button>
            </div>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
            {/* version history */}
            <button type="button" onClick={() => setShowVersions((v) => !v)} style={ghostBtn} aria-label="Version history">
              🕑 v{artifact.currentVersion + 1}
            </button>
            {showVersions && (
              <>
                <div onClick={() => setShowVersions(false)} style={{ position: 'fixed', inset: 0, zIndex: 18 }} />
                <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 20, background: '#fff', border: `1px solid ${color.border}`, borderRadius: radius.menu, boxShadow: '0 12px 34px rgba(26,26,46,0.16)', padding: 6, minWidth: 240 }}>
                  {artifact.versions.map((v, i) => (
                    <button key={v.id} type="button" onClick={() => { setCurrentVersion(artifact.id, i); setShowVersions(false); }} style={{ cursor: 'pointer', width: '100%', textAlign: 'left', border: 'none', borderRadius: 8, padding: '9px 11px', background: i === artifact.currentVersion ? color.indigo100 : 'none', color: i === artifact.currentVersion ? color.indigo : color.ink, fontSize: 12.5, fontWeight: 600 }}>
                      v{i + 1} · {v.note}
                    </button>
                  ))}
                </div>
              </>
            )}
            <button type="button" onClick={() => setShared((s) => !s)} style={{ ...ghostBtn, color: shared ? color.positive : color.textMuted }}>{shared ? '✓ Shared' : 'Share'}</button>
            <button type="button" onClick={() => showToast('Copied to a new chat.')} style={ghostBtn}>Copy</button>
            <button
              type="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  await exportArtifact(artifact);
                  const ext = artifact.type === 'Doc' ? '.docx' : artifact.type === 'Sheet' ? '.xlsx' : artifact.type === 'Deck' ? '.pptx' : '.html';
                  showToast(`Downloaded ${artifact.name}${ext}`);
                } catch {
                  showToast("Couldn't export — is the artifact service running?");
                } finally {
                  setDownloading(false);
                }
              }}
              style={{ cursor: downloading ? 'default' : 'pointer', border: 'none', background: color.ink, color: '#fff', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, opacity: downloading ? 0.6 : 1 }}
            >
              {downloading ? 'Exporting…' : '⤓ Download'}
            </button>
          </div>
        </div>

        {/* canvas */}
        <div style={{ flex: 1, overflow: 'auto', background: '#EDEBE4', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 32 }}>
          <div style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}>
            <ArtifactCanvas content={content} page={safePage} />
          </div>
        </div>

        {/* zoom + filmstrip */}
        <div style={{ flex: 'none', borderTop: `1px solid ${color.borderSoft}`, background: '#fff', padding: '10px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button type="button" aria-label="Zoom out" onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))} style={iconBtn}>−</button>
            <span style={{ fontSize: 12, color: color.textMuted, width: 42, textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
            <button type="button" aria-label="Zoom in" onClick={() => setZoom((z) => Math.min(1.5, +(z + 0.1).toFixed(2)))} style={iconBtn}>+</button>
          </div>
          {content.kind === 'Deck' && (
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', flex: 1 }}>
              {content.slides.map((_, i) => (
                <button key={i} type="button" onClick={() => setPage(i)} aria-label={`Slide ${i + 1}`} style={{ flex: 'none', cursor: 'pointer', border: `2px solid ${i === safePage ? color.indigo : 'transparent'}`, borderRadius: 6, padding: 0, background: 'none', overflow: 'hidden', width: 104, height: 58 }}>
                  <div style={{ transform: 'scale(0.144)', transformOrigin: 'top left', width: 680, pointerEvents: 'none' }}>
                    <DeckView c={content} slide={i} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const iconBtn = { cursor: 'pointer', border: `1px solid ${color.border}`, background: '#fff', width: 28, height: 28, borderRadius: 7, color: color.textSlate, fontSize: 15, lineHeight: 1 } as const;
const ghostBtn = { cursor: 'pointer', border: 'none', background: 'none', color: color.textMuted, fontSize: 12.5, fontWeight: 600 } as const;
const primaryBtn = { cursor: 'pointer', border: 'none', background: color.ink, color: '#fff', padding: '11px 22px', borderRadius: radius.buttonSm, fontSize: 13.5, fontWeight: 600 } as const;

// Agent-skill affordances (clarify chips, plan card + Confirm) — Atlas brand.
const chipStyle = { cursor: 'pointer', border: `1px solid ${color.indigo200}`, background: color.indigo100, color: color.indigo, borderRadius: radius.pill, padding: '6px 12px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.2 } as const;
const planCard = { marginTop: 10, border: `1px solid ${color.border}`, background: color.surfaceAlt, borderRadius: radius.menu, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 10 } as const;
const confirmBtn = { alignSelf: 'flex-start', cursor: 'pointer', border: 'none', background: color.indigo, color: '#fff', borderRadius: radius.buttonSm, padding: '8px 16px', fontSize: 12.5, fontWeight: 600 } as const;
