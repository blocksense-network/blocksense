import { useState, useEffect } from 'react';

export function useMediaQuery(query: string) {
  const isBrowser = typeof window !== 'undefined';

  const [matches, setMatches] = useState(() => {
    if (isBrowser) {
      return window.matchMedia(query).matches;
    }
    return true;
  });

  useEffect(() => {
    if (!isBrowser) {
      return;
    }

    const mediaQueryList = window.matchMedia(query);

    function handleChange() {
      setMatches(mediaQueryList.matches);
    }

    mediaQueryList.addEventListener('change', handleChange);

    return () => {
      mediaQueryList.removeEventListener('change', handleChange);
    };
  }, [query, isBrowser]);

  return matches;
}
