import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types';
import { useAuth } from '@/contexts/AuthContext';

interface TestModeContextType {
  viewAsProfile: Profile | null;
  setViewAsProfile: (profile: Profile | null) => void;
  allProfiles: Profile[];
  loadingProfiles: boolean;
}

const TestModeContext = createContext<TestModeContextType | undefined>(undefined);

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const [viewAsProfile, setViewAsProfile] = useState<Profile | null>(null);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setAllProfiles([]);
      setViewAsProfile(null);
      return;
    }
    setLoadingProfiles(true);
    supabase
      .from('profiles')
      .select('*, company:companies(*), site:sites(*)')
      .order('full_name')
      .then(({ data }) => {
        setAllProfiles((data as unknown as Profile[]) ?? []);
        setLoadingProfiles(false);
      });
  }, [user]);

  return (
    <TestModeContext.Provider value={{ viewAsProfile, setViewAsProfile, allProfiles, loadingProfiles }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  const context = useContext(TestModeContext);
  if (context === undefined) {
    throw new Error('useTestMode must be used within TestModeProvider');
  }
  return context;
}

export function useEffectiveProfile() {
  const { profile } = useAuth();
  const { viewAsProfile } = useTestMode();
  return viewAsProfile ?? profile;
}
