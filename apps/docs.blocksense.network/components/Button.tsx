import React from 'react';
import Link from 'next/link';

export const Button = () => {
  return (
    <button
      type="button"
      className="text-white bg-gray-800 hover:bg-gray-900 focus:outline-none focus:ring-4 focus:ring-gray-300 font-medium rounded-lg text-sm px-5 py-2.5 me-2 mb-2 dark:bg-gray-800 dark:hover:bg-gray-700 dark:focus:ring-gray-700 dark:border-gray-700"
    >
      <Link href="/getting-started">
        Get started <span>→</span>
      </Link>
    </button>
  );
};
