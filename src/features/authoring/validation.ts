import type { EditorDraft } from './types';

export interface DraftIssue {
  page: 'Notebook' | 'Settings';
  blockId?: string;
  field: string;
  message: string;
}

// Presentation-only validation. The server's private Zod schema remains authoritative.
export function validateDraft(draft: EditorDraft, publish = false): DraftIssue[] {
  const issues: DraftIssue[] = [];
  const add = (field: string, message: string, blockId?: string) =>
    issues.push({
      page: field.startsWith('settings.') ? 'Settings' : 'Notebook',
      field,
      message,
      blockId,
    });
  if (!draft.title.trim() || draft.title.length > 200)
    add('title', 'Enter a lab title of 1–200 characters.');
  if (!draft.blocks.length || draft.blocks.length > 100)
    add('title', 'Include between 1 and 100 blocks.');
  if (!(Date.parse(draft.settings.opensAt) < Date.parse(draft.settings.closesAt)))
    add('settings.closesAt', 'Session closing time must be after opening time.');
  for (const b of draft.blocks) {
    const error = (field: string, message: string) =>
      add(field, `${b.title || 'Untitled block'}: ${message}`, b.id);
    if (!b.title.trim() || b.title.length > 200)
      error('title', 'enter a block title of 1–200 characters.');
    if ((b.instructorNotes?.length || 0) > 4000)
      error('instructorNotes', 'limit notes to 4000 characters.');
    if (b.type === 'markdown' && b.text.length > 20000)
      error('text', 'limit content to 20000 characters.');
    if (b.type === 'code' && b.code.length > 20000)
      error('code', 'limit code to 20000 characters.');
    if (b.type === 'image') {
      try {
        const url = new URL(b.url);
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
      } catch {
        error('url', 'enter a valid HTTP or HTTPS image URL.');
      }
      if (!b.alt.trim() || b.alt.length > 500)
        error('alt', 'enter alternative text of 1–500 characters.');
    }
    if (b.type === 'answer' && b.units.length > 50) error('units', 'limit units to 50 characters.');
    if (b.type !== 'checkpoint') continue;
    if (
      !b.answerIds.length ||
      b.answerIds.some((id) => !draft.blocks.some((a) => a.id === id && a.type === 'answer'))
    )
      error('answerIds', 'select existing answer blocks.');
    if (b.mode === 'ta' && (!b.rubric?.trim() || b.rubric.length > 4000))
      error('rubric', 'enter a private rubric of 1–4000 characters.');
    if (b.mode === 'automatic') {
      if (b.answerIds.length !== 1)
        error('answerIds', 'select exactly one answer for automatic validation.');
      if (!b.rule) error('rule', 'choose an automatic rule.');
      else if (b.rule.kind === 'exact') {
        if (!b.rule.expected.trim() || b.rule.expected.length > 2000)
          error('expected', 'enter an expected answer of 1–2000 characters.');
      } else {
        if (!Number.isFinite(b.rule.expected)) error('expected', 'enter a finite expected number.');
        if (!Number.isFinite(b.rule.tolerance) || b.rule.tolerance < 0)
          error('tolerance', 'enter a nonnegative finite tolerance.');
        const answer = draft.blocks.find((a) => a.id === b.answerIds[0]);
        if (
          !b.rule.units ||
          b.rule.units.length > 50 ||
          answer?.type !== 'answer' ||
          answer.input !== 'number' ||
          answer.units !== b.rule.units
        )
          error('ruleUnits', 'required units must match the selected numeric answer’s units.');
      }
    }
  }
  if (publish && !draft.blocks.some((b) => b.type === 'checkpoint' && b.required))
    add('title', 'Add at least one required checkpoint before publishing.');
  return issues;
}
