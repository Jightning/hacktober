import { useState, type ReactNode } from 'react';
import type { StudentState } from '../../../shared/contracts';
import { usePolling } from '../../lib/usePolling';
import { send } from '../../lib/api';
import { PublicBlockView } from '../../components/lab-blocks/PublicBlockView';
import { Feedback } from '../../components/ui/Feedback';
import { AnswerInput } from './AnswerInput';
import { QueueHelp } from './QueueHelp';
export function Student({
  publicationId,
  renderAssistant,
}: {
  publicationId: string;
  renderAssistant: (options: { enabled: boolean; studentId?: string }) => ReactNode;
}) {
  const {
    data,
    error: loadError,
    refresh,
  } = usePolling<StudentState>(`/publications/${publicationId}/student`);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState<Record<string, string>>({});
  const [checking, setChecking] = useState('');
  async function visit(blockId: string) {
    try {
      await send(`/publications/${publicationId}/visit`, { blockId });
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
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
    <>
      <div className="page-heading">
        <div>
          <h1>{lab.title}</h1>
          <p className="muted">
            {progress.student.name}
            {progress.student.demo ? ' · seeded demo student' : ''}
          </p>
        </div>
        <div>
          <strong>
            {done} / {required.length} required checkpoints verified
          </strong>
          <progress aria-label="Lab completion" value={done} max={required.length || 1} />
        </div>
      </div>
      <Feedback error={loadError || error} />
      <div className="workspace">
        <section className="stack">
          <nav className="step-nav" aria-label="Lab steps">
            {lab.blocks.map((b, i) => (
              <a key={b.id} href={`#block-${b.id}`} onClick={() => void visit(b.id)}>
                {i + 1}. {b.title.replace(/^\d+\.\s*/, '')}
              </a>
            ))}
          </nav>
          {lab.blocks.map((b) => {
            const completion = progress.completions.find((c) => c.blockId === b.id);
            return (
              <section
                id={`block-${b.id}`}
                className="panel stack"
                key={b.id}
                onFocusCapture={() => {
                  if (progress.currentBlockId !== b.id) void visit(b.id);
                }}
              >
                <div className="row between">
                  <h2>{b.title}</h2>
                  {b.type !== 'answer' && (
                    <button className="quiet" onClick={() => void visit(b.id)}>
                      {progress.currentBlockId === b.id ? 'Current step' : 'Work here'}
                    </button>
                  )}
                </div>
                {b.type === 'answer' ? (
                  <AnswerInput
                    publicationId={publicationId}
                    block={b}
                    saved={progress.answers.find((a) => a.blockId === b.id)}
                    onSaved={refresh}
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
                        Use “Ask a TA” and choose “Checkpoint checkoff” when ready.
                      </p>
                    )}
                    <Feedback status={feedback[b.id]} />
                  </>
                )}
              </section>
            );
          })}
        </section>
        <aside className="stack">
          <QueueHelp
            lab={lab}
            requests={progress.requests}
            currentBlockId={progress.currentBlockId}
            onChange={refresh}
          />
          {renderAssistant({ enabled: lab.settings.studentAI })}
        </aside>
      </div>
    </>
  );
}
