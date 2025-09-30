import { Button } from 'components/Button';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: '404 - Not Found',
};

const NotFoundPage = () => {
  return (
    <article className="not-found-page h-[calc(100vh-19rem)] flex flex-col justify-center items-center p-6 gap-4 w-full">
      <h1 className="not-found-page__title">404 - Not Found</h1>
      <p className="not-found-page__message">
        The page you are looking for does not exist
      </p>
      <Link href="/" className="cta__link">
        <Button variant="primary" className="cta__button">
          Back to Home
        </Button>
      </Link>
    </article>
  );
};

export default NotFoundPage;
