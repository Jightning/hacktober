import { useEffect, useState } from 'react';
import type { Answer, PublicBlock } from '../../../shared/contracts';
import { send } from '../../lib/api';
import { Feedback } from '../../components/ui/Feedback';
export function AnswerInput({
  publicationId,
  block,
  saved,
  onSaved,
}: {
  publicationId: string;
  block: Extract<PublicBlock, { type: 'answer' }>;
  saved?: Answer;
  onSaved: () => Promise<void>;
}) {
  const [value, setValue] = useState(saved?.value || '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (!dirty) setValue(saved?.value || '');
  }, [saved?.value, dirty]);
  async function submit() {
    setBusy(true);
    setError('');
    setStatus('Saving…');
    try {
      await send(
        `/publications/${publicationId}/answers/${block.id}`,
        { value, units: block.units },
        'PUT',
      );
      await onSaved();
      setDirty(false);
      setStatus('Submitted and saved. Checkpoint verification is a separate step.');
    } catch (e) {
      setError((e as Error).message);
      setStatus('Your response is still here. Retry to save it.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label>
        {block.title}
        {block.units && ` (${block.units})`}
        <input
          type={block.input === 'number' ? 'number' : 'text'}
          step="any"
          required
          disabled={busy}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setDirty(true);
            setStatus('Unsaved response');
          }}
        />
      </label>
      <div className="row">
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Submit answer'}
        </button>
        <span className="muted">
          {saved
            ? `Submitted ${new Date(saved.submittedAt).toLocaleTimeString()}`
            : 'Not submitted'}
        </span>
      </div>
      <Feedback error={error} status={status} />
    </form>
  );
}
