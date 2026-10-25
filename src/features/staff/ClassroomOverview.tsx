import { currentCheckpoint } from './progressSummary';
import type { StaffState } from '../../../shared/contracts';
export function ClassroomOverview({
  data,
  onSelect,
}: {
  data: StaffState;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="panel stack">
      <h2>Classroom progress</h2>
      <p>
        <strong>
          {data.stats.completed} of {data.stats.total}
        </strong>{' '}
        students have verified all required checkpoints.
      </p>
      <div className="stack">
        {data.stats.checkpoints.map((c) => (
          <div key={c.id}>
            <div className="row between">
              <span>{c.title}</span>
              <span>
                {c.verified}/{c.total} verified, {c.total - c.verified} remaining
              </span>
            </div>
            <progress
              aria-label={`${c.title} verified students`}
              value={c.verified}
              max={c.total || 1}
            />
          </div>
        ))}
      </div>
      <section>
        <h3>Students ({data.students.length})</h3>
        <ul className="student-list">
          {data.students.map((s) => (
            <li key={s.student.id}>
              <button onClick={() => onSelect(s.student.id)}>{s.student.name}</button>
              <div className="student-activity">
                <span>
                  Viewing:{' '}
                  {data.lab.blocks.find((block) => block.id === s.currentBlockId)?.title ||
                    'Not yet viewed'}
                </span>
                <span>Checkpoint: {currentCheckpoint(data.lab, s)?.title || 'All verified'}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </section>
  );
}
