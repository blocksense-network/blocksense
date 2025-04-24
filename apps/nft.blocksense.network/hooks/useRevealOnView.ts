import { useEffect, useRef, useState, RefObject } from 'react';

type UseRevealOnViewReturn = {
  targetRef: RefObject<HTMLDivElement>;
  show: boolean;
};

export const useRevealOnView = (
  threshold: number = 0.1,
): UseRevealOnViewReturn => {
  const targetRef = useRef<HTMLDivElement>(null);
  const [show, setShow] = useState<boolean>(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const entry = entries[0];
        if (entry) {
          setShow(entry.isIntersecting);
        }
      },
      { threshold },
    );

    if (targetRef.current) observer.observe(targetRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  return { targetRef, show };
};
