import React from 'react';
import { MessageLayout } from './MessageLayout';

export const Error404 = () => {
  return (
    <MessageLayout
      className="error-404"
      title="Error 404"
      hasIcon={false}
      alternativeContent="404"
      heading="This page could not be found"
    />
  );
};
