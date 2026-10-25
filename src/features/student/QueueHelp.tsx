import { useState } from 'react';
import type { PublicLab, QueueRequest } from '../../../shared/contracts';
import { send } from '../../lib/api';
import { Feedback } from '../../components/ui/Feedback';
export function QueueHelp({
  lab,
  requests,
  currentBlockId,
  onChange,
}: {
  lab: PublicLab;
  requests: QueueRequest[];
  currentBlockId: string | null;
  onChange: () => Promise<void>;
}) {
  const [type, setType] = useState<'help' | 'checkoff'>('help');
  const [blockId, setBlockId] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const active = requests.find((r) => r.state === 'waiting' || r.state === 'claimed');
  const latest = requests.at(-1);
  const blocks =
    type === 'checkoff'
      ? lab.blocks.filter((b) => b.type === 'checkpoint' && b.mode === 'ta')
      : lab.blocks;
  const selected = blocks.some((b) => b.id === blockId)
    ? blockId
    : blocks.some((b) => b.id === currentBlockId)
      ? currentBlockId!
      : blocks[0]?.id || '';
  const open =
    Date.now() >= Date.parse(lab.settings.opensAt) &&
    Date.now() <= Date.parse(lab.settings.closesAt);
  async function act(cancel = false) {
    setBusy(true);
    setError('');
    try {
      await send(
        cancel
          ? `/publications/${lab.id}/queue/${active!.id}/cancel`
          : `/publications/${lab.id}/queue`,
        cancel ? {} : { type, blockId: selected, description },
      );
      await onChange();
      if (!cancel) setDescription('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <h2>Ask a TA</h2>
      <Feedback error={error} />
      {active ? (
        <>
          <p role="status">
            <strong>
              {active.state === 'waiting' ? 'Waiting for a TA' : 'A TA has claimed your request'}
            </strong>{' '}
            · {active.type}
          </p>
          <p>{active.description}</p>
          <p className="muted">Requested {new Date(active.createdAt).toLocaleTimeString()}</p>
          {active.state === 'waiting' && (
            <button disabled={busy} onClick={() => void act(true)}>
              Cancel waiting request
            </button>
          )}
        </>
      ) : (
        <>
          {latest && <p role="status">Previous request: {latest.state}</p>}
          {!open && (
            <p className="notice">
              Queue closed. Session: {new Date(lab.settings.opensAt).toLocaleString()} –{' '}
              {new Date(lab.settings.closesAt).toLocaleString()}
            </p>
          )}
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void act();
            }}
          >
            <label>
              Request type
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as typeof type);
                  setBlockId('');
                }}
              >
                <option value="help">Help with my work</option>
                <option value="checkoff">Checkpoint checkoff</option>
              </select>
            </label>
            <label>
              Relevant step
              <select value={selected} onChange={(e) => setBlockId(e.target.value)}>
                {blocks.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              What would you like to discuss?
              <textarea
                required
                maxLength={1000}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <button disabled={busy || !open || !selected}>
              {busy ? 'Sending…' : 'Join TA queue'}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
