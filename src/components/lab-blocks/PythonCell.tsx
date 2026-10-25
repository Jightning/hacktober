import { useEffect, useRef, useState } from 'react';
import './python-cell.css';

export function PythonCell({
  code: initialCode,
  title,
  onCodeChange,
}: {
  code: string;
  title: string;
  onCodeChange?: (code: string) => void;
}) {
  const [code, setCode] = useState(initialCode);
  const [output, setOutput] = useState('');
  const [status, setStatus] = useState('');
  const [running, setRunning] = useState(false);
  const [failed, setFailed] = useState(false);
  const frame = useRef<HTMLIFrameElement>(null);
  const codeToRun = useRef('');
  useEffect(() => {
    setCode(initialCode);
  }, [initialCode]);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (!frame.current || event.source !== frame.current.contentWindow) return;
      const { type, text } = event.data || {};
      if (type === 'output' && typeof text === 'string')
        setOutput((old) => (old + text).slice(0, 20000));
      if (type === 'running') setStatus('Running');
      if (type === 'error' || type === 'done') {
        setFailed(type === 'error');
        setStatus(typeof text === 'string' ? text.slice(0, 4000) : 'Finished');
        setRunning(false);
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, []);
  useEffect(() => {
    if (!running) return;
    const timeout = setTimeout(() => {
      frame.current?.contentWindow?.postMessage({ type: 'stop' }, '*');
      setRunning(false);
      setFailed(true);
      setStatus('Python did not respond. Retry to run your code.');
    }, 80000);
    return () => clearTimeout(timeout);
  }, [running]);
  function run() {
    codeToRun.current = code;
    setOutput('');
    setFailed(false);
    setStatus('Loading Python');
    setRunning(true);
  }
  function stop() {
    frame.current?.contentWindow?.postMessage({ type: 'stop' }, '*');
    setRunning(false);
    setStatus('Stopped');
  }
  return (
    <div className="python-cell stack">
      <label>
        Python
        <textarea
          aria-label={`${title} Python code`}
          spellCheck={false}
          rows={Math.max(6, Math.min(18, code.split('\n').length + 1))}
          maxLength={20000}
          value={code}
          onChange={(event) => {
            setCode(event.target.value);
            onCodeChange?.(event.target.value);
          }}
          disabled={running}
        />
      </label>
      <div className="row">
        {running ? (
          <button type="button" onClick={stop}>
            Stop
          </button>
        ) : (
          <button type="button" className="primary" onClick={run} disabled={!code.trim()}>
            Run Python
          </button>
        )}
        <span className="muted">Runs in your browser</span>
      </div>
      {output && (
        <pre className="python-output" aria-label="Python output">
          {output}
        </pre>
      )}
      {status && (
        <p className={failed ? 'notice error' : 'muted'} role={failed ? 'alert' : 'status'}>
          {status}
        </p>
      )}
      {running && (
        <iframe
          ref={frame}
          title="Isolated Python runner"
          src="/python-runner.html"
          sandbox="allow-scripts"
          hidden
          onLoad={() =>
            frame.current?.contentWindow?.postMessage({ type: 'run', code: codeToRun.current }, '*')
          }
        />
      )}
    </div>
  );
}
