'use client';

import Link from 'next/link';

import { Button } from 'components/Button';

const ErrorPage = () => {
  return (
    <article className="error-page h-[calc(100vh-19rem)] flex flex-col justify-center items-center p-6 gap-4 w-full">
      <h1 className="error-page__title">500 - Internal Server Error</h1>
      <p className="error-page__message">Something happened, try again later</p>
      <Link href="/" className="cta__link">
        <Button variant="primary" className="cta__button">
          Back to Home
        </Button>
      </Link>
    </article>
  );
};

export default ErrorPage;
