import React from 'react';
import { Signature } from '@/sol-contracts-components/Signature';
import { EventDocItem } from '@blocksense/sol-reflector';

import { NatSpec } from '@/sol-contracts-components/NatSpec';
import { ContractItemWrapper } from '@/sol-contracts-components/ContractItemWrapper';
import { Variables } from '@/sol-contracts-components/Variables';

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
          <h3 className="contract-item-wrapper__event-title">{event.name}</h3>
          <span className="contract-item-wrapper__event-selector">
            Event Selector: {event.eventSelector}
          </span>
          {event.signature && (
            <span className="contract-item-wrapper__event-signature">
              Signature: {event.signature}
            </span>
          )}
          <Signature signature="Event Signature" />
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
