'use client';

import { useState } from 'react';
import { motion } from 'motion/react';

import { MintForm } from './MintForm';
import { SuccessForm } from './SuccessForm';

export const Form = () => {
  const [showSuccess, setShowSuccess] = useState(false);

  const onSuccess = () => {
    setShowSuccess(true);
  };

  return (
    <section className="form md:py-20 md:px-16 px-5 py-8" id="mint-form">
      <article className="form__article max-w-[32.75rem] mx-auto flex flex-col items-center justify-center md:gap-12 gap-8">
        <motion.h2
          className="form__title md:text-center md:px-[0.015rem]"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          Join the crew and receive your NFT by completing all the steps:
        </motion.h2>

        <motion.div
          className="w-full"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
        >
          <MintForm onSuccessAction={onSuccess} />
        </motion.div>

        <motion.div
          animate={{
            opacity: showSuccess ? 1 : 0,
            scale: showSuccess ? 1 : 0.95,
          }}
          transition={{ duration: 1, delay: 0.5 }}
        >
          {showSuccess && <SuccessForm />}
        </motion.div>
      </article>
    </section>
  );
};
