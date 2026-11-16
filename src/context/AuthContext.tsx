import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types/index.ts';
import { api, setStoredToken, getStoredToken } from '../services/api.ts';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  prescriptionManagementEnabled: boolean;
  featuresLoaded: boolean;
  refreshFeatures: () => Promise<void>;
  setPrescriptionFeatureEnabled: (enabled: boolean) => void;
  login: (username: string, password?: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  quickSwitch: (username: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [prescriptionManagementEnabled, setPrescriptionManagementEnabled] = useState<boolean>(false);
  const [featuresLoaded, setFeaturesLoaded] = useState<boolean>(false);

  const refreshFeatures = useCallback(async () => {
    const token = getStoredToken();
    if (!token) {
      setPrescriptionManagementEnabled(false);
      setFeaturesLoaded(false);
      return;
    }
    try {
      const data = await api.getFeatures();
      setPrescriptionManagementEnabled(Boolean(data.prescriptionManagement));
      setFeaturesLoaded(true);
    } catch (e) {
      console.warn('Failed to fetch feature flags:', e);
    }
  }, []);

  const refreshUser = async () => {
    try {
      const token = getStoredToken();
      if (!token) {
        setUser(null);
        setLoading(false);
        return;
      }
      const res = await api.getCurrentUser();
      setUser(res.user);
      await refreshFeatures();
    } catch (e) {
      console.warn('Failed to restore session:', e);
      setStoredToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  // Re-sync feature flags on window focus or whenever any prescription API returns FEATURE_DISABLED
  useEffect(() => {
    if (!user) return;
    const onFocus = () => {
      refreshFeatures();
    };
    const onFeatureDisabled = () => {
      setPrescriptionManagementEnabled(false);
      setFeaturesLoaded(true);
    };
    window.addEventListener('focus', onFocus);
    window.addEventListener('prescription-feature-disabled', onFeatureDisabled);
    return () => {
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('prescription-feature-disabled', onFeatureDisabled);
    };
  }, [user, refreshFeatures]);

  const login = async (username: string, password?: string) => {
    setLoading(true);
    try {
      const res = await api.login({ username, password });
      setStoredToken(res.token);
      setUser(res.user);
      await refreshFeatures();
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      setStoredToken(idToken);
      const res = await api.getCurrentUser();
      setUser(res.user);
      await refreshFeatures();
    } catch (error: any) {
      console.error('Google Sign-In failed:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const quickSwitch = async (username: string) => {
    setLoading(true);
    try {
      let pass = 'Doctor@123';
      if (username === 'maindoctor') pass = 'ClinicAdmin@2026';
      if (username === 'dev_admin') pass = 'DevDental@2026';

      const res = await api.login({ username, password: pass });
      setStoredToken(res.token);
      setUser(res.user);
      await refreshFeatures();
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    setStoredToken(null);
    setUser(null);
    setPrescriptionManagementEnabled(false);
    setFeaturesLoaded(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        prescriptionManagementEnabled,
        featuresLoaded,
        refreshFeatures,
        setPrescriptionFeatureEnabled: setPrescriptionManagementEnabled,
        login,
        loginWithGoogle,
        quickSwitch,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
