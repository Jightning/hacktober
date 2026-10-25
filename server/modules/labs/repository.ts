import type { DB } from '../../db/database.js';
import type { Draft } from './model.js';
import type { PublicBlock, PublicLab } from '../../../shared/contracts.js';
import { requireValue } from '../../http.js';
export function getPublication(
  db: DB,
  id: string,
): { draft: Draft; labId: string; publishedAt: string } {
  const row = db.prepare('SELECT * FROM publications WHERE id = ?').get(id) as
    { snapshot: string; lab_id: string; published_at: string } | undefined;
  requireValue(row, 404, 'Published lab not found.');
  return { draft: JSON.parse(row.snapshot), labId: row.lab_id, publishedAt: row.published_at };
}
export function publicBlock(b: Draft['blocks'][number]): PublicBlock {
  const base = { id: b.id, title: b.title };
  switch (b.type) {
    case 'markdown':
      return { ...base, type: b.type, text: b.text };
    case 'code':
      return { ...base, type: b.type, code: b.code, language: b.language };
    case 'image':
      return { ...base, type: b.type, url: b.url, alt: b.alt };
    case 'answer':
      return { ...base, type: b.type, input: b.input, units: b.units };
    case 'checkpoint':
      return {
        ...base,
        type: b.type,
        mode: b.mode,
        required: b.required,
        answerIds: [...b.answerIds],
      };
  }
}
export function publicLab(db: DB, id: string): PublicLab {
  const { draft, labId, publishedAt } = getPublication(db, id);
  return {
    id,
    labId,
    title: draft.title,
    blocks: draft.blocks.map(publicBlock),
    settings: { ...draft.settings },
    publishedAt,
  };
}
