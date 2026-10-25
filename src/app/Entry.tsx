import { useEffect, useState } from 'react';
import type { Identity } from '../../shared/contracts';
import { api, send } from '../lib/api';
import { Feedback } from '../components/ui/Feedback';
export function Entry({
  publicationId,
  onSession,
}: {
  publicationId: string | null;
  onSession: (user: Identity) => void;
}) {
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [name, setName] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<Identity[]>('/demo-identities')
      .then(setIdentities)
      .catch((e) => setError(e.message));
    if (publicationId)
      api<{ title: string }>(`/invitations/${publicationId}`)
        .then((r) => setTitle(r.title))
        .catch((e) => setError(e.message));
  }, [publicationId]);
  async function enter(path: string, body: unknown) {
    setBusy(true);
    setError('');
    try {
      onSession(await send<Identity>(path, body));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="entry">
      <h1>{publicationId ? title || 'Join a lab' : 'Welcome to LabMate'}</h1>
      <p className="muted">A shared workspace for lab work, questions, and checkoffs.</p>
      <Feedback error={error} />
      {publicationId && (
        <form
          className="panel stack"
          onSubmit={(e) => {
            e.preventDefault();
            void enter('/join', { publicationId, name });
          }}
        >
          <h2>Join as a student</h2>
          <label>
            Your display name
            <input
              required
              maxLength={80}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </label>
          <button disabled={busy || !title} className="primary">
            {busy ? 'Joining…' : 'Open lab'}
          </button>
          <p className="muted">
            Your work is saved to this browser’s session. Keep this session to return to it.
          </p>
        </form>
      )}
      {identities.length > 0 && (
        <section className="panel stack">
          <h2>Development identity picker</h2>
          <p className="muted">Seeded demo accounts. This is not production sign-in.</p>
          <div className="identity-list">
            {identities.map((u) => (
              <button
                disabled={busy}
                key={u.id}
                onClick={() => void enter('/session/demo', { id: u.id })}
              >
                <strong>{u.name}</strong>
                <span>{u.role} · demo</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {!publicationId && (
        <p>
          Students can join using a link shared by their teacher.{' '}
          <a href="/lab/demo-publication">Open the seeded lab</a>.
        </p>
      )}
    </main>
  );
}
