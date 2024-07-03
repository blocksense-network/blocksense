import React from 'react';

import { EventDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';

type EventsProps = {
  events?: EventDocItem[];
};

export const Events = ({ events }: EventsProps) => {
  return (
    <ContractItemWrapper title="## Events" itemsLength={events?.length}>
      {events?.map((event, index) => (
        <div key={index}>
          <h3>{event.name}</h3>
          <span>Event Selector: {event.eventSelector}</span>
          {event.signature && <span>Signature: {event.signature}</span>}
          <span>Anonymous: {event.anonymous.toString()}</span>
          <Variables variables={event?._parameters} title="Parameters" />
          <NatSpec natspec={event.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
