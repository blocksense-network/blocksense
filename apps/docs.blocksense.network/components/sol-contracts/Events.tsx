import React from 'react';
import { Signature } from '@/sol-contracts-components/Signature';
import { EventDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';
import { Selector } from '@/sol-contracts-components/Selector';

type EventsProps = {
  events?: EventDocItem[];
};

export const Events = ({ events }: EventsProps) => {
  return (
    <ContractItemWrapper
      className="contract-item-wrapper"
      title="Events"
      itemsLength={events?.length}
    >
      {events?.map((event, index) => (
        <div className="contract-item-wrapper__event" key={index}>
          <h3 className="contract-item-wrapper__event-title">
            {event.name} <Selector selector={event.eventSelector} />
          </h3>
          <Signature signature={event.signature} />
          <span className="contract-item-wrapper__event-anonymous">
            Anonymous: {event.anonymous.toString()}
          </span>
          <Variables variables={event?._parameters} title="Parameters" />
          <NatSpec
            className="contract-item-wrapper__event-natspec"
            natspec={event.natspec}
          />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
