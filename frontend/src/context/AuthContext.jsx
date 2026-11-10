import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  signUp: async () => {},
  signIn: async () => {},
  signInWithRegistrationNumber: async () => {},
  signOut: async () => {},
  resetPassword: async () => {},
  updatePassword: async () => {},
  changePassword: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    let isMounted = true;

    // 1. Fetch current active session on load
    const initializeAuth = async () => {
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (error) {
          console.error('[AuthContext] Error getting initial session:', error.message);
        }
        if (isMounted) {
          setSession(initialSession);
          setUser(initialSession?.user ?? null);
          setLoading(false);
        }
      } catch (err) {
        console.error('[AuthContext] Unexpected error initializing session:', err);
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initializeAuth();

    // 2. Subscribe to Supabase auth state change events (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  // Email + password sign up
  const signUp = async ({ email, password, fullName }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured yet. Please check your .env configuration.');
    }

    const redirectTo = `${window.location.origin}/login`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) throw error;
    return data;
  };

  // Email + password sign in
  const signIn = async ({ email, password }) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured yet. Please check your .env configuration.');
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  };

  // University registration number + password sign in
  const signInWithRegistrationNumber = async (registrationNumber, password) => {
    if (!registrationNumber || !registrationNumber.trim()) {
      throw new Error('University registration number is required.');
    }
    if (!password) {
      throw new Error('Password is required.');
    }

    const response = await fetch('/api/auth/student-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        registrationNumber: registrationNumber.trim(),
        password,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Login failed. Please verify your credentials.');
    }

    if (!data.session?.access_token || !data.session?.refresh_token) {
      throw new Error('Authentication failed: Missing session tokens in response.');
    }

    if (!supabase) {
      throw new Error('Supabase client is not available to establish session.');
    }

    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
    });

    if (sessionError) {
      throw sessionError;
    }

    return sessionData;
  };

  // Sign out / logout
  const signOut = async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('[AuthContext] Error signing out:', error.message);
      throw error;
    }
  };

  // Send password reset email
  const resetPassword = async (email) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured yet. Please check your .env configuration.');
    }

    const redirectTo = `${window.location.origin}/reset-password`;
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) throw error;
    return data;
  };

  // Update password after recovery redirect
  const updatePassword = async (newPassword) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Supabase is not configured yet. Please check your .env configuration.');
    }

    const { data, error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
    return data;
  };

  // Change password for authenticated user with current password verification
  const changePassword = async ({ currentPassword, newPassword, confirmPassword }) => {
    if (!session?.access_token) {
      throw new Error('You must be signed in to change your password.');
    }

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        currentPassword,
        newPassword,
        confirmPassword,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.message || 'Failed to change password.');
    }

    // Refresh user state if metadata changed
    if (supabase) {
      const { data: refreshedUser } = await supabase.auth.getUser();
      if (refreshedUser?.user) {
        setUser(refreshedUser.user);
      }
    }

    return data;
  };

  const value = {
    user,
    session,
    loading,
    isConfigured: isSupabaseConfigured,
    signUp,
    signIn,
    signInWithRegistrationNumber,
    signOut,
    resetPassword,
    updatePassword,
    changePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
