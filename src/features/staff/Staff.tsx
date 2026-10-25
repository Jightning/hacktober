import { useState, type ReactNode } from 'react';
import type { StaffState } from '../../../shared/contracts';
import { usePolling } from '../../lib/usePolling';
import { ApiError, send } from '../../lib/api';
import { useIdentity } from '../../app/Session';
import { Feedback } from '../../components/ui/Feedback';
import { Workspace } from '../../components/ui/Workspace';
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
  const [page, setPage] = useState<'Queue' | 'Classroom' | 'Review'>('Queue');
  function selectStudent(id: string) {
    setSelected(id);
    setPage('Review');
  }
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  async function act(id: string, action: string) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await send(`/publications/${publicationId}/queue/${id}/${action}`);
      await refresh();
      setStatus(
        action === 'approve'
          ? 'Checkoff approved. Resolve the request when your conversation is finished.'
          : `Request ${action === 'claim' ? 'claimed' : action === 'release' ? 'released' : 'resolved'}.`,
      );
    } catch (e) {
      setError(
        action === 'claim' && e instanceof ApiError && e.status === 409
          ? 'Another TA claimed this request, or it is no longer waiting. The queue has been refreshed; you can still review the selected student.'
          : (e as Error).message,
      );
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
    <Workspace
      navigation={
        <nav className="workspace-nav" aria-label="Staff pages">
          <span className="nav-caption">Classroom</span>
          {(['Queue', 'Classroom', 'Review'] as const).map((item) => (
            <button
              key={item}
              disabled={item === 'Review' && !student}
              aria-current={page === item ? 'page' : undefined}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      }
      assistantVisible={page === 'Review'}
      assistant={
        student
          ? renderAssistant({ studentId: student.student.id, enabled: data.lab.settings.taAI })
          : undefined
      }
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">{data.lab.title}</span>
          <h1>{page === 'Review' && student ? student.student.name : page}</h1>
        </div>
      </div>
      <Feedback error={loadError || error} status={status} />
      {page === 'Queue' && student && (
        <button onClick={() => setPage('Review')}>Review {student.student.name}</button>
      )}
      {page === 'Queue' && (
        <QueueList
          requests={data.requests}
          lab={data.lab}
          selectedStudent={selected}
          onSelect={selectStudent}
          onAction={(id, action) => void act(id, action)}
          actorId={actor.id}
          busy={busy}
        />
      )}
      {page === 'Classroom' && <ClassroomOverview data={data} onSelect={selectStudent} />}
      {page === 'Review' && student && (
        <div className="stack">
          <StudentDetail data={data} student={student} />
          <QueueList
            requests={data.requests.filter((r) => r.studentId === selected)}
            lab={data.lab}
            selectedStudent={selected}
            onSelect={selectStudent}
            onAction={(id, action) => void act(id, action)}
            actorId={actor.id}
            busy={busy}
          />
        </div>
      )}
    </Workspace>
  );
}
