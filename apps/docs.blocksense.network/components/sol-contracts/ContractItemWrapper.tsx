import React, { ReactNode } from 'react';

import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type ContractItemWrapperProps = {
  itemsLength: number | undefined;
  title?: string;
  parentTitle?: string;
  titleLevel?: 1 | 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
};

export const ContractItemWrapper = ({
  itemsLength,
  title,
  parentTitle,
  titleLevel,
  children,
}: ContractItemWrapperProps) => {
  return (
    Boolean(itemsLength) && (
      <div className="contract-item-wrapper">
        <AnchorLinkTitle
          title={title}
          parentTitle={parentTitle}
          titleLevel={titleLevel}
          pagefindIgnore
        />
        <div className="contract-item-wrapper__content">{children}</div>
      </div>
    )
  );
};
