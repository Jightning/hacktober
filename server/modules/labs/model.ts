import { z } from 'zod';
import type { PublicBlock, Settings } from '../../../shared/contracts.js';
export type Rule =
  | { kind: 'exact'; expected: string }
  | { kind: 'numeric'; expected: number; tolerance: number; units: string };
export type PrivateBlock = PublicBlock & { instructorNotes?: string; rule?: Rule; rubric?: string };
export interface Draft {
  title: string;
  blocks: PrivateBlock[];
  settings: Settings;
}
const base = {
  id: z.string().min(1).max(100),
  title: z.string().min(1).max(200),
  instructorNotes: z.string().max(4000).optional(),
};
const rule = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('exact'), expected: z.string().min(1).max(2000) }),
  z.object({
    kind: z.literal('numeric'),
    expected: z.number().finite(),
    tolerance: z.number().min(0).finite(),
    units: z.string().min(1).max(50),
  }),
]);
const block = z.discriminatedUnion('type', [
  z.object({ ...base, type: z.literal('markdown'), text: z.string().max(20000) }),
  z.object({
    ...base,
    type: z.literal('code'),
    code: z.string().max(20000),
    language: z.string().max(40),
  }),
  z.object({
    ...base,
    type: z.literal('image'),
    url: z.url().refine((s) => /^https?:\/\//.test(s)),
    alt: z.string().trim().min(1).max(500),
  }),
  z.object({
    ...base,
    type: z.literal('answer'),
    input: z.enum(['text', 'number']),
    units: z.string().max(50),
  }),
  z.object({
    ...base,
    type: z.literal('checkpoint'),
    mode: z.enum(['automatic', 'ta']),
    answerIds: z.array(z.string()).min(1).max(50),
    required: z.boolean(),
    rule: rule.optional(),
    rubric: z.string().max(4000).optional(),
  }),
]);
export const draftSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    blocks: z.array(block).min(1).max(100),
    settings: z.object({
      studentAI: z.boolean(),
      hintPolicy: z.enum(['conceptual', 'step']),
      taAI: z.boolean(),
      opensAt: z.iso.datetime(),
      closesAt: z.iso.datetime(),
    }),
  })
  .superRefine((draft, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    if (new Set(draft.blocks.map((b) => b.id)).size !== draft.blocks.length)
      issue('Duplicate block IDs');
    if (draft.settings.opensAt >= draft.settings.closesAt)
      issue('Session must close after opening');
    for (const b of draft.blocks)
      if (b.type === 'checkpoint') {
        if (b.answerIds.some((id) => !draft.blocks.some((a) => a.id === id && a.type === 'answer')))
          issue('Unknown answer reference');
        if (b.mode === 'automatic' && (!b.rule || b.answerIds.length !== 1))
          issue('Automatic checks need one answer and a rule');
        if (b.mode === 'ta' && !b.rubric?.trim()) issue('TA checkpoints need a private rubric');
        if (b.rule?.kind === 'numeric' && b.mode === 'automatic') {
          const a = draft.blocks.find((a) => a.id === b.answerIds[0]);
          if (a?.type !== 'answer' || a.input !== 'number' || a.units !== b.rule.units)
            issue('Numeric rule units must match numeric answer units');
        }
      }
  });
