import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AppRole, ROLE_PERMISSIONS } from '@/types/auth';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; success: boolean }>;
  signOut: () => Promise<void>;
  canAccessSettings: boolean;
  canManageAdmins: boolean;
  canUseFeatures: boolean;
  canPerformActions: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUserRole = async (userId: string): Promise<AppRole | null> => {
    const { data } = await supabase.rpc('get_user_role', { _user_id: userId });
    return data as AppRole | null;
  };

  useEffect(() => {
    // Set up auth state listener BEFORE checking session
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        
        if (currentSession?.user) {
          // Use setTimeout to avoid potential deadlock with Supabase client
          setTimeout(async () => {
            const userRole = await fetchUserRole(currentSession.user.id);
            setRole(userRole);
            setIsLoading(false);
          }, 0);
        } else {
          setRole(null);
          setIsLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(async ({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);
      
      if (existingSession?.user) {
        const userRole = await fetchUserRole(existingSession.user.id);
        setRole(userRole);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error) {
      setIsLoading(false);
      return { error: error as Error, success: false };
    }

    // Immediately fetch and set role after successful login
    if (data.user) {
      const userRole = await fetchUserRole(data.user.id);
      setUser(data.user);
      setSession(data.session);
      setRole(userRole);
    }
    
    setIsLoading(false);
    return { error: null, success: true };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
  };

  const permissions = role ? ROLE_PERMISSIONS[role] : {
    canAccessSettings: false,
    canManageAdmins: false,
    canUseFeatures: false,
    canPerformActions: false,
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        isLoading,
        signIn,
        signOut,
        ...permissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
