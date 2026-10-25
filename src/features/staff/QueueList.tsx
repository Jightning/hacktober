import { useState } from 'react';
import './staff.css';
import type { PublicLab, QueueRequest } from '../../../shared/contracts';
export function QueueList({
  requests,
  lab,
  selectedStudent,
  onSelect,
  onAction,
  actorId,
  busy,
}: {
  requests: QueueRequest[];
  lab: PublicLab;
  selectedStudent: string;
  onSelect: (id: string) => void;
  onAction: (id: string, action: string) => void;
  actorId: string;
  busy: boolean;
}) {
  const [filter, setFilter] = useState<'all' | QueueRequest['type']>('all');
  const visible = requests.filter((r) => filter === 'all' || r.type === filter);
  return (
    <section className="panel stack">
      <h2>
        TA queue <span className="tag">{requests.length} active</span>
      </h2>
      <div className="row staff-filters" role="group" aria-label="Filter requests">
        {(['all', 'help', 'checkoff'] as const).map((type) => (
          <button key={type} aria-pressed={filter === type} onClick={() => setFilter(type)}>
            {type === 'all' ? 'All' : type === 'help' ? 'Help' : 'Checkoff'}
          </button>
        ))}
      </div>
      {requests.length > 0 && visible.length === 0 && (
        <p role="status">No {filter} requests. Choose All to see other active requests.</p>
      )}
      {requests.length === 0 && (
        <p className="muted">
          No active requests. Select a student from classroom progress to review their work.
        </p>
      )}
      {visible.map((r) => (
        <article
          className={`queue-item ${selectedStudent === r.studentId ? 'selected' : ''}`}
          key={r.id}
        >
          <div className="row between">
            <button className="text-button" onClick={() => onSelect(r.studentId)}>
              {r.studentName}
            </button>
            <span className="tag">
              {r.type}
              {r.demo ? ' · Demo' : ''}
            </span>
          </div>
          <p>{lab.blocks.find((b) => b.id === r.blockId)?.title}</p>
          <p>{r.description}</p>
          <p className="muted">
            {r.state}, {Math.max(0, Math.floor((Date.now() - Date.parse(r.createdAt)) / 60000))} min
            since arrival
            {r.claimedBy === actorId
              ? ', claimed by you'
              : r.claimedBy
                ? ', claimed by another TA'
                : ''}
          </p>
          <div className="row">
            {r.state === 'waiting' ? (
              <button
                disabled={busy}
                onClick={() => {
                  onSelect(r.studentId);
                  onAction(r.id, 'claim');
                }}
              >
                Claim request
              </button>
            ) : (
              r.claimedBy === actorId && (
                <>
                  {r.type === 'checkoff' && (
                    <button
                      className="primary"
                      disabled={busy}
                      onClick={() => onAction(r.id, 'approve')}
                    >
                      Approve checkoff
                    </button>
                  )}
                  <button disabled={busy} onClick={() => onAction(r.id, 'resolve')}>
                    Resolve
                  </button>
                  <button disabled={busy} onClick={() => onAction(r.id, 'release')}>
                    Release
                  </button>
                </>
              )
            )}
          </div>
        </article>
      ))}
    </section>
  );
}
