import { useEffect, useState, useCallback } from 'react';
import type { Identity, PublicationLink } from '../../shared/contracts';
import { api, send } from '../lib/api';
import { SessionContext } from './Session';
import { Entry } from './Entry';
import { Authoring } from '../features/authoring/Authoring';
import { Student } from '../features/student/Student';
import { Assistant } from '../features/assistant/Assistant';
import { Staff } from '../features/staff/Staff';
import { Workspace } from '../components/ui/Workspace';
import { Feedback } from '../components/ui/Feedback';
export function App() {
  const invitation = window.location.pathname.match(/^\/lab\/([^/]+)\/?$/)?.[1] || null;
  const [user, setUser] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [area, setArea] = useState<'authoring' | 'staff'>('authoring');
  const [publications, setPublications] = useState<PublicationLink[]>([]);
  const [selected, setSelected] = useState(invitation || '');
  const [mock, setMock] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const reportDirty = useCallback((value: boolean) => setDirty(value), []);
  function canLeave() {
    return !dirty || window.confirm('Leave without saving your changes?');
  }
  async function loadPublications() {
    const list = await api<PublicationLink[]>('/publications');
    setPublications(list);
    setSelected((old) => (list.some((p) => p.id === old) ? old : list[0]?.id || ''));
  }
  useEffect(() => {
    api<Identity | null>('/session')
      .then(setUser)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    api<{ mockAI: boolean }>('/health')
      .then((r) => setMock(r.mockAI))
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (user) {
      setArea(user.role === 'teacher' ? 'authoring' : 'staff');
      void loadPublications().catch((e) => setError(e.message));
    }
  }, [user]);
  const missingEnrollment =
    user?.role === 'student' && invitation && !publications.some((p) => p.id === invitation);
  return (
    <>
      <header className="app-header">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            if (!canLeave()) e.preventDefault();
          }}
        >
          LabMate
        </a>
        <span className="muted">Lab workspace</span>
        {mock && <span className="tag">AI mock mode</span>}
        {user && (
          <div className="session">
            <span>
              {user.name} · {user.role}
              {user.demo ? ' · demo' : ''}
            </span>
            <button
              onClick={async () => {
                if (!canLeave()) return;
                try {
                  await send('/session/logout');
                  setDirty(false);
                  setUser(null);
                  setLibraryOpen(false);
                  setPublications([]);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Sign out
            </button>
          </div>
        )}
      </header>
      <Feedback error={error} />
      {loading ? (
        <main>
          <p role="status">Loading session…</p>
        </main>
      ) : !user ? (
        <Entry publicationId={invitation} onSession={setUser} />
      ) : (
        <SessionContext value={user}>
          {missingEnrollment ? (
            <Entry
              publicationId={invitation}
              onSession={(u) => {
                setUser(u);
                void loadPublications();
              }}
            />
          ) : (
            <main>
              {user.role === 'teacher' && (
                <nav className="tabs" aria-label="Workspace">
                  {user.role === 'teacher' && (
                    <button
                      aria-current={area === 'authoring' ? 'page' : undefined}
                      onClick={() => {
                        if (area !== 'authoring' && canLeave()) {
                          setDirty(false);
                          setArea('authoring');
                        }
                      }}
                    >
                      Author
                    </button>
                  )}
                  <button
                    aria-current={area === 'staff' ? 'page' : undefined}
                    onClick={() => {
                      if (area !== 'staff' && canLeave()) {
                        setDirty(false);
                        setArea('staff');
                      }
                    }}
                  >
                    Classroom
                  </button>
                </nav>
              )}
              {user.role === 'teacher' && area === 'authoring' ? (
                <Authoring
                  onDirtyChange={reportDirty}
                  publicationChanged={async (id) => {
                    await loadPublications();
                    setSelected(id);
                  }}
                />
              ) : (
                <>
                  <label className="publication-select">
                    Lab
                    <select
                      value={selected}
                      onChange={(e) => {
                        if (canLeave()) {
                          setDirty(false);
                          setSelected(e.target.value);
                          setLibraryOpen(false);
                        }
                      }}
                    >
                      {publications.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.title} · {new Date(p.publishedAt).toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selected ? (
                    user.role === 'student' ? (
                      <>
                        {libraryOpen && (
                          <Workspace
                            navigation={
                              <nav className="workspace-nav" aria-label="Student pages">
                                <button aria-current="page">My labs</button>
                                <button onClick={() => setLibraryOpen(false)}>Back to lab</button>
                              </nav>
                            }
                          >
                            <div className="page-heading">
                              <h1>My labs</h1>
                            </div>
                            <div className="stack">
                              {publications.map((lab) => (
                                <div className="panel row between" key={lab.id}>
                                  <div>
                                    <h2>{lab.title}</h2>
                                    <small>{new Date(lab.publishedAt).toLocaleString()}</small>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (lab.id === selected || canLeave()) {
                                        if (lab.id !== selected) setDirty(false);
                                        setSelected(lab.id);
                                        setLibraryOpen(false);
                                      }
                                    }}
                                  >
                                    Open lab
                                  </button>
                                </div>
                              ))}
                            </div>
                          </Workspace>
                        )}
                        <div hidden={libraryOpen}>
                          <Student
                            onOpenLabs={() => setLibraryOpen(true)}
                            onDirtyChange={reportDirty}
                            key={selected}
                            publicationId={selected}
                            renderAssistant={(options) => (
                              <Assistant
                                key={options.studentId || selected}
                                publicationId={selected}
                                {...options}
                              />
                            )}
                          />
                        </div>
                      </>
                    ) : (
                      <Staff
                        key={selected}
                        publicationId={selected}
                        renderAssistant={(options) => (
                          <Assistant
                            key={options.studentId || selected}
                            publicationId={selected}
                            {...options}
                          />
                        )}
                      />
                    )
                  ) : (
                    <p className="panel">
                      No published sessions yet.{' '}
                      {user.role === 'teacher'
                        ? 'Publish a lab in the editor.'
                        : 'Ask your teacher for a session link or assignment.'}
                    </p>
                  )}
                </>
              )}
            </main>
          )}
        </SessionContext>
      )}
    </>
  );
}
