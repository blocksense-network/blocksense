import React from 'react';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../Accordion';

export default {
  title: 'Components/Accordion',
  component: Accordion,
  parameters: {
    layout: 'fullscreen',
  },
};

const Template = args => (
  <Accordion {...args}>
    <AccordionItem value="item1">
      <AccordionTrigger>Item 1</AccordionTrigger>
      <AccordionContent>
        <p>This is the content for item 1.</p>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="item2">
      <AccordionTrigger>Item 2</AccordionTrigger>
      <AccordionContent>
        <p>This is the content for item 2.</p>
      </AccordionContent>
    </AccordionItem>
    <AccordionItem value="item3">
      <AccordionTrigger>Item 3</AccordionTrigger>
      <AccordionContent>
        <p>This is the content for item 3.</p>
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

export const Multiple = Template.bind({});
Multiple.args = {
  type: 'multiple',
  value: [],
  className: 'w-full max-w-md mx-auto my-8',
};

export const Single = Template.bind({});
Single.args = {
  type: 'single',
  value: [],
  className: 'w-full max-w-md mx-auto my-8',
};
