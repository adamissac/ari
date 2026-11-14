'use client';

import Lenis from 'lenis';
import { useEffect } from 'react';

/**
 * Inertia scrolling for the page: the wheel eases the window to a stop instead of jumping.
 * Inner scroll areas (the console's content column, menus, code blocks) keep native scrolling.
 * Off under reduced motion and in automated browsers, like the other motion on the site.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || navigator.webdriver) return;
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, allowNestedScroll: true });
    let frame = 0;
    const tick = (time: number) => { lenis.raf(time); frame = requestAnimationFrame(tick); };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); lenis.destroy(); };
  }, []);
  return null;
}
