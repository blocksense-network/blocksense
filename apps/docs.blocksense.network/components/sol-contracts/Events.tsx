import React from 'react';
import { Signature } from '@/sol-contracts-components/Signature';
import { EventDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';
import { AnchorLinkTitle } from '@/sol-contracts-components/AnchorLinkTitle';

type EventsProps = {
  events?: EventDocItem[];
};

export const Events = ({ events }: EventsProps) => {
  return (
    <ContractItemWrapper
      title="Events"
      titleLevel={3}
      itemsLength={events?.length}
    >
      {events?.map((event, index) => (
        <div className="contract-item-wrapper__event" key={index}>
          <AnchorLinkTitle title={event.name} titleLevel={3} />
          <Selector selector={event.eventSelector} />
          <Signature signature={event.signature} />
          <span className="contract-item-wrapper__event-anonymous">
            Anonymous: {event.anonymous.toString()}
          </span>
          <Variables
            variables={event?._parameters}
            title="Parameters"
            titleLevel={4}
          />
          <NatSpec natspec={event.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
