import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { useHideOnScroll } from '../hooks/useHideOnScroll.ts';

export interface BarsContextValue {
  topHidden: boolean;
  tabHidden: boolean;
  hidden: boolean;
  setLocked: (locked: boolean) => void;
  lock: () => () => void;
}

const defaultBarsContext: BarsContextValue = {
  topHidden: false,
  tabHidden: false,
  hidden: false,
  setLocked: () => {},
  lock: () => () => {},
};

export const BarsContext = createContext<BarsContextValue>(defaultBarsContext);

export interface BarsProviderProps {
  children: ReactNode;
}

export function BarsProvider({ children }: BarsProviderProps) {
  const [lockCount, setLockCount] = useState(0);
  const [legacyLocked, setLegacyLocked] = useState(false);
  const locked = lockCount > 0 || legacyLocked;
  const { topHidden, tabHidden } = useHideOnScroll({ locked });

  const lock = useCallback(() => {
    let released = false;
    setLockCount((c) => c + 1);
    return () => {
      if (!released) {
        released = true;
        setLockCount((c) => Math.max(0, c - 1));
      }
    };
  }, []);

  return (
    <BarsContext.Provider
      value={{
        topHidden,
        tabHidden,
        hidden: topHidden,
        setLocked: setLegacyLocked,
        lock,
      }}
    >
      {children}
    </BarsContext.Provider>
  );
}

export function useBars(): BarsContextValue {
  return useContext(BarsContext);
}
