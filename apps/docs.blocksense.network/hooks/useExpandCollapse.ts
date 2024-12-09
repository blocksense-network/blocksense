import { useEffect, useState, RefObject } from 'react';

type AccordionStates = {
  [key: string]: boolean;
};

export const useExpandCollapse = (
  names: string[],
  ref: RefObject<HTMLDivElement>,
) => {
  const [accordionStates, setAccordionStates] = useState<AccordionStates>(
    getInitialAccordionStates(),
  );

  function getInitialAccordionStates() {
    return Object.fromEntries(names.map(name => [name, false]));
  }

  function scrollToAnchorLink(anchorLinkId: string) {
    const anchorListNode = ref?.current;
    const anchorLink = anchorListNode?.querySelector(
      `#${anchorLinkId.replace(' ', '\\ ')}`,
    );
    anchorLink?.scrollIntoView({ behavior: 'smooth' });
  }

  useEffect(() => {
    const handleHashChange = () => {
      const hash = decodeURIComponent(window.location.hash.slice(1).trim());

      if (hash) {
        let resultHash = hash.includes('-') ? hash.split('-')[0] : hash;
        setAccordionStates({
          ...accordionStates,
          [resultHash]: true,
        });
        scrollToAnchorLink(hash);
      }
    };

    handleHashChange();

    window.addEventListener('hashchange', handleHashChange);

    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [ref?.current]);

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
