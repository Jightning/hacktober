import { createContext, useContext } from 'react';
import type { Identity } from '../../shared/contracts';
export const SessionContext = createContext<Identity | null>(null);
export function useIdentity() {
  const value = useContext(SessionContext);
  if (!value) throw new Error('Session required');
  return value;
}
