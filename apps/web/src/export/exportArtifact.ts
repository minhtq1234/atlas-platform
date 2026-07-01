import type { Artifact, ArtifactContent, DashboardContent, ReportContent } from '../types';

const OFFICE_KINDS = new Set(['Doc', 'Sheet', 'Deck']);

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function safeName(name: string): string {
  // Keep Unicode (Vietnamese) letters; only strip characters illegal in filenames.
  return (
    name
      .replace(/[/\\:*?"<>|]+/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80) || 'artifact'
  );
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header); // RFC 5987 (Unicode) wins
  if (star) {
    try {
      return decodeURIComponent(star[1]);
    } catch {
      /* fall through */
    }
  }
  const m = /filename="?([^";]+)"?/.exec(header);
  return m ? m[1] : fallback;
}

/** Office export (Doc/Sheet/Deck) via the Python artifact service. */
async function exportOffice(name: string, content: ArtifactContent): Promise<void> {
  const res = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error(`export failed (${res.status})`);
  const blob = await res.blob();
  const ext = content.kind === 'Doc' ? 'docx' : content.kind === 'Sheet' ? 'xlsx' : 'pptx';
  const fallback = `${safeName(name)}.${ext}`;
  triggerDownload(blob, filenameFromDisposition(res.headers.get('Content-Disposition'), fallback));
}

export const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function dashboardHtml(c: DashboardContent, name: string): string {
  const tiles = c.tiles
    .map(
      (t) => `<div class="tile"><div class="lbl">${esc(t.label)}</div><div class="val">${esc(t.value)}</div>${t.delta ? `<div class="delta">${esc(t.delta)}</div>` : ''}</div>`,
    )
    .join('');
  const n = c.series.bars.length;
  const bars = c.series.bars
    .map((b, i) => {
      const raw = b as unknown as number | { label: string; value: number };
      const value = typeof raw === 'number' ? raw : raw.value;
      const label = typeof raw === 'number' ? '' : raw.label;
      return `<div class="col"><div class="bar" style="height:${Math.round(value * 100)}%;background:${i === n - 1 ? '#F0997B' : '#2D3A8C'}"></div><span class="xlbl">${esc(label)}</span></div>`;
    })
    .join('');
  return shell(name, `
    <h1>${esc(c.title)}</h1><p class="sub">${esc(c.subtitle)}</p>
    <div class="tiles">${tiles}</div>
    <div class="card"><div class="caption">${esc(c.series.label)}</div><div class="chart">${bars}</div></div>`);
}

function reportHtml(c: ReportContent, name: string): string {
  const stats = c.stats
    .map((s) => `<div class="tile"><div class="val ind">${esc(s.value)}</div><div class="lbl">${esc(s.label)}</div></div>`)
    .join('');
  const paras = c.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('');
  return shell(name, `
    <div class="accent"></div>
    <div class="eyebrow">${esc(c.eyebrow)}</div>
    <h1 class="serif">${esc(c.title)}</h1><p class="sub">${esc(c.asOf)}</p>
    <div class="tiles">${stats}</div>${paras}`);
}

/** Self-contained HTML report (no external assets — sovereignty). */
function shell(name: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(name)}</title>
<style>
  body{margin:0;background:#F4F2EC;color:#1A1A2E;font-family:system-ui,-apple-system,'Be Vietnam Pro',sans-serif;padding:40px}
  .wrap{max-width:760px;margin:0 auto;background:#fff;border:1px solid #E3E1DA;border-radius:14px;padding:34px 40px;box-shadow:0 2px 14px rgba(26,26,46,.05);position:relative;overflow:hidden}
  .accent{position:absolute;top:0;left:0;right:0;height:8px;background:#F0997B}
  .eyebrow{font-size:11px;font-weight:700;letter-spacing:1.6px;color:#6E6C64;margin-bottom:8px}
  h1{font-size:30px;margin:.2em 0}.serif{font-family:Georgia,'Newsreader',serif}
  .sub{color:#6E6C64;margin:0 0 18px;font-size:13px}
  p{line-height:1.65;color:#54534D}
  .tiles{display:flex;gap:12px;margin:18px 0}
  .tile{flex:1;border:1px solid #ECEAE3;border-radius:9px;padding:12px 14px}
  .lbl{font-size:10px;color:#6E6C64;font-weight:600}.val{font-size:22px;font-weight:700}.val.ind{color:#2D3A8C}
  .delta{font-size:11px;color:#0F6E56;font-weight:600}
  .card{border:1px solid #ECEAE3;border-radius:9px;padding:16px}
  .caption{font-size:10px;font-weight:700;color:#6E6C64;text-transform:uppercase;letter-spacing:.5px;margin-bottom:12px}
  .chart{display:flex;align-items:flex-end;gap:12px;height:160px}
  .col{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;height:100%;gap:6px}
  .bar{width:100%;border-radius:3px 3px 0 0}
  .xlbl{font-size:10px;color:#6E6C64}
</style></head><body><div class="wrap">${body}</div></body></html>`;
}

/** Export an artifact's current version. Doc/Sheet/Deck → Office file; Dashboard/Report → HTML. */
export async function exportArtifact(artifact: Artifact): Promise<void> {
  const content = artifact.versions[artifact.currentVersion].content;
  if (OFFICE_KINDS.has(content.kind)) {
    await exportOffice(artifact.name, content);
    return;
  }
  const html =
    content.kind === 'Dashboard'
      ? dashboardHtml(content, artifact.name)
      : content.kind === 'Report'
        ? reportHtml(content, artifact.name)
        : `<pre>${esc(JSON.stringify(content, null, 2))}</pre>`;
  triggerDownload(new Blob([html], { type: 'text/html' }), `${safeName(artifact.name)}.html`);
}
