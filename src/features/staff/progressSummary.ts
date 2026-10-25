import type { PublicLab, StudentProgress } from '../../../shared/contracts';

export function currentCheckpoint(lab: PublicLab, student: StudentProgress) {
  const checkpoints = lab.blocks.filter((block) => block.type === 'checkpoint');
  const current = checkpoints.find((block) => block.id === student.currentBlockId);
  return (
    current ||
    checkpoints.find(
      (block) => !student.completions.some((completion) => completion.blockId === block.id),
    )
  );
}
