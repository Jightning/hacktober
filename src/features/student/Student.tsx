import { useEffect, useState, type ReactNode } from 'react';
import type { StudentState } from '../../../shared/contracts';
import { usePolling } from '../../lib/usePolling';
import { send } from '../../lib/api';
import { PublicBlockView } from '../../components/lab-blocks/PublicBlockView';
import { Feedback } from '../../components/ui/Feedback';
import { AnswerInput } from './AnswerInput';
import { QueueHelp } from './QueueHelp';
import { Workspace } from '../../components/ui/Workspace';
import './student.css';
import { useCurrentStep } from './useCurrentStep';
export function Student({
  publicationId,
  renderAssistant,
  onDirtyChange,
  onOpenLabs,
  active = true,
}: {
  publicationId: string;
  active?: boolean;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenLabs?: () => void;
  renderAssistant: (options: { enabled: boolean; studentId?: string }) => ReactNode;
}) {
  const {
    data,
    error: loadError,
    refresh,
  } = usePolling<StudentState>(`/publications/${publicationId}/student`);
  const [page, setPage] = useState<'notebook' | 'progress' | 'help'>('notebook');
  const [dirtyAnswers, setDirtyAnswers] = useState<Record<string, boolean>>({});
  const dirty = Object.values(dirtyAnswers).some(Boolean);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', guard);
    return () => window.removeEventListener('beforeunload', guard);
  }, [dirty]);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState('');
  const { visit, focusBlock, blurBlock } = useCurrentStep({
    publicationId,
    labId: data?.lab.id,
    enabled: active && page === 'notebook',
    onError: setError,
  });
  async function check(blockId: string) {
    setChecking(blockId);
    setError('');
    try {
      const result = await send<{ feedback: string }>(
        `/publications/${publicationId}/checks/${blockId}`,
      );
      setFeedback((old) => ({ ...old, [blockId]: result.feedback }));
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setChecking('');
    }
  }
  if (!data)
    return (
      <>
        <Feedback error={loadError} />
        <p role="status">{loadError ? 'Retrying connection…' : 'Loading lab…'}</p>
      </>
    );
  const { lab, progress } = data;
  const required = lab.blocks.filter((b) => b.type === 'checkpoint' && b.required);
  const done = required.filter((b) => progress.completions.some((c) => c.blockId === b.id)).length;
  return (
    <Workspace
      navigation={
        <>
          <nav className="workspace-nav" aria-label="Student pages">
            {onOpenLabs && <button onClick={onOpenLabs}>My labs</button>}
            {(
              [
                ['notebook', 'Notebook'],
                ['progress', 'Progress'],
                ['help', 'Queue'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                aria-current={page === id ? 'page' : undefined}
                onClick={() => setPage(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          <nav className="workspace-outline" aria-label="Notebook outline">
            <h2>Outline</h2>
            {lab.blocks.map((block, index) => (
              <a
                key={block.id}
                href={`#block-${block.id}`}
                onClick={() => {
                  setPage('notebook');
                  void visit(block.id);
                  requestAnimationFrame(() =>
                    document
                      .getElementById(`block-${block.id}`)
                      ?.scrollIntoView({ block: 'start' }),
                  );
                }}
              >
                {index + 1}. {block.title.replace(/^\d+\.\s*/, '')}
              </a>
            ))}
          </nav>
        </>
      }
      assistant={renderAssistant({ enabled: lab.settings.studentAI })}
    >
      <div className="page-heading">
        <div>
          <h1>{lab.title}</h1>
          <p className="muted">{progress.student.name}</p>
        </div>
        {dirty && (
          <span className="student-unsaved" role="status">
            Unsaved answers
          </span>
        )}
      </div>
      <Feedback error={loadError || error} />
      <section
        hidden={page !== 'notebook'}
        aria-label="Notebook"
        className="student-notebook stack"
      >
        {lab.blocks.map((b, index) => {
          const completion = progress.completions.find((c) => c.blockId === b.id);
          return (
            <section
              id={`block-${b.id}`}
              className="panel stack student-cell"
              key={b.id}
              onFocusCapture={() => focusBlock(b.id)}
              onBlurCapture={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  blurBlock();
                }
              }}
            >
              <div className="row between">
                <h2>
                  <span className="student-cell-number">{index + 1}</span>
                  {b.title.replace(/^\d+\.\s*/, '')}
                </h2>
              </div>
              {b.type === 'answer' ? (
                <AnswerInput
                  publicationId={publicationId}
                  block={b}
                  saved={progress.answers.find((a) => a.blockId === b.id)}
                  onSaved={refresh}
                  onDirtyChange={(answerDirty) =>
                    setDirtyAnswers((old) =>
                      old[b.id] === answerDirty ? old : { ...old, [b.id]: answerDirty },
                    )
                  }
                />
              ) : (
                <PublicBlockView block={b} />
              )}
              {b.type === 'checkpoint' && (
                <>
                  <p className={completion ? 'verified' : 'muted'}>
                    {completion
                      ? `Verified by ${completion.method === 'ta' ? 'TA' : 'automatic check'}`
                      : 'Not verified'}
                  </p>
                  {b.mode === 'automatic' ? (
                    <button disabled={Boolean(checking)} onClick={() => void check(b.id)}>
                      {checking === b.id ? 'Checking…' : 'Check my answer'}
                    </button>
                  ) : (
                    <p className="muted">
                      Use “Queue” and choose “Checkpoint checkoff” when ready.
                    </p>
                  )}
                  <Feedback status={feedback[b.id]} />
                </>
              )}
            </section>
          );
        })}
      </section>
      <section
        hidden={page !== 'progress'}
        aria-label="Progress"
        className="stack student-progress"
      >
        <h2>Progress</h2>
        <p>
          <strong>
            {done} / {required.length}
          </strong>{' '}
          required checkpoints verified
        </p>
        <progress
          aria-label="Required checkpoint completion"
          value={done}
          max={required.length || 1}
        />
        <p className="muted">Saved answers and visited steps do not verify checkpoints.</p>
        {lab.blocks.filter((block) => block.type === 'checkpoint').length === 0 && (
          <p>No checkpoints in this lab.</p>
        )}
        {lab.blocks
          .filter((block) => block.type === 'checkpoint')
          .map((block) => {
            const completion = progress.completions.find((item) => item.blockId === block.id);
            return (
              <div className="panel row between" key={block.id}>
                <div>
                  <strong>{block.title}</strong>
                  <p className="muted">{block.required ? 'Required' : 'Optional'}</p>
                </div>
                <span className={completion ? 'verified' : 'muted'}>
                  {completion
                    ? `Verified by ${completion.method === 'ta' ? 'TA' : 'automatic check'}`
                    : 'Not verified'}
                </span>
              </div>
            );
          })}
      </section>
      <section hidden={page !== 'help'} aria-label="Queue">
        <QueueHelp
          lab={lab}
          requests={progress.requests}
          currentBlockId={progress.currentBlockId}
          onChange={refresh}
        />
      </section>
    </Workspace>
  );
}
