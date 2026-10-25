import { useCallback, useEffect, useRef, useState } from 'react';
import type { StudentState } from '../../../shared/contracts';
import { api } from '../../lib/api';

// Each refresh supersedes earlier reads, including reads started before a save.
export function useStudentState(publicationId: string) {
  const [data, setData] = useState<StudentState | null>(null);
  const [error, setError] = useState('');
  const sequence = useRef(0);
  const inFlight = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++sequence.current;
    inFlight.current++;
    try {
      const result = await api<StudentState>(`/publications/${publicationId}/student`);
      if (current === sequence.current) {
        setData(result);
        setError('');
      }
    } catch (error) {
      if (current === sequence.current) setError((error as Error).message);
      throw error;
    } finally {
      inFlight.current--;
    }
  }, [publicationId]);
  useEffect(() => {
    setData(null);
    const poll = () => {
      if (!inFlight.current) void refresh().catch(() => {});
    };
    poll();
    const timer = window.setInterval(poll, 3000);
    return () => {
      sequence.current++;
      window.clearInterval(timer);
    };
  }, [refresh]);
  return { data, error, refresh };
}
