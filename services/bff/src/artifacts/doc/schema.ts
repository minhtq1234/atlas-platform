import { z } from 'zod';

export const Block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('paragraph'), text: z.string().max(4000) }),
  z.object({ type: z.literal('bullets'), items: z.array(z.string().max(600)).max(50) }),
  z.object({ type: z.literal('numbers'), items: z.array(z.string().max(600)).max(50) }),
  z.object({ type: z.literal('table'), columns: z.array(z.string().max(120)).min(1).max(8), rows: z.array(z.array(z.string().max(400)).max(8)).max(100) }),
  z.object({ type: z.literal('callout'), value: z.string().max(200), label: z.string().max(120) }),
  z.object({ type: z.literal('bars'), label: z.string().max(120).optional(), bars: z.array(z.object({ label: z.string(), value: z.number() })).max(50) }),
]);
export const Section = z.object({ heading: z.string().max(200), blocks: z.array(Block).max(40) });

export const DocContent = z.object({
  kind: z.literal('Doc'),
  eyebrow: z.string(),
  title: z.string(),
  meta: z.string(),
  paragraphs: z.array(z.string()).max(200).optional(),
  sections: z.array(Section).max(30).optional(),
  bars: z.array(z.object({ label: z.string(), value: z.number() })).max(50).optional(),
  barsLayout: z.enum(['vertical', 'horizontal']).optional(),
  callout: z.object({ value: z.string(), label: z.string() }).optional(),
});
