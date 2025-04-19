'use client';

import Link from 'next/link';
import * as motion from 'motion/react-client';

import { Button } from 'components/Button';

const ErrorPage = () => {
  return (
    <motion.article
      className="error-page h-[calc(100vh-19rem)] flex flex-col justify-center items-center p-6 gap-4 w-full"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.35,
        delay: 0.1,
        ease: [0.25, 0.8, 0.25, 1],
      }}
    >
      <h1 className="error-page__title">500 - Internal Server Error</h1>
      <p className="error-page__message">Something happened, try again later</p>
      <Link href="/" className="cta__link">
        <Button variant="primary" className="cta__button">
          Back to Home
        </Button>
      </Link>
    </motion.article>
  );
};

export default ErrorPage;
