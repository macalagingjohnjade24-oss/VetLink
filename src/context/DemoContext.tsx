import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { demoService } from '../services/demoService';

type DemoContextValue = {
  /** Bumped after a reset so the data providers re-read their seeded state. */
  dataVersion: number;
  resetDemoData: () => Promise<void>;
};

const DemoContext = createContext<DemoContextValue | null>(null);

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [dataVersion, setDataVersion] = useState(0);

  const resetDemoData = useCallback(async () => {
    await demoService.resetDemoData();
    setDataVersion((current) => current + 1);
  }, []);

  const value = useMemo<DemoContextValue>(() => ({ dataVersion, resetDemoData }), [dataVersion, resetDemoData]);

  return <DemoContext.Provider value={value}>{children}</DemoContext.Provider>;
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error('useDemo must be used inside <DemoProvider>.');
  return context;
}
