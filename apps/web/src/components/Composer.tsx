import { useRef, useState } from 'react';
import { color, radius, shadow } from '../brand/tokens';
import { Dropdown, menuRowStyle } from './Dropdown';
import { LogoMark } from './Orb';
import { AgentRunOverlay } from './AgentRunOverlay';
import { useAppStore } from '../store/useAppStore';
import { MODELS, SOURCES, type Template } from '../data/templates';
import { ARTIFACT_TYPES, type UploadRef, type BuildRequest } from '../types';
import { t } from '../i18n/strings';
import { WEB_ARCHETYPES, detectArchetype } from '../data/archetypes';

export function Composer() {
  const fileRef = useRef<HTMLInputElement>(null);
  const s = useAppStore();
  const agentMode = useAppStore((s) => s.agentMode);
  const setAgentMode = useAppStore((s) => s.setAgentMode);
  const archetypeId = useAppStore((s) => s.archetypeId);
  const setArchetype = useAppStore((s) => s.setArchetype);
  const selSource = s.sources.find((x) => x.key === s.sourceKey);
  const selModel = MODELS.find((m) => m.id === s.modelId);
  const [agentReq, setAgentReq] = useState<{ req: BuildRequest; name: string } | null>(null);

  const doSend = () => {
    const brief = s.draft.trim();
    if (!brief) {
      s.showToast('Describe what you want, or pick a template below.');
      return;
    }
    const name = brief.length > 42 ? brief.slice(0, 42) + '…' : brief;
    if (agentMode) {
      setAgentReq({ req: s.composerRequest(brief), name });
      return;
    }
    s.beginBuild(s.composerRequest(brief), name);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        s.showToast(`"${f.name}" is over 10 MB — pick a smaller file.`);
        continue;
      }
      const u: UploadRef = {
        id: `up-${crypto.randomUUID()}`,
        name: f.name,
        sizeBytes: f.size,
        mime: f.type || 'application/octet-stream',
      };
      // Show the chip immediately; enrich it with the parsed docId when ready.
      s.addUpload(u);
      const form = new FormData();
      form.append('file', f);
      try {
        const res = await fetch('/api/attachments', { method: 'POST', body: form });
        if (res.ok) {
          const d = await res.json();
          s.updateUpload(u.id, { docId: d.doc_id, chars: d.chars, preview: d.preview });
        } else {
          s.showToast(`Couldn't read "${f.name}".`);
        }
      } catch {
        s.showToast(`Couldn't read "${f.name}".`);
      }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const pillBase = {
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 7,
    borderRadius: radius.buttonSm,
    padding: '7px 12px',
    fontSize: 12.5,
    fontWeight: 600,
  } as const;

  return (
    <>
    <div
      style={{
        width: '100%',
        maxWidth: 720,
        marginTop: 26,
        background: '#fff',
        border: `1px solid ${color.border}`,
        borderRadius: radius.composer,
        boxShadow: shadow.card,
        padding: '18px 18px 13px',
      }}
    >
      <input
        value={s.draft}
        onChange={(e) => {
          const v = e.target.value;
          s.setDraft(v);
          if (s.output === 'Doc') setArchetype(detectArchetype(v));
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
            e.preventDefault();
            doSend();
          }
        }}
        placeholder={t('composerPlaceholder', s.lang)}
        aria-label="Artifact brief"
        style={{
          width: '100%',
          border: 'none',
          outline: 'none',
          fontFamily: 'inherit',
          fontSize: 16,
          color: color.ink,
          background: 'none',
          padding: '4px 2px 14px',
        }}
      />

      {s.uploads.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, paddingBottom: 12 }}>
          {s.uploads.map((u) => (
            <span
              key={u.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                background: color.paper,
                border: `1px solid ${color.border}`,
                borderRadius: radius.pill,
                padding: '5px 10px',
                fontSize: 12,
                fontWeight: 600,
                color: color.textSlate,
              }}
            >
              📎 {u.name}
              {u.chars ? ` · ${Math.round(u.chars / 1000)}k chars` : ''}
              <button
                type="button"
                aria-label={`Remove ${u.name}`}
                onClick={() => s.removeUpload(u.id)}
                style={{ border: 'none', background: 'none', cursor: 'pointer', color: color.textMuted, fontSize: 13, lineHeight: 1, padding: 0 }}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap' }}>
        {/* output type */}
        <Dropdown
          open={s.menu === 'output'}
          onToggle={() => s.toggleMenu('output')}
          onClose={s.closeMenus}
          buttonAriaLabel="Output type"
          buttonContent={
            <>
              📄 {s.output} <span style={{ color: 'rgba(255,255,255,0.6)' }}>▾</span>
            </>
          }
          buttonStyle={{ ...pillBase, background: color.ink, border: `1px solid ${color.ink}`, padding: '8px 14px', fontSize: 13, color: '#fff' }}
          menuWidth={170}
        >
          {ARTIFACT_TYPES.map((tp) => (
            <button key={tp} type="button" role="menuitem" onClick={() => s.setOutput(tp)} style={menuRowStyle(tp === s.output)}>
              📄 {tp}
            </button>
          ))}
        </Dropdown>

        {/* data source */}
        <Dropdown
          open={s.menu === 'source'}
          onToggle={() => s.toggleMenu('source')}
          onClose={s.closeMenus}
          buttonAriaLabel="Data source"
          buttonContent={
            <>
              <LogoMark scale={0.7} />
              {selSource ? selSource.key : 'Add data'} <span style={{ color: color.textFaint }}>▾</span>
            </>
          }
          buttonStyle={{ ...pillBase, background: color.paper, border: `1px solid ${color.border}`, color: color.textSlate2 }}
          menuWidth={248}
        >
          {SOURCES.map((o) => {
            const live = s.sources.find((x) => x.key === o.key)!;
            const active = o.key === s.sourceKey;
            return (
              <button key={o.key} type="button" role="menuitem" onClick={() => s.selectSource(o.key)} style={menuRowStyle(active)}>
                <span style={{ flex: 1, textAlign: 'left' }}>{o.label}</span>
                {!live.connected ? (
                  <span style={{ fontSize: 11, fontWeight: 700, color: color.warnText, background: color.warnBg, borderRadius: radius.pill, padding: '2px 8px' }}>connect</span>
                ) : active ? (
                  <span style={{ color: color.indigo, fontWeight: 700 }}>✓</span>
                ) : null}
              </button>
            );
          })}
          <button
            type="button"
            onClick={s.openConnect}
            style={{ cursor: 'pointer', width: '100%', textAlign: 'left', border: 'none', background: 'none', borderTop: `1px solid ${color.borderSoft}`, marginTop: 4, padding: '9px 11px 5px', fontSize: 12.5, fontWeight: 600, color: color.indigo }}
          >
            + Connect a source…
          </button>
        </Dropdown>

        {/* model */}
        <Dropdown
          open={s.menu === 'model'}
          onToggle={() => s.toggleMenu('model')}
          onClose={s.closeMenus}
          buttonAriaLabel="Model"
          buttonContent={
            <>
              {selModel?.label} <span style={{ color: color.textFaint }}>▾</span>
            </>
          }
          buttonStyle={{ ...pillBase, background: 'none', border: `1px solid ${color.border}`, color: color.textMuted }}
          menuWidth={226}
        >
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.6px', color: color.textFaint, padding: '6px 11px 4px' }}>
            GREENNODE · HOSTED
          </div>
          {MODELS.map((m) => (
            <button key={m.id} type="button" role="menuitem" onClick={() => s.setModel(m.id)} style={menuRowStyle(m.id === s.modelId)}>
              {m.label}
            </button>
          ))}
        </Dropdown>

        {/* agent mode toggle */}
        <button
          type="button"
          onClick={() => setAgentMode(!agentMode)}
          aria-pressed={agentMode}
          title="Agent mode: multi-step, uses tools"
          style={{ cursor: 'pointer', border: `1px solid ${agentMode ? color.indigo : color.border}`, background: agentMode ? color.indigo100 : '#fff', color: agentMode ? color.indigo : color.textMuted, borderRadius: radius.pill, padding: '6px 12px', fontSize: 12.5, fontWeight: 600 }}
        >
          ✦ Agent
        </button>

        {/* document type chip — Doc only */}
        {s.output === 'Doc' && (
          <select
            value={archetypeId}
            onChange={(e) => setArchetype(e.target.value)}
            aria-label="Document type"
            style={{ fontFamily: 'inherit', cursor: 'pointer', border: `1px solid ${color.border}`, background: '#fff', color: color.textSlate, borderRadius: radius.pill, padding: '6px 10px', fontSize: 12.5, fontWeight: 600 }}
          >
            {WEB_ARCHETYPES.map((a) => (
              <option key={a.id} value={a.id}>{a.id === 'general' ? 'Document' : a.label}</option>
            ))}
          </select>
        )}

        {/* upload */}
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <button
          type="button"
          aria-label="Attach a file"
          onClick={() => fileRef.current?.click()}
          style={{ ...pillBase, cursor: 'pointer', background: 'none', border: `1px solid ${color.border}`, color: color.textMuted, padding: '7px 11px' }}
        >
          📎
        </button>

        {/* send */}
        <button
          type="button"
          aria-label="Build"
          onClick={doSend}
          style={{ cursor: 'pointer', marginLeft: 'auto', border: 'none', background: color.ink, color: '#fff', width: 40, height: 40, borderRadius: radius.button, fontSize: 17 }}
        >
          ↑
        </button>
      </div>
    </div>
    {agentReq && <AgentRunOverlay req={agentReq.req} name={agentReq.name} onClose={() => setAgentReq(null)} />}
    </>
  );
}

export type { Template };
