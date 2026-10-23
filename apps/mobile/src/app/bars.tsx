import { createContext, useContext, useState, type ReactNode } from 'react';
import { useHideOnScroll } from '../hooks/useHideOnScroll.ts';

export interface BarsContextValue {
  topHidden: boolean;
  tabHidden: boolean;
  hidden: boolean;
  setLocked: (locked: boolean) => void;
}

const defaultBarsContext: BarsContextValue = {
  topHidden: false,
  tabHidden: false,
  hidden: false,
  setLocked: () => {},
};

export const BarsContext = createContext<BarsContextValue>(defaultBarsContext);

export interface BarsProviderProps {
  children: ReactNode;
}

export function BarsProvider({ children }: BarsProviderProps) {
  const [locked, setLocked] = useState(false);
  const { topHidden, tabHidden } = useHideOnScroll({ locked });

  return (
    <BarsContext.Provider value={{ topHidden, tabHidden, hidden: topHidden, setLocked }}>
      {children}
    </BarsContext.Provider>
  );
}

export function useBars(): BarsContextValue {
  return useContext(BarsContext);
}
