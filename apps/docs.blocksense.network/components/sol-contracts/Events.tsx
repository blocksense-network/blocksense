import React from 'react';

import { EventDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variable } from '@/sol-contracts-components/Variable';

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
          {event?._parameters?.map((eventParameter, index) => (
            <Variable key={index} variable={eventParameter} />
          ))}
          <NatSpec natspec={event.natspec} />
        </div>
      ))}
    </ContractItemWrapper>
  );
};
