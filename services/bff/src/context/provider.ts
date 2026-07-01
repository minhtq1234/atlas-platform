import { config } from '../config';

export interface ContextProvider {
  getContext(docIds: string[], query: string): Promise<string[]>;
}

export function makeContextProvider(
  artifactsUrl: string = config.artifactsUrl,
  fetchFn: typeof fetch = fetch,
): ContextProvider {
  return {
    async getContext(docIds, query) {
      if (!docIds || docIds.length === 0) return [];
      try {
        const res = await fetchFn(`${artifactsUrl}/attachments/retrieve`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ doc_ids: docIds, query, k: 6 }),
        });
        if (!res.ok) return [];
        const data = (await res.json()) as { passages?: { name: string; text: string }[] };
        return (data.passages ?? []).map((p) => `[${p.name}] ${p.text}`);
      } catch {
        return []; // attachments are best-effort context — never fail the turn
      }
    },
  };
}

export const contextProvider = makeContextProvider();
