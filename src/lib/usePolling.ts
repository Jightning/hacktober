import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
export function usePolling<T>(path: string, interval = 3000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = generation.current;
    try {
      const result = await api<T>(path);
      if (current === generation.current) {
        setData(result);
        setError('');
      }
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    }
  }, [path]);
  useEffect(() => {
    generation.current++;
    setData(null);
    void refresh();
    const timer = setInterval(() => void refresh(), interval);
    return () => {
      generation.current++;
      clearInterval(timer);
    };
  }, [refresh, interval]);
  return { data, error, refresh };
}
