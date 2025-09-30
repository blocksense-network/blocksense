import React from 'react';

import { MessageLayout } from './MessageLayout';

export const Announcement = () => {
  return (
    <MessageLayout
      className="announcement"
      title="GitHub"
      heading="We're going public soon!"
    />
  );
};
