import { useEffect, useState } from 'react';
import type { EditorBlock, EditorDraft } from './types';
import { api, send } from '../../lib/api';
import { Feedback } from '../../components/ui/Feedback';
import { PublicBlockView } from '../../components/lab-blocks/PublicBlockView';
import { BlockEditor } from './BlockEditor';
import { SettingsEditor } from './SettingsEditor';
export function Authoring({
  publicationChanged,
}: {
  publicationChanged: (id: string) => Promise<void>;
}) {
  const [labs, setLabs] = useState<{ id: string; title: string }[]>([]);
  const [id, setId] = useState('');
  const [draft, setDraft] = useState<EditorDraft | null>(null);
  const [preview, setPreview] = useState(false);
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
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (id) {
      setDraft(null);
      setDirty(false);
      setLink('');
      api<EditorDraft>(`/labs/${id}`)
        .then(setDraft)
        .catch((e) => setError(e.message));
    }
  }, [id]);
  function edit(next: EditorDraft) {
    setDraft(next);
    setDirty(true);
    setStatus('Unsaved draft changes');
  }
  async function save(publish = false) {
    setBusy(true);
    setError('');
    setStatus('Saving…');
    try {
      await send(`/labs/${id}`, draft, 'PUT');
      setDirty(false);
      setLabs((old) => old.map((l) => (l.id === id ? { ...l, title: draft!.title } : l)));
      if (publish) {
        const pub = await send<{ id: string }>(`/labs/${id}/publish`);
        setLink(`${window.location.origin}/lab/${pub.id}`);
        await publicationChanged(pub.id);
        setStatus('Published a new snapshot. Existing student links keep their content.');
      } else setStatus('Draft saved. Published content is unchanged.');
    } catch (e) {
      setError((e as Error).message);
      setStatus('');
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    setBusy(true);
    try {
      const result = await send<{ id: string }>('/labs', { title: 'Untitled lab' });
      setLabs((old) => [...old, { id: result.id, title: 'Untitled lab' }]);
      setId(result.id);
      setStatus('New draft created.');
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
          ? { ...base, type, code: '', language: 'text' }
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
  }
  return (
    <section className="editor">
      <div className="page-heading">
        <div>
          <h1>Lab editor</h1>
          <p className="muted">Build a draft, then publish a stable student link.</p>
        </div>
        <button onClick={() => void create()} disabled={busy || dirty}>
          New lab
        </button>
      </div>
      <label>
        Draft
        <select value={id} disabled={dirty} onChange={(e) => setId(e.target.value)}>
          {labs.map((l) => (
            <option value={l.id} key={l.id}>
              {l.title}
            </option>
          ))}
        </select>
      </label>
      <Feedback error={error} status={status} />
      {draft && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset className="form-body" disabled={busy}>
            <div className="toolbar">
              <button className="primary" disabled={busy}>
                {busy ? 'Saving…' : 'Save draft'}
              </button>
              <button type="button" disabled={busy} onClick={() => void save(true)}>
                Save & publish
              </button>
              <button type="button" onClick={() => setPreview(!preview)}>
                {preview ? 'Back to editor' : 'Preview student view'}
              </button>
              {dirty && <span className="muted">Unsaved</span>}
            </div>
            {link && (
              <div className="panel stack">
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
            {preview ? (
              <div className="stack">
                <p className="notice">Student preview · responses and checks are inactive.</p>
                <h2>{draft.title}</h2>
                {draft.blocks.map((b) => (
                  <section className="panel" key={b.id}>
                    <h3>{b.title}</h3>
                    <PublicBlockView block={b} />
                  </section>
                ))}
              </div>
            ) : (
              <div className="stack">
                <label>
                  Lab title
                  <input
                    required
                    value={draft.title}
                    onChange={(e) => edit({ ...draft, title: e.target.value })}
                  />
                </label>
                <SettingsEditor
                  value={draft.settings}
                  onChange={(settings) => edit({ ...draft, settings })}
                />
                {draft.blocks.map((block, index) => (
                  <BlockEditor
                    key={block.id}
                    block={block}
                    answers={draft.blocks.filter((b) => b.type === 'answer')}
                    first={index === 0}
                    last={index === draft.blocks.length - 1}
                    onChange={(next) =>
                      edit({
                        ...draft,
                        blocks: draft.blocks.map((b) => (b.id === block.id ? next : b)),
                      })
                    }
                    onMove={(direction) => {
                      const blocks = [...draft.blocks];
                      [blocks[index], blocks[index + direction]] = [
                        blocks[index + direction],
                        blocks[index],
                      ];
                      edit({ ...draft, blocks });
                    }}
                    onDelete={() =>
                      edit({
                        ...draft,
                        blocks: draft.blocks
                          .filter((b) => b.id !== block.id)
                          .map((b) =>
                            b.type === 'checkpoint'
                              ? { ...b, answerIds: b.answerIds.filter((a) => a !== block.id) }
                              : b,
                          ),
                      })
                    }
                  />
                ))}
                <div className="panel row">
                  <span>Add block</span>
                  {(['markdown', 'code', 'image', 'answer', 'checkpoint'] as const).map((t) => (
                    <button type="button" key={t} onClick={() => add(t)}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </fieldset>
        </form>
      )}
      {!draft && <p>{labs.length ? 'Loading draft…' : 'Create a lab to begin.'}</p>}
    </section>
  );
}
