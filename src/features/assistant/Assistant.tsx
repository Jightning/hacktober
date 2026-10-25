import { useEffect, useRef, useState } from 'react';
import type { AssistantReply, ChatMessage } from '../../../shared/contracts';
import { api, send } from '../../lib/api';
import { Feedback } from '../../components/ui/Feedback';
interface AssistantProps {
  publicationId: string;
  studentId?: string;
  enabled: boolean;
}

export function Assistant(props: AssistantProps) {
  return (
    <Conversation
      key={JSON.stringify([props.publicationId, props.studentId, props.enabled])}
      {...props}
    />
  );
}

function Conversation({ publicationId, studentId, enabled }: AssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const active = useRef(true);
  const sending = useRef(false);
  const [loading, setLoading] = useState(enabled);
  const [historyFailed, setHistoryFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const path = `/publications/${publicationId}/assistant`;
  useEffect(() => {
    active.current = true;
    let current = true;
    if (!enabled)
      return () => {
        active.current = false;
      };
    setLoading(true);
    setHistoryFailed(false);
    setMessages([]);
    setError('');
    api<ChatMessage[]>(`${path}${studentId ? `?studentId=${encodeURIComponent(studentId)}` : ''}`)
      .then((result) => {
        if (current) setMessages(result);
      })
      .catch((e) => {
        if (current) {
          setError(e.message);
          setHistoryFailed(true);
        }
      })
      .finally(() => {
        if (current) setLoading(false);
      });
    return () => {
      current = false;
      active.current = false;
    };
  }, [path, studentId, enabled, reload]);
  async function ask() {
    if (!enabled || loading || historyFailed || sending.current || !message.trim()) return;
    sending.current = true;
    const question = message.trim();
    setBusy(true);
    setError('');
    try {
      const reply = await send<AssistantReply>(path, {
        message: question,
        ...(studentId ? { studentId } : {}),
      });
      if (!active.current) return;
      setMessages((old) => [
        ...old,
        { role: 'user', text: question, mock: false },
        { role: 'assistant', text: reply.text, mock: reply.mock },
      ]);
      setMessage('');
    } catch (e) {
      if (active.current) setError((e as Error).message);
    } finally {
      sending.current = false;
      if (active.current) setBusy(false);
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
      {historyFailed && (
        <button onClick={() => setReload((value) => value + 1)}>Retry loading conversation</button>
      )}
      {loading && <p role="status">Loading conversation…</p>}
      {busy && <p role="status">Waiting for the assistant…</p>}
      <div className="chat" aria-label="Assistant conversation" aria-live="polite">
        {!loading && !historyFailed && messages.length === 0 && (
          <p className="muted">No messages yet.</p>
        )}
        {messages.map((m, i) => (
          <div className={`message ${m.role}`} key={i}>
            <strong>
              {m.role === 'user' ? 'You' : m.mock ? 'Assistant (simulated)' : 'Assistant (live)'}
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
            disabled={!enabled || busy || loading || historyFailed}
            onChange={(e) => setMessage(e.target.value)}
          />
        </label>
        <button disabled={!enabled || busy || loading || historyFailed}>
          {busy ? 'Thinking…' : error && !historyFailed ? 'Retry question' : 'Send question'}
        </button>
      </form>
    </section>
  );
}
