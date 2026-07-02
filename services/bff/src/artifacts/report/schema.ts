import { z } from 'zod';

export const ReportContent = z.object({
  kind: z.literal('Report'),
  eyebrow: z.string(),
  title: z.string(),
  asOf: z.string(),
  stats: z.array(z.object({ value: z.string(), label: z.string() })).max(24),
  paragraphs: z.array(z.string()).min(1).max(200),
});
