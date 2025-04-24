'use client';

import { useState, useEffect, useRef } from 'react';
import { MintForm } from './MintForm';
import { SuccessForm } from './SuccessForm';

import { useRevealOnView } from 'hooks/useRevealOnView';

export const Form = () => {
  const [showSuccess, setShowSuccess] = useState(false);
  const { targetRef, show } = useRevealOnView();

  const onSuccess = () => {
    setShowSuccess(true);
  };

  return (
    <section className="form md:p-20 px-5 py-8" id="mint-form">
      <article
        ref={targetRef}
        className="form__article max-w-[32.75rem] mx-auto flex flex-col items-center justify-center md:gap-12 gap-8"
      >
        <h2 className="form__title text-center">
          Join the crew and receive your NFT <br /> by completing all the steps:
        </h2>
        <div
          className={`transition-all ease-out transform duration-1000 ${
            show ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } delay-200`}
        >
          <MintForm onSuccessAction={onSuccess} />
        </div>
        <div
          className={`transition-all ease-out transform duration-1000 ${
            showSuccess ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
          } delay-500`}
        >
          {showSuccess && <SuccessForm />}
        </div>
      </article>
    </section>
  );
};
