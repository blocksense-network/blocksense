'use client';

import Link from 'next/link';

const ErrorPage = () => {
  return (
    <section className="error-page flex flex-col h-[calc(100vh-16rem)] items-center justify-center">
      <article className="error-page__container flex flex-col justify-center items-center p-6 max-w-md w-full h-full">
        <h1 className="error-page__title">500 - Internal Server Error</h1>
        <p className="error-page__message mt-2 text-lg">
          Something happened, try again later
        </p>
        <Link
          href="/"
          className="error-page__link mt-4 inline-block px-6 py-2 text-sm font-bold"
        >
          Back to Home
        </Link>
      </article>
    </section>
  );
};

export default ErrorPage;
