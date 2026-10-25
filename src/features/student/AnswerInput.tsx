import { useEffect, useRef, useState } from 'react';
import type { Answer, PublicBlock } from '../../../shared/contracts';
import { send } from '../../lib/api';
import { Feedback } from '../../components/ui/Feedback';
export function AnswerInput({
  publicationId,
  block,
  saved,
  onSaved,
  onDirtyChange,
}: {
  publicationId: string;
  block: Extract<PublicBlock, { type: 'answer' }>;
  saved?: Answer;
  onSaved: (value: string) => Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [value, setValue] = useState(saved?.value || '');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [dirty, setDirty] = useState(false);
  const previousSavedValue = useRef(saved?.value);
  useEffect(() => {
    // A failed refresh after a successful save must not restore the old answer.
    if (previousSavedValue.current !== saved?.value) {
      previousSavedValue.current = saved?.value;
      if (!dirty) setValue(saved?.value || '');
    }
  }, [saved?.value, dirty]);
  async function submit() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError('');
    setStatus('Saving…');
    try {
      await send(
        `/publications/${publicationId}/answers/${block.id}`,
        { value, units: block.units },
        'PUT',
      );
      setDirty(false);
      onDirtyChange?.(false);
      setStatus('Answer saved.');
      try {
        await onSaved(value);
      } catch {
        setStatus('Answer saved. Progress could not refresh yet.');
      }
    } catch (e) {
      setError((e as Error).message);
      setStatus('Your response is still here. Retry to save it.');
    } finally {
      saving.current = false;
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
            onDirtyChange?.(true);
            setStatus('Unsaved response');
          }}
        />
      </label>
      <div className="row">
        <button className="primary" disabled={busy}>
          {busy ? 'Saving…' : error ? 'Retry save' : 'Submit answer'}
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
