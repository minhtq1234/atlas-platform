import { z } from 'zod';

export const DashboardContent = z.object({
  kind: z.literal('Dashboard'),
  title: z.string(),
  subtitle: z.string(),
  tiles: z.array(z.object({ label: z.string(), value: z.string(), delta: z.string().optional() })).max(24),
  series: z.object({
    label: z.string(),
    bars: z.array(z.object({ label: z.string(), value: z.number() })).max(1000),
  }),
});
