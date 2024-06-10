import React from 'react';
import Link from 'next/link';

type LinkButtonProps = {
  label: string;
  link: string;
  target?: string;
};

export const LinkButton = ({ label, link, target }: LinkButtonProps) => {
  return (
    <Link legacyBehavior href={link}>
      <a
        target={target}
        rel={target === '_blank' ? 'noopener noreferrer' : undefined}
        className="link_button text-white min-w-28 bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-bold rounded-lg text-sm px-5 py-2.5 me-2 mb-2"
      >
        {label}
      </a>
    </Link>
  );
};
