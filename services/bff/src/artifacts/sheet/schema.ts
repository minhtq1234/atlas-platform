import { z } from 'zod';

export const SheetContent = z.object({
  kind: z.literal('Sheet'),
  title: z.string(),
  columns: z.array(z.string()).min(1).max(50),
  rows: z.array(z.array(z.union([z.string(), z.number()])).max(50)).max(5000),
});
