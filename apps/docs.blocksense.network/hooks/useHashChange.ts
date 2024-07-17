import { useEffect, useState } from 'react';

export const useHashChange = () => {
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const handleHashChange = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1).trim());

      if (hash) {
        setExpanded(prevExpanded => {
          if (prevExpanded === hash) return prevExpanded;
          return hash;
        });

        const element = document.getElementById(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      } else {
        setExpanded(null);
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  return { expanded, setExpanded };
};
