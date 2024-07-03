import React, { ReactNode } from 'react';

type ContractItemWrapperProps = {
  itemsLength: number | undefined;
  title?: string;
  children: ReactNode;
};

export const ContractItemWrapper = ({
  itemsLength,
  title,
  children,
}: ContractItemWrapperProps) => {
  return (
    <>
      {Boolean(itemsLength) && (
        <div className="mt-4">
          {title}
          {children}
        </div>
      )}
    </>
  );
};
