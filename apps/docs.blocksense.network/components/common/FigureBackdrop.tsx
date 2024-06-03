import React from 'react';

export const FigureBackdrop = () => {
  return (
    <figure
      className="figure-backdrop absolute inset-x-0 top-1/2 transform -translate-y-1/2 -translate-x-[calc(200px)] overflow-hidden blur-3xl z-[-1]"
      aria-hidden="true"
    >
      <figcaption
        className="figure-backdrop--centered relative mx-auto aspect-[1155/678] w-[36.125rem] rotate-[30deg] bg-gradient-to-tr from-[#ff80b5] to-[#9089fc] opacity-30 pointer-events-none sm:w-[72.1875rem]"
        style={{
          clipPath:
            'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)',
        }}
      ></figcaption>
    </figure>
  );
};
