import type { ArtifactType, ModelOption, SourceOption } from '../types';

export interface Template {
  id: string;
  name: string;
  type: ArtifactType;
  sourceKey: string;
  sourceLabel: string;
}

/** Tab key used by the gallery filter. */
export type TabKey = 'all' | 'docs' | 'decks' | 'dashboards' | 'sheets' | 'reports';

export const TYPE_TO_TAB: Record<ArtifactType, Exclude<TabKey, 'all'>> = {
  Doc: 'docs',
  Deck: 'decks',
  Sheet: 'sheets',
  Dashboard: 'dashboards',
  Report: 'reports',
};

export const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'docs', label: 'Docs' },
  { key: 'decks', label: 'Decks' },
  { key: 'dashboards', label: 'Dashboards' },
  { key: 'sheets', label: 'Sheets' },
  { key: 'reports', label: 'Reports' },
];

export const MODELS: ModelOption[] = [
  { id: 'gn-llama3-70b', label: 'GreenNode Llama-3 70B' },
  { id: 'gn-qwen25-72b', label: 'GreenNode Qwen2.5 72B' },
  { id: 'gn-mistral-large', label: 'GreenNode Mistral Large' },
];

export const SOURCES: SourceOption[] = [
  {
    key: 'HRCore',
    label: 'HRCore · headcount view',
    desc: "Headcount, leave, onboarding · you're cleared for headcount view",
    connected: true,
    accessible: true,
  },
  {
    key: 'ATS',
    label: 'ATS · recruiting',
    desc: 'Recruiting pipeline, offers · full access',
    connected: true,
    accessible: true,
  },
  {
    key: 'Finance',
    label: 'Finance · comp',
    desc: 'Compensation & budget · not provisioned for you',
    connected: false,
    accessible: false,
  },
];

export const TEMPLATES: Template[] = [
  { id: 'headcount-memo', name: 'Headcount Memo', type: 'Doc', sourceKey: 'HRCore', sourceLabel: 'HRCore · headcount view' },
  { id: 'people-review', name: 'People Review', type: 'Deck', sourceKey: 'HRCore', sourceLabel: 'HRCore · headcount view' },
  { id: 'workforce-pulse', name: 'Workforce Pulse', type: 'Dashboard', sourceKey: 'HRCore', sourceLabel: 'HRCore + Finance' },
  { id: 'headcount-model', name: 'Headcount Model', type: 'Sheet', sourceKey: 'HRCore', sourceLabel: 'HRCore · headcount view' },
  { id: 'monthly-people-report', name: 'Monthly People Report', type: 'Report', sourceKey: 'HRCore', sourceLabel: 'HRCore + ATS' },
];
