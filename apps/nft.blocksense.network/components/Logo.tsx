import Link from 'next/link';

export const Logo = () => {
  return (
    <Link href="/" className="logo">
      <img src="/images/logo.svg" alt="blocksense logo" />
    </Link>
  );
};
