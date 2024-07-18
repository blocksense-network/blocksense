import { useEffect, useState } from 'react';

type AccordionStates = {
  [key: string]: boolean;
};

export const useExpandCollapse = (names: string[]) => {
  const [accordionStates, setAccordionStates] = useState<AccordionStates>(
    getInitialAccordionStates(),
  );

  function getInitialAccordionStates() {
    return Object.fromEntries(names.map(name => [name, false]));
  }

  useEffect(() => {
    const handleHashChange = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1).trim());

      if (hash) {
        setAccordionStates({
          ...accordionStates,
          [hash]: true,
        });

        const element = document.getElementById(hash);
        if (element) {
          setTimeout(() => {
            element.scrollIntoView({ behavior: 'smooth' });
          }, 100);
        }
      }
    };
    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  function expandAll() {
    setAccordionStates(
      Object.fromEntries(
        Object.entries(accordionStates).map(([key]) => [key, true]),
      ),
    );
  }

  function collapseAll() {
    setAccordionStates(
      Object.fromEntries(
        Object.entries(accordionStates).map(([key]) => [key, false]),
      ),
    );
  }

  function toggleAccordion(name: string) {
    setAccordionStates({
      ...accordionStates,
      [name]: !accordionStates[name],
    });
  }

  return { accordionStates, expandAll, collapseAll, toggleAccordion };
};
