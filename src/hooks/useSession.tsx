import { createContext, useContext, ReactNode } from 'react';
import { useAuth } from './useAuth';
import { User, Session } from '@supabase/supabase-js';

interface SessionContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  initialized: boolean;
  signIn: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signUp: (email: string, password: string) => Promise<{ data: any; error: any }>;
  signOut: () => Promise<{ error: any }>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionContextProviderProps {
  children: ReactNode;
}

export function SessionContextProvider({ children }: SessionContextProviderProps) {
  const auth = useAuth();

  return (
    <SessionContext.Provider value={auth}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
}