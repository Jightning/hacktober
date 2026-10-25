import type { PublicBlock, Settings } from '../../../shared/contracts';
// Teacher-only transport fields. Never pass this DTO to student APIs or AI context.
export type EditorBlock = PublicBlock & {
  instructorNotes?: string;
  rubric?: string;
  rule?:
    | { kind: 'exact'; expected: string }
    | { kind: 'numeric'; expected: number; tolerance: number; units: string };
};
export interface EditorDraft {
  title: string;
  blocks: EditorBlock[];
  settings: Settings;
}
