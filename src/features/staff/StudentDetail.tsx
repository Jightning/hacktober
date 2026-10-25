import { currentCheckpoint } from './progressSummary';
import type { StaffState, StudentProgress } from '../../../shared/contracts';
export function StudentDetail({ data, student }: { data: StaffState; student: StudentProgress }) {
  const checkpoint = currentCheckpoint(data.lab, student);
  return (
    <section className="panel stack">
      <h2>
        {student.student.name}
        {student.student.demo ? ' · Demo student' : ''}
      </h2>
      <p>
        Viewing:{' '}
        <strong>
          {data.lab.blocks.find((b) => b.id === student.currentBlockId)?.title || 'Not yet viewed'}
        </strong>
      </p>
      <p>
        Current checkpoint: <strong>{checkpoint?.title || 'All checkpoints verified'}</strong>
      </p>
      <h3>Submitted work</h3>
      {student.answers.length === 0 ? (
        <p className="muted">No answers submitted.</p>
      ) : (
        student.answers.map((a) => (
          <div className="submission" key={a.blockId}>
            <strong>{data.lab.blocks.find((b) => b.id === a.blockId)?.title}</strong>
            <p>
              {a.value} {a.units}
            </p>
            <small>Saved {new Date(a.submittedAt).toLocaleString()}</small>
          </div>
        ))
      )}
      <h3>Checkpoints</h3>
      {data.lab.blocks
        .filter((b) => b.type === 'checkpoint')
        .map((b) => (
          <div key={b.id}>
            <p>
              <strong>{b.title}</strong> ·{' '}
              {student.completions.some((c) => c.blockId === b.id) ? 'Verified' : 'Not verified'}
            </p>
            {b.type === 'checkpoint' && (
              <p className="muted">
                Reviews:{' '}
                {b.answerIds
                  .map((id) => data.lab.blocks.find((a) => a.id === id)?.title)
                  .join(', ')}
              </p>
            )}
            {b.type === 'checkpoint' &&
              b.answerIds.map((id) => {
                const answer = student.answers.find((a) => a.blockId === id);
                return (
                  <div className="submission" key={id}>
                    <strong>{data.lab.blocks.find((a) => a.id === id)?.title}</strong>
                    <p>{answer ? `${answer.value} ${answer.units}` : 'Not submitted'}</p>
                  </div>
                );
              })}
            {data.instructorContext[b.id] && (
              <div className="private-note">
                <strong>Instructor-only criteria</strong>
                <p>{data.instructorContext[b.id]}</p>
              </div>
            )}
          </div>
        ))}
      {Object.entries(data.instructorContext)
        .filter(
          ([id, text]) => text && data.lab.blocks.find((b) => b.id === id)?.type !== 'checkpoint',
        )
        .map(([id, text]) => (
          <div className="private-note" key={id}>
            <strong>{data.lab.blocks.find((b) => b.id === id)?.title}, Instructor notes</strong>
            <p>{text}</p>
          </div>
        ))}
    </section>
  );
}
