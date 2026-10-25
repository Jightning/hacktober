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
      <p className="muted">
        Includes labeled seeded demo activity. Current step is a navigation observation, not
        evidence that a student is stuck.
      </p>
      <div className="stack">
        {data.stats.checkpoints.map((c) => (
          <div key={c.id}>
            <div className="row between">
              <span>{c.title}</span>
              <span>
                {c.verified}/{c.total} verified · {c.total - c.verified} remaining
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
      <details>
        <summary>All students ({data.students.length})</summary>
        <ul className="student-list">
          {data.students.map((s) => (
            <li key={s.student.id}>
              <button onClick={() => onSelect(s.student.id)}>
                {s.student.name}
                {s.student.demo ? ' · demo' : ''}
              </button>
              <span>{s.completions.length} checkpoints verified</span>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
