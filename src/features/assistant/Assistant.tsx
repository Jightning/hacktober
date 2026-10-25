import { useEffect, useState } from 'react';
import type { AssistantReply, ChatMessage } from '../../../shared/contracts';
import { api, send } from '../../lib/api';
import { Feedback } from '../../components/ui/Feedback';
export function Assistant({
  publicationId,
  studentId,
  enabled,
}: {
  publicationId: string;
  studentId?: string;
  enabled: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = `/publications/${publicationId}/assistant`;
  useEffect(() => {
    let active = true;
    setMessages([]);
    setError('');
    api<ChatMessage[]>(`${path}${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`)
      .then((result) => {
        if (active) setMessages(result);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [path, studentId]);
  async function ask() {
    setBusy(true);
    setError('');
    try {
      const reply = await send<AssistantReply>(path, {
        message,
        ...(studentId ? { studentId } : {}),
      });
      setMessages((old) => [
        ...old,
        { role: 'user', text: message, mock: false },
        { role: 'assistant', text: reply.text, mock: reply.mock },
      ]);
      setMessage('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel stack">
      <h2>{studentId ? 'TA assistant' : 'Study guidance'}</h2>
      <p className="muted">
        {studentId
          ? 'Uses this student’s saved work and instructor context. You decide on checkoffs.'
          : 'Guidance-oriented help using your saved work. Ask a TA when you need more context.'}
      </p>
      {!enabled && <p className="notice">Disabled by the instructor.</p>}
      <Feedback error={error} />
      <div className="chat" aria-label="Assistant conversation" aria-live="polite">
        {messages.length === 0 && <p className="muted">No messages yet.</p>}
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <strong>
              {m.role === 'user' ? 'You' : m.mock ? 'Assistant · MOCK' : 'Assistant · Gemma'}
            </strong>
            <p>{m.text}</p>
          </div>
        ))}
      </div>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void ask();
        }}
      >
        <label>
          {studentId ? 'Ask about this student’s work' : 'Ask for a hint'}
          <textarea
            required
            maxLength={2000}
            value={message}
            disabled={!enabled || busy}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <button disabled={!enabled || busy}>{busy ? 'Thinking…' : 'Send question'}</button>
      </form>
    </section>
  );
}
