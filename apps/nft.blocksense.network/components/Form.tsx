'use client';

import { useState, useEffect, useRef } from 'react';
import { MintForm } from './MintForm';
import { SuccessForm } from './SuccessForm';

export const Form = () => {
  const [inView, setInView] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry) {
          setInView(entry.isIntersecting);
        }
      },
      { threshold: 0.1 },
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      if (ref.current) observer.unobserve(ref.current);
    };
  }, []);

  const onSuccess = () => {
    setShowSuccess(true);
  };

  return (
    <section className="form md:p-20 px-5 py-8" id="mint-form">
      <article
        ref={ref}
        className="form__article max-w-[32.75rem] mx-auto flex flex-col items-center justify-center md:gap-12 gap-8"
      >
        <h2 className="form__title text-center">
          Join the crew and receive your NFT <br /> by completing all the steps:
        </h2>
        <div
          className={`transition-all ease-out transform duration-1000 ${
            inView ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
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
