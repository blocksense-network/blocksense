import Link from 'next/link';

const NotFoundPage = () => {
  return (
    <section className="not-found flex flex-col h-[calc(100vh-16rem)] items-center justify-center">
      <article className="not-found__container flex flex-col justify-center items-center p-6 max-w-md w-full h-full">
        <h1 className="not-found__title">404 - Not Found</h1>
        <p className="not-found__message mt-2 text-lg">
          The page you are looking for does not exist
        </p>
        <Link
          href="/"
          className="not-found__link mt-4 inline-block px-6 py-2 text-sm font-bold"
        >
          Back to Home
        </Link>
      </article>
    </section>
  );
};

export default NotFoundPage;
