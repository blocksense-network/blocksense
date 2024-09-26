import React from 'react';
import Image from 'next/image';

export const ListIcon = () => {
  return (
    <aside className="relative w-6 h-6 nx-flex-shrink-0" aria-hidden="true">
      <Image src="/icons/list-icon.svg" alt="List Icon" fill quality={50} />
    </aside>
  );
};
