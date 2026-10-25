import { useEffect, useState } from 'react';
import type { EditorBlock, EditorDraft } from './types';
import { api, send } from '../../lib/api';
import { Feedback } from '../../components/ui/Feedback';
import { PublicBlockView } from '../../components/lab-blocks/PublicBlockView';
import { NotebookEditor } from './NotebookEditor';
import { Workspace } from '../../components/ui/Workspace';
import { SettingsEditor } from './SettingsEditor';
export function Authoring({
  publicationChanged,
  onDirtyChange,
}: {
  publicationChanged: (id: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [labs, setLabs] = useState<{ id: string; title: string }[]>([]);
  const [id, setId] = useState('');
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [page, setPage] = useState<'Labs' | 'Notebook' | 'Preview' | 'Settings' | 'Publish'>(
    'Labs',
  );
  const [activeCell, setActiveCell] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadVersion, setLoadVersion] = useState(0);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState('');
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    api<{ id: string; title: string }[]>('/labs')
      .then((list) => {
        setLabs(list);
        setId(list[0]?.id || '');
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (page === 'Notebook' && activeCell) {
      document.getElementById(`cell-${activeCell}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [page, activeCell]);
  useEffect(() => {
    let cancelled = false;
    if (id) {
      setDraft(null);
      setDirty(false);
      setLink('');
      setError('');
      setStatus('');
      setActiveCell('');
      api<EditorDraft>(`/labs/${id}`)
        .then((value) => {
          if (!cancelled) setDraft(value);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    }
    return () => {
      cancelled = true;
    };
  }, [id, loadVersion]);
  function edit(next: EditorDraft) {
    setDraft(next);
    setDirty(true);
    setStatus('');
  }
  async function save(publish = false) {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await send(`/labs/${id}`, draft, 'PUT');
      setDirty(false);
      setLabs((old) => old.map((l) => (l.id === id ? { ...l, title: draft!.title } : l)));
      if (publish) {
        const pub = await send<{ id: string }>(`/labs/${id}/publish`);
        setLink(`${window.location.origin}/lab/${pub.id}`);
        await publicationChanged(pub.id);
        setStatus('Published a new snapshot. Existing student links keep their content.');
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (dirty && !window.confirm('Discard unsaved changes and create a new lab?')) return;
    setError('');
    setBusy(true);
    try {
      const result = await send<{ id: string }>('/labs', { title: 'Untitled lab' });
      setLabs((old) => [...old, { id: result.id, title: 'Untitled lab' }]);
      setId(result.id);
      setPage('Notebook');
      setStatus('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function add(type: EditorBlock['type']) {
    if (!draft) return;
    const base = { id: crypto.randomUUID(), title: `${type[0].toUpperCase()}${type.slice(1)}` };
    const block: EditorBlock =
      type === 'markdown'
        ? { ...base, type, text: '' }
        : type === 'code'
          ? { ...base, type, code: 'print("Hello, world!")', language: 'python' }
          : type === 'image'
            ? { ...base, type, url: '', alt: '' }
            : type === 'answer'
              ? { ...base, type, input: 'text', units: '' }
              : {
                  ...base,
                  type,
                  mode: 'ta',
                  answerIds: draft.blocks.filter((b) => b.type === 'answer').map((b) => b.id),
                  required: true,
                  rubric: '',
                };
    edit({ ...draft, blocks: [...draft.blocks, block] });
    setActiveCell(block.id);
  }
  function openLab(nextId: string) {
    if (nextId !== id && dirty && !window.confirm('Discard unsaved changes and open another lab?'))
      return;
    setId(nextId);
    setPage('Notebook');
  }
  return (
    <Workspace
      navigation={
        <nav className="workspace-nav" aria-label="Teacher pages">
          {(['Labs', 'Notebook', 'Preview', 'Settings', 'Publish'] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-current={page === item ? 'page' : undefined}
              disabled={busy || (item !== 'Labs' && !draft)}
              onClick={() => setPage(item)}
            >
              {item}
            </button>
          ))}
        </nav>
      }
      outline={
        draft &&
        page !== 'Labs' && (
          <nav className="workspace-outline" aria-label="Notebook outline">
            <h2>Outline</h2>
            {draft.blocks.length === 0 && <p className="muted">No cells yet.</p>}
            {draft.blocks.map((block, index) => (
              <button
                type="button"
                key={block.id}
                aria-current={
                  activeCell === block.id && page === 'Notebook' ? 'location' : undefined
                }
                onClick={() => {
                  setPage('Notebook');
                  setActiveCell(block.id);
                }}
              >
                {index + 1}. {block.title.replace(/^\d+\.\s*/, '') || 'Untitled cell'}
              </button>
            ))}
          </nav>
        )
      }
    >
      <section className="editor stack">
        <div className="page-heading">
          <div>
            <h1>{page === 'Labs' ? 'Labs' : draft?.title || 'Notebook'}</h1>
          </div>
          {page === 'Labs' && (
            <button className="primary" onClick={() => void create()} disabled={busy}>
              New lab
            </button>
          )}
        </div>
        <Feedback error={error} status={status} />
        {page === 'Labs' ? (
          <div className="stack">
            {labs.map((lab) => (
              <div className="panel row between" key={lab.id}>
                <div>
                  <h2>{lab.id === id && draft ? draft.title : lab.title}</h2>
                </div>
                <button onClick={() => openLab(lab.id)} disabled={busy}>
                  Open notebook
                </button>
              </div>
            ))}
            {labs.length === 0 && <p>{loading ? 'Loading labs…' : 'Create a lab to begin.'}</p>}
          </div>
        ) : !draft ? (
          <div className="stack">
            <p>{error ? 'Could not load this draft.' : 'Loading draft…'}</p>
            {error && (
              <button type="button" onClick={() => setLoadVersion((value) => value + 1)}>
                Retry
              </button>
            )}
          </div>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void save(page === 'Publish');
            }}
          >
            <fieldset className="form-body stack" disabled={busy}>
              {page === 'Notebook' && (
                <NotebookEditor
                  draft={draft}
                  edit={edit}
                  activeCell={activeCell}
                  setActiveCell={setActiveCell}
                />
              )}
              {page === 'Settings' && (
                <SettingsEditor
                  value={draft.settings}
                  onChange={(settings) => edit({ ...draft, settings })}
                />
              )}
              {page === 'Preview' && (
                <div className="stack">
                  <p className="notice">Student preview. Responses and checks are inactive.</p>
                  {draft.blocks.length === 0 && (
                    <p className="muted">Add cells in Notebook to preview your lab.</p>
                  )}
                  {draft.blocks.map((block) => (
                    <section className="panel notebook-cell" key={block.id}>
                      <h3>{block.title}</h3>
                      <PublicBlockView block={block} />
                    </section>
                  ))}
                </div>
              )}
              {page === 'Publish' && (
                <section className="panel stack">
                  <h2>Publish lab</h2>
                  <p>
                    Save this draft and publish a new snapshot. Existing student links keep their
                    content.
                  </p>
                  <button className="primary" type="submit">
                    {busy ? 'Publishing…' : 'Save & publish'}
                  </button>
                  {link && (
                    <div className="stack">
                      <label>
                        Published student link
                        <input readOnly value={link} />
                      </label>
                      <div className="row">
                        <button
                          type="button"
                          onClick={() =>
                            navigator.clipboard
                              .writeText(link)
                              .then(() => setStatus('Link copied.'))
                              .catch(() => setStatus('Select and copy the link above.'))
                          }
                        >
                          Copy link
                        </button>
                        <a href={link} target="_blank" rel="noreferrer">
                          Open student link
                        </a>
                      </div>
                    </div>
                  )}
                </section>
              )}
              {(page === 'Notebook' || page === 'Settings') && (
                <div className="authoring-actions">
                  {page === 'Notebook' && (
                    <div className="row" aria-label="Add cell">
                      <span>Add cell</span>
                      {(
                        [
                          ['markdown', 'Text'],
                          ['code', 'Python'],
                          ['image', 'Image'],
                          ['answer', 'Answer'],
                          ['checkpoint', 'Checkpoint'],
                        ] as const
                      ).map(([type, label]) => (
                        <button type="button" key={type} onClick={() => add(type)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                  <button className="primary" type="submit">
                    {busy ? 'Saving…' : 'Save'}
                  </button>
                </div>
              )}
            </fieldset>
          </form>
        )}
      </section>
    </Workspace>
  );
}
