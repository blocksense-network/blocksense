import React from 'react';

type SignatureProps = {
  signature?: string;
};

export const Signature = ({ signature }: SignatureProps) => {
  return <div>{signature && signature}</div>;
};
