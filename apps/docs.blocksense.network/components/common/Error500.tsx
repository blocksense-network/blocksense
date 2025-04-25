import React from 'react';
import { MessageLayout } from './MessageLayout';

export const Error500 = () => {
  return (
    <MessageLayout
      className="error-500"
      title="Error 500"
      hasIcon={false}
      alternativeContent="500"
      heading="Internal Server Error"
    />
  );
};
