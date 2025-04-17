'use client';

import { useState } from 'react';

import { MintForm } from './MintForm';
import { SuccessForm } from './SuccessForm';

export const Form = () => {
  const [isSuccess, setIsSuccess] = useState(false);

  const onSuccess = () => {
    setIsSuccess(true);
  };

  return (
    <section className="md:p-20 px-5 py-8">
      <article className="max-w-[32.688rem] mx-auto flex flex-col items-center justify-center md:gap-12 gap-8">
        <h2 className="md:text-center">
          Join the crew and receive your NFT by completing ALL THE STEPS!
        </h2>
        {isSuccess ? <SuccessForm /> : <MintForm onSuccessAction={onSuccess} />}
      </article>
    </section>
  );
};
