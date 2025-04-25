import { useState, useEffect } from 'react';

export const useHash = () => {
  const [hash, setHash] = useState('');

  useEffect(() => {
    const initialHash = window.location.hash;
    if (initialHash) {
      setHash(initialHash);
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', onHashChange);

    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const setNewHash = (newHash: string) => {
    window.location.hash = newHash;
  };

  return { hash, setNewHash };
};
