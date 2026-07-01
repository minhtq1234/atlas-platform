# Authoring an Artifact Pack

A pack is a self-contained artifact type that plugs into the Platform via the
`ArtifactTypeModule` contract. You edit **only your type's files** — never the shared
engine (registries, pipeline). This guide shows how to deepen an existing pack and how
a new type would be added.

## What you own (per type `<T>`)
- `services/bff/src/artifacts/<t>/{schema,prompt,archetypes,index}.ts` — the module.
- `apps/web/src/artifacts/renderers/<T>View.tsx` — the renderer.
- `services/artifacts/app/<t>_builder.py` (Office types) — the export.
- Exemplars — curated gold docs (committed safe seeds under
  `services/artifacts/seeds/exemplars/<tag>/`, real docs in the gitignored `exemplars/`).
- Contract-conformance is enforced by `services/bff/src/artifacts/registry.test.ts`.

## The module (skeleton to copy)
`schema.ts` — the zod content shape (a raw `ZodObject` with a `kind` literal):
```ts
import { z } from 'zod';
export const TContent = z.object({
  kind: z.literal('<T>'),
  // …type-specific fields…
});
```
`prompt.ts` — the JSON shape hint + optional archetype steering:
```ts
import type { Archetype } from '../module';
export const shapeHint = `{"kind":"<T>", …}`;
export function guidance(arch?: Archetype): string {
  if (!arch || !arch.sections.length) return '';
  return `Use these sections in order: ${arch.sections.join('; ')}.\n${arch.guidance}`;
}
// thin types with no archetypes: `export const guidance = (): string => '';`
```
`archetypes.ts` — team-owned archetype data (`[]` if none):
```ts
import type { Archetype } from '../module';
export const archetypes: Archetype[] = [
  // { id: 'brd', label: 'BRD', aliases: ['brd','requirements'], sections: [...], guidance: '...' },
];
```
`index.ts` — assemble the module:
```ts
import type { ArtifactTypeModule } from '../module';
import { TContent } from './schema';
import { shapeHint, guidance } from './prompt';
import { archetypes } from './archetypes';
export const tModule: ArtifactTypeModule = {
  type: '<T>', schema: TContent, shapeHint, archetypes, exemplarKey: '<t>', guidance,
};
```

## Exemplars (few-shot quality lift)
1. Drop a gold file under `exemplars/<tag>/` at the repo root (gitignored — for real
   sourced docs), where `<tag>` is your archetype id (e.g. `brd`) or your type key
   (e.g. `doc`). Safe generic seeds that ship with the repo go under
   `services/artifacts/seeds/exemplars/<tag>/`.
2. Ingest: `cd services/artifacts && . .venv/bin/activate && python -m app.ingest_exemplars`.
3. At generation, `getExemplar(type, archetypeId)` prefers the archetype tag, then the
   type key, and injects a capped `<exemplar>` reference block. No exemplar → no change.

## Deepening a pack (typical work)
- Add archetypes (named `sections` + `guidance`) in `archetypes.ts`.
- Enrich `schema.ts` + `shapeHint` + the renderer + the export **together** (a chat edit
  that "does nothing" usually means the schema can't represent the request).
- Curate exemplars for each archetype.
- Run the three suites; `registry.test.ts` proves your module still conforms.

## Adding a brand-new type (rare — v1 ships five)
Besides the module folder, touch: the `ArtifactContent` union list + `MODULES` entry in
`services/bff/src/artifacts/registry.ts`; the `ArtifactType` enum in
`services/bff/src/types.ts` and `apps/web/src/types.ts` (and the `z_ArtifactType` alias
in `services/bff/src/skills/prompts.ts`); a `<T>View` + the web `renderers/registry.tsx`
switch; and `EXPORTERS` in `services/artifacts/app/exports/registry.py` if it exports to
Office. The registry test's "parses every kind" check guards the union/MODULES pairing.
