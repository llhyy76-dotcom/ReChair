'use client';

import { useEffect } from 'react';

export default function ScrollToTopOnLoad() {
  useEffect(() => {
    if ('scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }

    const forceTop = () => {
      window.scrollTo(0, 0);
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    };

    forceTop();

    const timers = [
      window.setTimeout(forceTop, 50),
      window.setTimeout(forceTop, 150),
      window.setTimeout(forceTop, 400),
      window.setTimeout(forceTop, 800),
    ];

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  return null;
}
