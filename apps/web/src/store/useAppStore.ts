import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Artifact,
  ArtifactType,
  ArtifactVersion,
  BuildRequest,
  SourceOption,
  UploadRef,
} from '../types';
import { MODELS, SOURCES, type TabKey, type Template } from '../data/templates';

export interface BuildState {
  active: boolean;
  pct: number;
  name: string;
  stage: string;
}

export type MenuName = 'output' | 'source' | 'model' | null;

/** What the configure overlay is editing. */
export interface ConfigureTarget {
  name: string;
  type: ArtifactType;
  sourceKey?: string;
  sourceLabel?: string;
  templateId?: string;
}

interface AppState {
  lang: 'en' | 'vi';
  agentMode: boolean;

  // composer
  draft: string;
  output: ArtifactType;
  sourceKey: string | null;
  modelId: string;
  uploads: UploadRef[];

  // ui
  menu: MenuName;
  tab: TabKey;
  toast: string | null;
  connectOpen: boolean;

  // data sources (mutable connect state, seeded from SOURCES)
  sources: SourceOption[];

  // configure overlay
  configure: ConfigureTarget | null;
  configDraft: string;
  chips: string[];

  // build
  build: BuildState | null;
  pendingReq: BuildRequest | null;

  // library
  library: Artifact[];

  // agent skills — per-artifact plan-confirm state (persisted, survives reload)
  awaiting: Record<string, 'none' | 'plan-confirm'>;
  pendingPlan: Record<string, { steps: string[] }>;

  // actions
  setLang: (l: 'en' | 'vi') => void;
  setAgentMode: (v: boolean) => void;
  setDraft: (v: string) => void;
  setOutput: (t: ArtifactType) => void;
  selectSource: (key: string) => void;
  clearSource: () => void;
  setModel: (id: string) => void;
  toggleMenu: (name: Exclude<MenuName, null>) => void;
  closeMenus: () => void;
  setTab: (tab: TabKey) => void;
  addUpload: (u: UploadRef) => void;
  updateUpload: (id: string, patch: Partial<UploadRef>) => void;
  removeUpload: (id: string) => void;
  toggleSourceConnected: (key: string) => void;
  openConnect: () => void;
  closeConnect: () => void;
  showToast: (msg: string) => void;
  clearToast: () => void;

  openConfigure: (t: ConfigureTarget) => void;
  openConfigureFromTemplate: (tpl: Template) => void;
  closeConfigure: () => void;
  setConfigDraft: (v: string) => void;
  addChip: (text: string) => void;
  removeChip: (index: number) => void;

  /** Kick off a build from the composer or configure overlay. */
  beginBuild: (req: BuildRequest, name: string) => void;
  /** Compose a BuildRequest from current composer state + a brief. */
  composerRequest: (brief: string) => BuildRequest;
  setBuildPct: (pct: number) => void;
  setBuildStage: (label: string) => void;
  endBuild: () => void;

  // library
  addArtifact: (a: Artifact) => void;
  artifactById: (id: string) => Artifact | undefined;
  addVersion: (artifactId: string, v: ArtifactVersion) => void;
  setCurrentVersion: (artifactId: string, index: number) => void;
  /** Record the next awaiting state (and pending plan) for an artifact's chat. */
  setAwaiting: (id: string, awaiting: 'none' | 'plan-confirm', plan?: { steps: string[] }) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
  lang: 'en',
  agentMode: false,

  draft: '',
  output: 'Doc',
  sourceKey: 'HRCore',
  modelId: MODELS[0].id,
  uploads: [],

  menu: null,
  tab: 'all',
  toast: null,
  connectOpen: false,

  sources: SOURCES.map((s) => ({ ...s })),

  configure: null,
  configDraft: '',
  chips: [],

  build: null,
  pendingReq: null,
  library: [],
  awaiting: {},
  pendingPlan: {},

  setLang: (lang) => set({ lang }),
  setAgentMode: (agentMode) => set({ agentMode }),
  setDraft: (draft) => set({ draft }),
  setOutput: (output) => set({ output, menu: null }),

