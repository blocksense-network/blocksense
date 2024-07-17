import React, { ReactNode } from 'react';

import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type ContractItemWrapperProps = {
  itemsLength: number | undefined;
  title?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
};

export const ContractItemWrapper = ({
  itemsLength,
  title,
  titleLevel,
  children,
}: ContractItemWrapperProps) => {
  return (
    Boolean(itemsLength) && (
      <div className="contract-item-wrapper mt-6">
        <AnchorLinkTitle title={title} titleLevel={titleLevel} />
        <div className="contract-item-wrapper__content">{children}</div>
      </div>
    )
  );
};
