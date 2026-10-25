import type { DB } from '../../db/database.js';
import { publicLab, getPublication } from '../labs/repository.js';
import { progress } from '../progress/repository.js';
export function studentContext(db: DB, publicationId: string, studentId: string) {
  const work = progress(db, publicationId, studentId);
  return {
    lab: publicLab(db, publicationId),
    currentBlockId: work.currentBlockId,
    answers: work.answers,
    completions: work.completions,
  };
}
export function staffContext(db: DB, publicationId: string, studentId: string) {
  return {
    ...studentContext(db, publicationId, studentId),
    instructorContext: getPublication(db, publicationId).draft.blocks,
  };
}
