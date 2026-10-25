import { useState, type ReactNode } from 'react';
import type { StaffState } from '../../../shared/contracts';
import { usePolling } from '../../lib/usePolling';
import { send } from '../../lib/api';
import { useIdentity } from '../../app/Session';
import { Feedback } from '../../components/ui/Feedback';
import { QueueList } from './QueueList';
import { StudentDetail } from './StudentDetail';
import { ClassroomOverview } from './ClassroomOverview';
export function Staff({
  publicationId,
  renderAssistant,
}: {
  publicationId: string;
  renderAssistant: (options: { enabled: boolean; studentId?: string }) => ReactNode;
}) {
  const actor = useIdentity();
  const {
    data,
    error: loadError,
    refresh,
  } = usePolling<StaffState>(`/publications/${publicationId}/staff`);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function act(id: string, action: string) {
    setBusy(true);
    setError('');
    try {
      await send(`/publications/${publicationId}/queue/${id}/${action}`);
      await refresh();
      setStatus(
        action === 'approve'
          ? 'Checkoff approved. Resolve the request when your conversation is finished.'
          : `Request ${action === 'claim' ? 'claimed' : action === 'release' ? 'released' : 'resolved'}.`,
      );
    } catch (e) {
      setError((e as Error).message);
      await refresh();
    } finally {
      setBusy(false);
    }
  }
  if (!data)
    return (
      <>
        <Feedback error={loadError} />
        <p role="status">{loadError ? 'Retrying connection…' : 'Loading classroom…'}</p>
      </>
    );
  const student = data.students.find((s) => s.student.id === selected);
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>TA dashboard</h1>
          <p className="muted">{data.lab.title} · updates every 3 seconds</p>
        </div>
      </div>
      <Feedback error={loadError || error} status={status} />
      <div className="workspace staff">
        <div className="stack">
          <QueueList
            requests={data.requests}
            lab={data.lab}
            selectedStudent={selected}
            onSelect={setSelected}
            onAction={(id, action) => void act(id, action)}
            actorId={actor.id}
            busy={busy}
          />
          <ClassroomOverview data={data} onSelect={setSelected} />
        </div>
        <aside className="stack">
          {student ? (
            <>
              <StudentDetail data={data} student={student} />
              {renderAssistant({ studentId: student.student.id, enabled: data.lab.settings.taAI })}
            </>
          ) : (
            <section className="panel">
              <h2>Student detail</h2>
              <p className="muted">
                Select a student from the queue or classroom list to review saved work and
                instructor criteria.
              </p>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
