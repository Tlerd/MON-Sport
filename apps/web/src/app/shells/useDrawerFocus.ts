import { type RefObject, useEffect, useRef } from 'react';

export function useDrawerFocus(
  drawerOpen: boolean,
  drawerRef: RefObject<HTMLElement | null>,
  menuBtnRef: RefObject<HTMLButtonElement | null>,
) {
  const wasOpen = useRef(false);
  useEffect(() => {
    if (drawerOpen) {
      wasOpen.current = true;
      const first = drawerRef.current?.querySelector<HTMLElement>(
        'input, a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      first?.focus();
    } else if (wasOpen.current) {
      wasOpen.current = false;
      menuBtnRef.current?.focus();
    }
  }, [drawerOpen, drawerRef, menuBtnRef]);
}
