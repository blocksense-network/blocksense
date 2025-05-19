'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

import { SuccessForm } from './SuccessForm';
import { MintFormProvider } from '../app/contexts/MintFormContext';
import { RestForm } from './RestFrom';

export const Form = () => {
  const [showSuccess, setShowSuccess] = useState(false);
  const [mintTransactionUrl, setMintTransactionUrl] = useState('');
  const [isAlreadyMinted, setIsAlreadyMinted] = useState(false);

  const onSuccess = (mintTransactionUrl: string, isMinted: boolean) => {
    const mintForm = document.getElementById('mint-form');
    if (mintForm) {
      const mintFormTop = mintForm.getBoundingClientRect().top + window.scrollY;
      window.scrollTo({
        top: mintFormTop - 32,
        behavior: 'smooth',
      });
    }
    setMintTransactionUrl(mintTransactionUrl);
    setIsAlreadyMinted(isMinted);
    setShowSuccess(true);
  };

  return (
    <section className="form md:py-20 md:px-16 px-5 py-8" id="mint-form">
      <article className="form__article max-w-[35rem] mx-auto flex flex-col items-center justify-center md:gap-12 gap-8">
        <motion.h2
          className="form__title md:text-center md:px-[0.015rem]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          🚨 NFT drop complete! 🚨
        </motion.h2>
        <MintFormProvider>
          {!showSuccess && (
            <motion.div
              className="w-full"
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, delay: 0.2 }}
            >
              <RestForm />
            </motion.div>
          )}
          {showSuccess && (
            <SuccessForm
              mintTransactionUrl={mintTransactionUrl}
              isAlreadyMinted={isAlreadyMinted}
            />
          )}
        </MintFormProvider>
      </article>
    </section>
  );
};