  selectSource: (key) => {
    const src = get().sources.find((s) => s.key === key);
    if (src && src.connected && src.accessible) {
      set({ sourceKey: key, menu: null });
    } else {
      // not connected / not provisioned → route to the connect panel
      set({ menu: null, connectOpen: true });
    }
  },
  clearSource: () => set({ sourceKey: null }),
  setModel: (modelId) => set({ modelId, menu: null }),

  toggleMenu: (name) => set((s) => ({ menu: s.menu === name ? null : name })),
  closeMenus: () => set({ menu: null }),
  setTab: (tab) => set({ tab }),

  addUpload: (u) => set((s) => ({ uploads: [...s.uploads, u] })),
  updateUpload: (id, patch) =>
    set((s) => ({
      uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)),
    })),
  removeUpload: (id) =>
    set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) })),

  toggleSourceConnected: (key) =>
    set((s) => ({
      sources: s.sources.map((src) =>
        src.key === key && src.accessible
          ? { ...src, connected: !src.connected }
          : src,
      ),
    })),
  openConnect: () => set({ connectOpen: true, menu: null }),
  closeConnect: () => set({ connectOpen: false }),

  showToast: (msg) => {
    set({ toast: msg });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2800);
  },
  clearToast: () => set({ toast: null }),

  openConfigure: (configure) =>
    set({ configure, chips: [], configDraft: '' }),
  openConfigureFromTemplate: (tpl) =>
    set({
      configure: {
        name: tpl.name,
        type: tpl.type,
        sourceKey: tpl.sourceKey,
        sourceLabel: tpl.sourceLabel,
        templateId: tpl.id,
      },
      chips: [],
      configDraft: '',
    }),
  closeConfigure: () => set({ configure: null }),
  setConfigDraft: (configDraft) => set({ configDraft }),
  addChip: (text) => {
    const t = text.trim();
    if (!t) return;
    set((s) =>
      s.chips.includes(t)
        ? { configDraft: '' }
        : { chips: [...s.chips, t], configDraft: '' },
    );
  },
  removeChip: (index) =>
    set((s) => ({ chips: s.chips.filter((_, i) => i !== index) })),

  composerRequest: (brief) => {
    const s = get();
    const src = s.sources.find((x) => x.key === s.sourceKey);
    return {
      brief,
      type: s.output,
      sourceKey: src?.key,
      modelId: s.modelId,
      uploads: s.uploads,
      lang: s.lang,
    };
  },

  beginBuild: (req, name) =>
    set({
      pendingReq: req,
      configure: null,
      build: {
        active: true,
        pct: 0,
        name,
        stage: req.uploads && req.uploads.length
          ? 'Reading your files…'
          : 'Reading the brief…',
      },
    }),
  setBuildPct: (pct) => set((s) => (s.build ? { build: { ...s.build, pct } } : {})),
  setBuildStage: (label) => set((s) => (s.build ? { build: { ...s.build, stage: label } } : {})),
  endBuild: () => set({ build: null, pendingReq: null }),

  addArtifact: (a) => set((s) => ({ library: [a, ...s.library] })),
  artifactById: (id) => get().library.find((a) => a.id === id),
  addVersion: (artifactId, v) =>
    set((s) => ({
      library: s.library.map((a) =>
        a.id === artifactId
          ? { ...a, versions: [...a.versions, v], currentVersion: a.versions.length }
          : a,
      ),
    })),
  setCurrentVersion: (artifactId, index) =>
    set((s) => ({
      library: s.library.map((a) =>
        a.id === artifactId
          ? { ...a, currentVersion: Math.max(0, Math.min(index, a.versions.length - 1)) }
          : a,
      ),
    })),
  setAwaiting: (id, awaiting, plan) =>
    set((s) => ({
      awaiting: { ...s.awaiting, [id]: awaiting },
      pendingPlan: { ...s.pendingPlan, [id]: plan ?? { steps: [] } },
    })),
    }),
    {
      name: 'atlas-store',
      // Only persist durable data — not transient UI/build state.
      partialize: (s) => ({ library: s.library, lang: s.lang, awaiting: s.awaiting, pendingPlan: s.pendingPlan, agentMode: s.agentMode }),
    },
  ),
);
