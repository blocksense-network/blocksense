import React from 'react';

type LicenseProps = {
  license?: string;
};

export const License = ({ license }: LicenseProps) => {
  return license && <span>{license}</span>;
};
