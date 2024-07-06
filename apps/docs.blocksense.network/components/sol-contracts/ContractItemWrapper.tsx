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
        <div className="mt-6">
          <h2 className="font-semibold tracking-tight text-slate-900 text-3xl border-gray-200 contrast-more:border-neutral-400">
            {title}
          </h2>
          {title && <hr class="h-px mt-4 mb-4 bg-gray-200 border-0"></hr>}
          <div>{children}</div>
        </div>
      )}
    </>
  );
};
