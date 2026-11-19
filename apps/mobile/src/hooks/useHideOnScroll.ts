import { useEffect, useRef, useState } from 'react';

export interface UseHideOnScrollOptions {
  locked: boolean;
}

export interface UseHideOnScrollResult {
  topHidden: boolean;
  tabHidden: boolean;
}

export function useHideOnScroll({ locked }: UseHideOnScrollOptions): UseHideOnScrollResult {
  const [topHidden, setTopHidden] = useState(false);
  const [tabHidden, setTabHidden] = useState(false);

  const topHiddenRef = useRef(topHidden);
  topHiddenRef.current = topHidden;
  const tabHiddenRef = useRef(tabHidden);
  tabHiddenRef.current = tabHidden;

  const anchorYRef = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const lastScrollYRef = useRef(typeof window !== 'undefined' ? window.scrollY : 0);
  const directionRef = useRef<'up' | 'down' | null>(null);
  const preLockRef = useRef<{ topHidden: boolean; tabHidden: boolean }>({ topHidden: false, tabHidden: false });
  const wasLockedRef = useRef(locked);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      setTopHidden(false);
      setTabHidden(false);
      return;
    }

    if (locked && !wasLockedRef.current) {
      preLockRef.current = { topHidden: topHiddenRef.current, tabHidden: tabHiddenRef.current };
      setTabHidden(true);
      wasLockedRef.current = true;
    } else if (!locked && wasLockedRef.current) {
      const currentScrollY = window.scrollY;
      const scrollHeight = document.documentElement?.scrollHeight ?? 0;
      const innerHeight = window.innerHeight ?? 0;
      const isAtEnd = scrollHeight > innerHeight && currentScrollY + innerHeight >= scrollHeight - 1;

      anchorYRef.current = currentScrollY;
      lastScrollYRef.current = currentScrollY;
      directionRef.current = null;
      wasLockedRef.current = false;

      if (currentScrollY < 52) {
        setTopHidden(false);
        setTabHidden(false);
      } else if (isAtEnd) {
        setTopHidden(preLockRef.current.topHidden);
        setTabHidden(false);
      } else {
        setTopHidden(preLockRef.current.topHidden);
        setTabHidden(preLockRef.current.tabHidden);
      }
    }
  }, [locked]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (mediaQuery?.matches) {
      setTopHidden(false);
      setTabHidden(false);
      return;
    }

    const handleScroll = () => {
      if (mediaQuery?.matches) {
        setTopHidden(false);
        setTabHidden(false);
        return;
      }

      const currentScrollY = window.scrollY;
      const scrollHeight = document.documentElement?.scrollHeight ?? 0;
      const innerHeight = window.innerHeight ?? 0;
      const isAtEnd = scrollHeight > innerHeight && currentScrollY + innerHeight >= scrollHeight - 1;

      if (locked) {
        lastScrollYRef.current = currentScrollY;
        return;
      }

      if (currentScrollY < 52) {
        setTopHidden(false);
        setTabHidden(false);
        anchorYRef.current = currentScrollY;
        lastScrollYRef.current = currentScrollY;
        directionRef.current = null;
        return;
      }

      if (isAtEnd) {
        setTabHidden(false);
        lastScrollYRef.current = currentScrollY;
        return;
      }

      const diff = currentScrollY - lastScrollYRef.current;
      if (diff > 0) {
        if (directionRef.current !== 'down') {
          directionRef.current = 'down';
          anchorYRef.current = lastScrollYRef.current;
        }
        if (currentScrollY - anchorYRef.current > 8) {
          setTopHidden(true);
          setTabHidden(true);
        }
      } else if (diff < 0) {
        if (directionRef.current !== 'up') {
          directionRef.current = 'up';
          anchorYRef.current = lastScrollYRef.current;
        }
        if (anchorYRef.current - currentScrollY > 8) {
          setTopHidden(false);
          setTabHidden(false);
        }
      }
      lastScrollYRef.current = currentScrollY;
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [locked]);

  return { topHidden, tabHidden };
}
