'use client';

import { useEffect } from 'react';

export default function ScrollToTopOnLoad() {
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const scrollTop = () => {
      if (!window.location.hash) {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      }
    };

    scrollTop();
    const timer = window.setTimeout(scrollTop, 120);

    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
